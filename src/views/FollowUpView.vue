<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useDriveWatcher } from "@/composables/useDriveWatcher";

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
interface FollowUpFile {
  version: number;
  updatedAt: string; // ISO string, ex: 2026-02-07T10:05:29Z
  categories: FollowUpCategory[];
}

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
   Drive watcher state
========================= */
const followUpLastModified = ref<string | null>(null);

useDriveWatcher({
  folderId: driveState.value!.folders.allocations.budgetusage,
  fileName: "FollowUp.json",
  lastKnownModified: followUpLastModified,
  onChanged: loadFollowUp,
});

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

function formatDate(d: Date): string {
  return d.toLocaleDateString("fr-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function endOfPreviousMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 0);
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
   Column label (Received / Spent)
========================= */
const currentNature = computed<CategoryNature | null>(() => {
  // Si une catégorie est sélectionnée, on prend sa nature
  if (activeCategory.value) return activeCategory.value.nature;

  // Sinon, si le filtre nature est fixé (Income/Expenses), on l’utilise
  if (natureFilter.value === "I" || natureFilter.value === "E") {
    return natureFilter.value;
  }

  // Sinon (ALL + All categories), pas de nature unique
  return null;
});

const allocatedColumnLabel = computed(() => {
  if (currentNature.value === "I") return "Received";
  if (currentNature.value === "E") return "Spent";
  return "Alloc.";
});

/* =========================
   Displayed allocated (no decimals)
========================= */
const displayedAllocated = computed(() => {
  return (item: FollowUpItem): number => item.amount;
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

const statusAsOfLabel = computed<string>(() => {
  if (!followUpRaw.value?.updatedAt) {
    return "As of —";
  }

  const updatedAt = new Date(followUpRaw.value.updatedAt);

  let effectiveDate: Date;

  switch (analysisScope.value) {
    case "MTD":
      effectiveDate = endOfPreviousMonth(updatedAt);
      break;

    case "FULL":
    case "YTD":
    default:
      effectiveDate = updatedAt;
      break;
  }

  return `As of ${formatDate(effectiveDate)}`;
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

        <!-- PRIMARY FILTERS -->
        <div class="filter-row primary">

          <!-- Year -->
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

          <!-- Scope -->
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

          <!-- Nature -->
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

        <!-- Categories -->
        <div class="filter-row">
          <span class="label">Category</span>

          <button
            class="chip"
            :class="{ active: selectedCategory === '*' }"
            @click="selectAllCategories"
          >
            All
          </button>

          <button
            v-for="cat in categoryChips"
            :key="cat.id"
            class="chip"
            :class="{ active: selectedCategory === String(cat.id) }"
            @click="selectCategory(cat.id)"
          >
            {{ cat.label }}
          </button>

          <!-- 🔁 Toggle secondary categories -->
          <button
            class="chip more-toggle"
            :class="{ active: showSecondaryCategories }"
            @click="showSecondaryCategories = !showSecondaryCategories"
            :title="showSecondaryCategories
              ? 'Hide secondary categories'
              : 'Show secondary categories'"
          >
            {{ showSecondaryCategories ? '←' : '→' }}
          </button>
        </div>

        <!-- Subcategories -->
        <div
          v-if="activeCategory"
          class="filter-row subcats"
        >
          <span class="label">Sub</span>

          <button
            class="chip"
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

  <!-- HEADER -->
  <div class="followup-header-wrapper">
    <div class="followup-grid followup-header">
      <div class="col-label">Categories</div>

      <div class="col-chart centered">
        <span class="status-pill">
          {{ statusAsOfLabel }}
        </span>
      </div>

      <!-- ✅ Dynamic title -->
      <div class="col-allocated">
        {{ allocatedColumnLabel }}
      </div>

      <div class="col-budget">Budget</div>
    </div>
  </div>

  <!-- CONTENT -->
  <div class="followup-table">

    <!-- TOTAL -->
    <div
      v-if="totalItem"
      class="followup-grid followup-row total"
    >
      <div class="label">{{ totalItem.label }}</div>

      <div class="chart">
        <FollowUpBar
          :amount="totalItem.amount"
          :budget="totalItem.budget"
          :scale="scale"
          :spreadLimit="followUpSpreadLimit"
        />
      </div>

      <!-- ✅ Amount from JSON (no decimals) -->
      <div class="allocated">
        {{ Math.round(displayedAllocated(totalItem)).toLocaleString() }}
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
      class="followup-grid followup-row"
    >
      <div class="label">{{ item.label }}</div>

      <div class="chart">
        <FollowUpBar
          :amount="item.amount"
          :budget="displayedBudget(item)"
          :scale="scale"
          :spreadLimit="followUpSpreadLimit"
        />
      </div>

      <!-- ✅ Amount from JSON (no decimals) -->
      <div class="allocated">
        {{ Math.round(displayedAllocated(item)).toLocaleString() }}
      </div>

      <div class="budget">
        <span v-if="displayedBudget(item) !== undefined">
          {{ displayedBudget(item)!.toLocaleString() }}
        </span>
        <span v-else class="muted">—</span>
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
   Sticky zone
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
}

.filters-header {
  padding: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filters-body {
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.filter-row.subcats {
  padding-left: 1.5rem;
}

/* =========================================================
   Primary filters row (Year / Scope / Nature)
========================================================= */
.filter-row.primary {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

/* Empêche l’écrasement visuel */
.filter-row.primary > * {
  flex-shrink: 0;
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
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
}

/* =========================================================
   Scope selector (FULL / MTD / YTD / Nature)
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
   Chips
========================================================= */
.chip {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: var(--font-size-xs);
  font-weight: 600;
  opacity: 0.7;
  cursor: pointer;
}

.chip.active {
  opacity: 1;
  background: var(--primary-soft);
  border-color: var(--primary);
}

/* =========================================================
   Header band
========================================================= */
.followup-header-wrapper {
  background: var(--bg-soft);
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  padding: 0 12px;
}

/* =========================================================
   🔑 CANONICAL GRID (HEADER + ROWS)
========================================================= */
.followup-grid {
  display: grid;
  grid-template-columns:
    220px   /* label */
    1fr     /* bar */
    90px   /* allocated */
    90px;  /* budget */
  align-items: center;
  column-gap: 16px;
}

/* =========================================================
   Header
========================================================= */
.followup-header {
  padding: 10px 0;
  font-size: var(--font-size-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-soft);
}

.col-chart.centered {
  text-align: center;
}

.col-allocated,
.col-budget {
  text-align: right;
}

/* =========================================================
   Status pill
========================================================= */
.status-pill {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid var(--primary);
  background: var(--primary-soft);
  color: var(--primary);
  font-size: var(--font-size-xs);
  font-weight: 600;
  white-space: nowrap;
}

/* =========================================================
   Table
========================================================= */
.followup-table {
  padding: 0 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
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

/* =========================================================
   Cells
========================================================= */
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

.allocated,
.budget {
  text-align: right;
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
}

.muted {
  opacity: 0.4;
}

</style>