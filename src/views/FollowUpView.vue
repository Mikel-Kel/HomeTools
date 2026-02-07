<script setup lang="ts">
import { ref, computed, watch } from "vue";

import PageHeader from "@/components/PageHeader.vue";
import FollowUpBar from "@/components/followup/FollowUpBar.vue";
import CategorySheet from "@/components/followup/CategorySheet.vue";

import { useDrive } from "@/composables/useDrive";
import { listFilesInFolder, readJSON } from "@/services/google/googleDrive";
import { useCategories } from "@/composables/useCategories";
import type {
  CategoryNature,
  CategoryDisplayScope,
} from "@/composables/useCategories";

import { useAppParameters } from "@/composables/useAppParameters";
const { appParameters, load } = useAppParameters();

/* =========================
   Types
========================= */
interface CategoryChip {
  id: number;
  label: string;
  seq: number;
  nature: CategoryNature;
  displayScope: CategoryDisplayScope;
  subcategories: typeof categoriesStore.categories.value[number]["subcategories"];
}

type RawItem =
  | {
      id: string;
      label: string;
      amount: number;
      budget?: number;
    }
  | null;

type AnalysisScope = "FULL" | "MTD" | "YTD";

interface FollowUpYearItem {
  subCategoryId: number;
  amount: number;
  monthToDate: number;
}

interface FollowUpYear {
  year: number;
  items: FollowUpYearItem[];
}

interface FollowUpCategory {
  categoryId: number;
  years: FollowUpYear[];
}

interface FollowUpFile {
  categories: FollowUpCategory[];
}

interface FollowUpItem {
  id: string;
  label: string;
  amount: number;
  budget?: number;
}

/* =========================
   State
========================= */
const { driveState } = useDrive();
const categoriesStore = useCategories();

const categorySheetOpen = ref(false);

const year = ref<number>(2026);
const selectedCategory = ref<string>("*");
const selectedSubCategory = ref<string | null>(null);

const followUpRaw = ref<FollowUpFile | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const analysisScope = ref<AnalysisScope>("YTD");

/* =========================
   Filters
========================= */
const filtersOpen = ref(false);

type NatureFilter = "ALL" | "I" | "E";
/* défaut = Expenses */
const natureFilter = ref<NatureFilter>("E");

/* displayScope */
const showSecondaryCategories = ref(false);

/* =========================
   Current year / scope validity
========================= */
const currentYear = new Date().getFullYear();
const isCurrentYear = computed(() => year.value === currentYear);

watch(year, () => {
  if (!isCurrentYear.value && analysisScope.value !== "FULL") {
    analysisScope.value = "FULL";
  }
});

/* =========================
   Helpers UI + dates
========================= */
function selectAllCategories() {
  selectedCategory.value = "*";
  selectedSubCategory.value = null;
}

function selectCategory(id: number) {
  selectedCategory.value = String(id);
  selectedSubCategory.value = null;
}

function selectSubCategory(id: number) {
  selectedSubCategory.value = String(id);
}

function getMonthIndex(): number {
  return new Date().getMonth() + 1;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function daysElapsedInMonth(): number {
  return new Date().getDate();
}

/* =========================
   CATEGORY CHIPS (vérité métier)
========================= */
const categoryChips = computed<CategoryChip[]>(() => {
  if (!followUpRaw.value) return [];

  const chips: CategoryChip[] = [];

  for (const c of followUpRaw.value.categories) {
    const meta = categoriesStore.getCategory(c.categoryId);
    if (!meta) continue;

    /* Nature */
    if (
      natureFilter.value !== "ALL" &&
      meta.nature !== natureFilter.value
    ) {
      continue;
    }

    /* DisplayScope strict */
    switch (meta.displayScope) {
      case "P":
        break;
      case "S":
        if (!showSecondaryCategories.value) continue;
        break;
      case "X":
      default:
        continue;
    }

    chips.push({
      id: meta.id,
      label: meta.label,
      seq: meta.seq,
      nature: meta.nature,
      displayScope: meta.displayScope,
      subcategories: meta.subcategories,
    });
  }

  return chips.sort((a, b) => a.seq - b.seq);
});

/* =========================
   Active category / subs
========================= */
const activeCategory = computed<CategoryChip | null>(() => {
  if (selectedCategory.value === "*") return null;
  return (
    categoryChips.value.find(
      c => String(c.id) === selectedCategory.value
    ) ?? null
  );
});

const subCategoryChips = computed(() => {
  const cat = activeCategory.value;
  if (!cat) return [];
  return cat.subcategories.slice().sort((a, b) => a.seq - b.seq);
});

/* =========================
   Reset on filter change
========================= */
watch([natureFilter, showSecondaryCategories], () => {
  selectedCategory.value = "*";
  selectedSubCategory.value = null;
});

/* =========================
   Budget display (scope-aware)
========================= */
const displayedBudget = computed(() => {
  return (item: FollowUpItem): number | undefined => {
    if (item.budget === undefined) return undefined;

    if (analysisScope.value === "FULL") {
      return item.budget;
    }

    const currentMonth = getMonthIndex();
    const monthlyBudget = item.budget / 12;
    const mtdBudget = monthlyBudget * (currentMonth - 1);

    if (analysisScope.value === "MTD") {
      return Math.round(mtdBudget);
    }

    const dim = daysInMonth(year.value, currentMonth);
    const elapsed = daysElapsedInMonth();
    const prorata = monthlyBudget * (elapsed / dim);

    return Math.round(mtdBudget + prorata);
  };
});

/* =========================
   Available years
========================= */
const availableYears = computed<number[]>(() => {
  const years = new Set<number>();
  for (const cat of categoriesStore.categories.value) {
    for (const b of cat.budgets ?? []) {
      years.add(b.year);
    }
  }
  return Array.from(years).sort((a, b) => a - b);
});

/* =========================
   Drive load
========================= */
async function loadFollowUp(): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    const folderId =
      driveState.value!.folders.allocations.budgetusage;

    const files = await listFilesInFolder(folderId);
    const file = files.find(f => f.name === "FollowUp.json");
    if (!file) throw new Error("FollowUp.json not found");

    followUpRaw.value = await readJSON<FollowUpFile>(file.id);
  } catch (e: any) {
    error.value = e.message ?? "Unable to load FollowUp.json";
  } finally {
    loading.value = false;
  }
}

/* =========================
   Init
========================= */
watch(
  () => driveState.value,
  async state => {
    if (!state) return;

    await load();
    if (!categoriesStore.categories.value.length) {
      await categoriesStore.load();
    }
    await loadFollowUp();
  },
  { immediate: true }
);

/* =========================
   ITEMS (basés UNIQUEMENT sur categoryChips)
========================= */
const followUpSpreadLimit = computed(
  () => appParameters.value?.followUpSpreadLimit ?? 10
);

const items = computed<FollowUpItem[]>(() => {
  if (!followUpRaw.value) return [];

  const y = year.value;

  /* CATEGORY MODE */
  if (selectedCategory.value === "*") {
    return categoryChips.value
      .map(chip => {
        const cat = followUpRaw.value!.categories.find(
          c => c.categoryId === chip.id
        );
        if (!cat) return null;

        const yearData = cat.years.find(v => v.year === y);
        if (!yearData) return null;

        const meta = categoriesStore.getCategory(cat.categoryId);
        if (!meta) return null;

        const amount = yearData.items.reduce(
          (sum, i) =>
            sum +
            (analysisScope.value === "MTD"
              ? i.monthToDate
              : i.amount),
          0
        );

        const budget = meta.budgets
          ?.find(b => b.year === y)
          ?.items?.[0]?.budget;

        return {
          id: String(cat.categoryId),
          label: meta.label,
          amount,
          ...(budget !== undefined ? { budget } : {}),
        };
      })
      .filter((v): v is FollowUpItem => v !== null)
      .sort((a, b) => {
        const ca = categoriesStore.getCategory(Number(a.id))?.seq ?? 0;
        const cb = categoriesStore.getCategory(Number(b.id))?.seq ?? 0;
        return ca - cb;
      });
  }

  /* SUBCATEGORY MODE */
  const catId = Number(selectedCategory.value);
  const catData = followUpRaw.value.categories.find(
    c => c.categoryId === catId
  );
  if (!catData) return [];

  const yearData = catData.years.find(v => v.year === y);
  if (!yearData) return [];

  const metaCat = categoriesStore.getCategory(catId);
  if (!metaCat) return [];

  return yearData.items
    .map(i => {
      if (
        selectedSubCategory.value !== null &&
        String(i.subCategoryId) !== selectedSubCategory.value
      ) {
        return null;
      }

      const sub = metaCat.subcategories.find(
        s => s.id === i.subCategoryId
      );
      if (!sub) return null;

      const budget = sub.budgets
        ?.find(b => b.year === y)
        ?.items?.[0]?.budget;

      return {
        id: String(sub.id),
        label: sub.label,
        amount:
          analysisScope.value === "MTD"
            ? i.monthToDate
            : i.amount,
        ...(budget !== undefined ? { budget } : {}),
      };
    })
    .filter((v): v is FollowUpItem => v !== null)
    .sort((a, b) => {
      const sa =
        metaCat.subcategories.find(s => s.id === Number(a.id))?.seq ?? 0;
      const sb =
        metaCat.subcategories.find(s => s.id === Number(b.id))?.seq ?? 0;
      return sa - sb;
    });
});

/* =========================
   TOTAL
========================= */
const totalItem = computed<FollowUpItem | null>(() => {
  if (!items.value.length) return null;

  const amount = items.value.reduce((s, i) => s + i.amount, 0);

  const budgets = items.value
    .map(i => displayedBudget.value(i))
    .filter((b): b is number => b !== undefined);

  const budget =
    budgets.length > 0
      ? budgets.reduce((s, b) => s + b, 0)
      : undefined;

  return {
    id: "__total__",
    label: "Total",
    amount,
    ...(budget !== undefined ? { budget } : {}),
  };
});

/* =========================
   SCALE
========================= */
const scale = computed(() => {
  if (!items.value.length) {
    return { min: 0, max: 0 };
  }

  const deltas = items.value.map(i => {
    const budget = displayedBudget.value(i);
    return budget === undefined ? 0 : Math.abs(budget - i.amount);
  });

  return {
    min: 0,
    max: Math.max(0, ...deltas),
  };
});
</script>

<template>
  <PageHeader title="Follow-up" icon="followup" />

  <!-- Sticky filters zone -->
  <div class="sticky-zone">
    <section class="filters">
      <header
        class="filters-header clickable"
        @click="filtersOpen = !filtersOpen"
      >
        <span class="arrow">{{ filtersOpen ? "▼" : "►" }}</span>
        <h2>Filters</h2>
      </header>

      <div v-if="filtersOpen" class="filters-body">

        <!-- Year -->
        <div class="filter-row">
          <span class="label">Year</span>

          <div class="year-segmented">
            <button
              v-for="y in availableYears"
              :key="y"
              class="year-segment"
              :class="{ active: year === y }"
              @click="year = y"
            >
              {{ y }}
            </button>
          </div>
        </div> 
        <!-- Analysis scope -->
        <div class="filter-row">
          <span class="label">Scope</span>

          <div class="scope-selector">
          <button
            v-for="s in ['FULL', 'MTD', 'YTD']"
            :key="s"
            class="scope-btn"
            :class="{
              active: analysisScope === s,
              disabled: !isCurrentYear && s !== 'FULL'
            }"
            :disabled="!isCurrentYear && s !== 'FULL'"
            @click="analysisScope = s as AnalysisScope"
          >
            {{ s }}
          </button>
          </div>
        </div>
        <!-- Nature -->
        <div class="filter-row">
          <span class="label">Nature</span>

          <div class="scope-selector">
            <button
              class="scope-btn"
              :class="{ active: natureFilter === 'ALL' }"
              @click="natureFilter = 'ALL'"
            >
              All
            </button>

            <button
              class="scope-btn"
              :class="{ active: natureFilter === 'I' }"
              @click="natureFilter = 'I'"
            >
              Income
            </button>

            <button
              class="scope-btn"
              :class="{ active: natureFilter === 'E' }"
              @click="natureFilter = 'E'"
            >
              Expenses
            </button>
          </div>
        </div>
        <!-- Display scope -->
        <div class="filter-row">
          <span class="label">More</span>

          <button
            class="chip"
            :class="{ active: showSecondaryCategories }"
            @click="showSecondaryCategories = !showSecondaryCategories"
            title="Show secondary categories"
          >
            …
          </button>
        </div>
        <!-- Categories -->
        <div class="filter-row">
          <span class="label">Category</span>

          <!-- ALL -->
          <button
            class="chip status all"
            :class="{ active: selectedCategory === '*' }"
            @click="selectAllCategories"
          >
            All
          </button>

          <!-- Categories -->
          <button
            v-for="cat in categoryChips"
            :key="cat.id"
            class="chip"
            :class="{ active: selectedCategory === String(cat.id) }"
            @click="selectCategory(cat.id)"
          >
            {{ cat.label }}
          </button>
        </div>

        <!-- Sub-categories -->
        <div
          v-if="activeCategory"
          class="filter-row subcats"
        >
          <span class="label">Sub</span>

          <!-- ALL sub -->
          <button
            class="chip status all"
            :class="{ active: selectedSubCategory === null }"
            @click="selectedSubCategory = null"
          >
            All
          </button>

          <button
            v-for="sub in subCategoryChips"
            :key="sub.id"
            class="chip"
            :class="{ active: selectedSubCategory === String(sub.id) }"
            @click="selectSubCategory(sub.id)"
          >
            {{ sub.label }}
          </button>
        </div>
      </div>
    </section>
  </div>

  <div class="followup-header-wrapper">
    <div class="followup-header">
      <div class="col-label">Categories</div>
      <div class="col-chart centered">Spending status</div>
      <div class="col-budget">Budget</div>
    </div>
  </div>

  <!-- Content -->
  <div class="followup-view">
    <div v-if="loading" class="info">Loading…</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <div v-else class="followup-table">
      <!-- TOTAL ROW -->
      <div
        v-if="totalItem"
        class="followup-row total"
      >
        <div class="label">
          {{ totalItem.label }}
        </div>

        <div class="chart">
          <FollowUpBar
            :amount="totalItem.amount"
            :budget="totalItem.budget"
            :scale="scale"
            :spreadLimit="followUpSpreadLimit"
          />
        </div>

        <div class="budget">
          <span v-if="totalItem.budget !== undefined">
            {{ totalItem.budget.toLocaleString() }}
          </span>
          <span v-else class="muted">—</span>
        </div>
      </div>

      <!-- ITEMS -->
      <div
        v-for="item in items"
        :key="item.id"
        class="followup-row"
      >

        <!-- Label -->
        <div class="label">
          {{ item.label }}
        </div>

        <!-- Chart -->
        <div class="chart">
          <FollowUpBar
            :amount="item.amount"
            :budget="displayedBudget(item)"
            :scale="scale"
            :spreadLimit="followUpSpreadLimit"
          />
        </div>

        <!-- Budget -->
        <div class="budget">
          <span v-if="displayedBudget(item) !== undefined">
            {{ displayedBudget(item)!.toLocaleString() }}
          </span>
          <span v-else class="muted">—</span>
        </div>
      </div>
    </div>
  </div>

  <CategorySheet
    v-model="selectedCategory"
    :open="categorySheetOpen"
    :categories="[]"
    @close="categorySheetOpen = false"
  />
</template>

<style scoped>
/* =========================================================
   Sticky zone (Filters)
========================================================= */
.sticky-zone {
  position: sticky;
  top: 0;
  z-index: 200;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}

.filters {
  font-size: var(--font-size-sm);
  background: var(--bg);
}

.filters-header {
  padding: 0.5rem 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filters-header h2 {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-soft);
}

.filters-body {
  padding: 0.5rem 0.5rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.filter-row.subcats {
  padding-left: 1.5rem; /* léger retrait visuel */
}

.chip {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  cursor: pointer;
  user-select: none;
  font-size: var(--font-size-xs);
  font-weight: 600;
  opacity: 0.7;
}

.chip.active {
  opacity: 1;
  background: var(--primary-soft);
  border-color: var(--primary);
}
/* =========================================================
   Year segmented control (iOS-style)
========================================================= */
.year-segmented {
  display: inline-flex;
  padding: 3px;
  gap: 2px;

  background: var(--bg-soft);
  border-radius: 999px;
  border: 1px solid var(--border);
}

.year-segment {
  padding: 6px 16px;
  border-radius: 999px;
  border: none;
  background: transparent;

  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--text-soft);
  opacity: 0.6;

  cursor: pointer;
  user-select: none;
}

.year-segment.active {
  background: var(--primary-soft);
  border: 1px solid var(--primary);
  color: var(--primary);

  opacity: 1;
  font-weight: 600;

  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
}

/* =========================================================
   Analysis scope selector (enhanced)
========================================================= */
.scope-selector {
  display: inline-flex;
  gap: 4px;
  padding: 3px;
  background: var(--bg-soft);
  border-radius: 999px;
}

.scope-btn {
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid transparent;

  font-size: var(--font-size-xs);
  font-weight: 600;

  color: var(--text-soft);
  background: transparent;
  opacity: 0.6;

  cursor: pointer;
  user-select: none;
}

.scope-btn.active {
  background: var(--primary-soft);
  border-color: var(--primary);
  color: var(--primary);
  opacity: 1;

  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
}

.scope-btn.disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* =========================================================
   Follow-up header
========================================================= */
.followup-header {
  display: grid;
  grid-template-columns: 280px 1fr 140px;
  column-gap: 16px;
  padding: 8px 0;
  align-items: center;
  margin-bottom: 4px;

  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--text-soft);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}


.col-budget {
  text-align: right;
}
/* =========================================================
   Follow-up header band
========================================================= */
.followup-header-wrapper {
  background: var(--bg-soft);
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}

/* Header grid */
.followup-header {
  display: grid;
  grid-template-columns: 220px 1fr 120px;
  align-items: center;

  padding: 10px 12px;

  font-size: var(--font-size-xs);
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;

  color: var(--text-soft);
}

/* =========================================================
   Follow-up view
   ========================================================= */
.followup-separator {
  border: none;
  height: 1px;
  background: var(--border);
  margin: 0 1.5rem;
}

.followup-table {
  display: flex;
  flex-direction: column;
  padding: 0.5rem 0.5rem;
  gap: 10px;
}

.followup-row {
  display: grid;
  grid-template-columns: 190px 1fr 140px;
  align-items: center;
  column-gap: 16px;
}
.followup-row.total {
  font-weight: 700;
  border-bottom: 1px solid var(--border);
  padding-bottom: 6px;
  margin-bottom: 6px;
}

.followup-row.total .label {
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.label {
  font-size: 0.85rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chart {
  height: 20px;
}

.col-chart.centered {
  text-align: center;
}

.budget {
  text-align: right;
  font-size: 0.85rem;
  font-weight: 600;
}

.muted {
  opacity: 0.4;
}

.budgets {
  text-align: right;
  font-weight: 600;
}

.muted {
  opacity: 0.4;
}

</style>