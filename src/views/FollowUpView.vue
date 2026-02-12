<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useDriveWatcher } from "@/composables/useDriveWatcher";

import PageHeader from "@/components/PageHeader.vue";
import FollowUpBar from "@/components/followup/FollowUpBar.vue";
import CategorySheet from "@/components/followup/CategorySheet.vue";

import { useDrive } from "@/composables/useDrive";
import { listFilesInFolder, readJSON } from "@/services/google/googleDrive";
import { useCategories } from "@/composables/useCategories";
import type { CategoryNature } from "@/composables/useCategories";

import FollowUpDetails from "@/components/followup/FollowUpDetails.vue";

import { useAppParameters } from "@/composables/useAppParameters";
const { appParameters, load } = useAppParameters();

/* =========================
   Types
========================= */
type AnalysisScope = "FULL" | "MTD" | "YTD";

/* ---- Follow-up ---- */
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
  version?: number;
  updatedAt?: string;
  categories: FollowUpCategory[];
}

/* ---- Budget (REAL STRUCTURE) ---- */
interface BudgetItem {
  categoryId: number;
  subCategoryId: number;
  amount: number;
}

interface BudgetMonth {
  year: number;
  month: number; // 1..12
  items: BudgetItem[];
}

interface BudgetFile {
  version?: number;
  updatedAt?: string;
  budgets: BudgetMonth[];
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
const budgetRaw = ref<BudgetFile | null>(null);

const analysisScope = ref<AnalysisScope>("YTD");

/* =========================
   Drive watcher
========================= */
const followUpLastModified = ref<string | null>(null);

useDriveWatcher({
  folderId: driveState.value!.folders.allocations.budget,
  fileName: "FollowUp.json",
  lastKnownModified: followUpLastModified,
  onChanged: loadFollowUp,
});

/* =========================
   Filters
========================= */
const filtersOpen = ref(false);

type NatureFilter = "ALL" | "I" | "E";
const natureFilter = ref<NatureFilter>("E");

const showSecondaryCategories = ref(false);

watch(natureFilter, () => {
  selectedCategory.value = "*";
  selectedSubCategory.value = null;
});

/* =========================
   Year / scope validity
========================= */
const currentYear = new Date().getFullYear();
const isCurrentYear = computed(() => year.value === currentYear);

watch(year, () => {
  if (!isCurrentYear.value && analysisScope.value !== "FULL") {
    analysisScope.value = "FULL";
  }
});

/* =========================
   Helpers UI / dates
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

function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}

/* =========================
   CATEGORY CHIPS
========================= */
const categoryChips = computed(() => {
  if (!followUpRaw.value) return [];

  return followUpRaw.value.categories
    .map(c => {
      const meta = categoriesStore.getCategory(c.categoryId);
      if (!meta) return null;

      if (
        natureFilter.value !== "ALL" &&
        meta.nature !== natureFilter.value
      ) {
        return null;
      }

      if (meta.displayScope === "S" && !showSecondaryCategories.value)
        return null;
      if (meta.displayScope === "X") return null;

      return meta;
    })
    .filter(
      (c): c is NonNullable<typeof c> => c !== null
    )
    .sort((a, b) => a.seq - b.seq);
});

const activeCategory = computed(() => {
  if (selectedCategory.value === "*") return null;
  return (
    categoryChips.value.find(
      c => String(c.id) === selectedCategory.value
    ) ?? null
  );
});

const subCategoryChips = computed(() => {
  if (!activeCategory.value) return [];
  return activeCategory.value.subcategories
    .slice()
    .sort((a, b) => a.seq - b.seq);
});

/* =========================
   Column label
========================= */
const currentNature = computed<CategoryNature | null>(() => {
  if (activeCategory.value) return activeCategory.value.nature;
  if (natureFilter.value === "I" || natureFilter.value === "E") {
    return natureFilter.value;
  }
  return null;
});

const allocatedColumnLabel = computed(() => {
  if (currentNature.value === "I") return "Received";
  if (currentNature.value === "E") return "Spent";
  return "Alloc.";
});

/* =========================
   Budget helpers (REAL LOGIC)
========================= */
function getBudgetFor(
  categoryId: number,
  subCategoryId: number | null,
  y: number,
  scope: AnalysisScope
): number | undefined {
  if (!budgetRaw.value) return undefined;

  const currentMonth = getMonthIndex();

  const months = budgetRaw.value.budgets.filter(
    b =>
      b.year === y &&
      (scope === "FULL" ||
        (scope === "MTD" && b.month < currentMonth) ||
        (scope === "YTD" && b.month <= currentMonth))
  );

  if (!months.length) return undefined;

  let total = 0;

  for (const m of months) {
    for (const it of m.items) {
      if (it.categoryId !== categoryId) continue;
      if (
        subCategoryId !== null &&
        it.subCategoryId !== subCategoryId
      ) {
        continue;
      }
      total += it.amount;
    }
  }

  return total;
}

const displayedBudget = computed(() => {
  return (item: FollowUpItem): number | undefined => {
    const y = year.value;

    // =========================
    // ALL CATEGORIES MODE (*)
    // item.id = categoryId
    // =========================
    if (selectedCategory.value === "*") {
      return getBudgetFor(
        Number(item.id),
        null,
        y,
        analysisScope.value
      );
    }

    // =========================
    // CATEGORY SELECTED
    // item.id = subCategoryId
    // =========================
    return getBudgetFor(
      Number(selectedCategory.value),
      Number(item.id),
      y,
      analysisScope.value
    );
  };
});

/* =========================
   ITEMS
========================= */
const items = computed<FollowUpItem[]>(() => {
  if (!followUpRaw.value) return [];
  const y = year.value;

  /* CATEGORY MODE */
  if (selectedCategory.value === "*") {
    return categoryChips.value
      .map(cat => {
        const data = followUpRaw.value!.categories.find(
          c => c.categoryId === cat.id
        );
        if (!data) return null;

        const yearData = data.years.find(v => v.year === y);
        if (!yearData) return null;

        const amount = yearData.items.reduce(
          (s, i) =>
            s +
            (analysisScope.value === "MTD"
              ? i.monthToDate
              : i.amount),
          0
        );

        return {
          id: String(cat.id),
          label: cat.label,
          amount,
        };
      })
      .filter((v): v is FollowUpItem => v !== null);
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
        selectedSubCategory.value &&
        String(i.subCategoryId) !== selectedSubCategory.value
      ) {
        return null;
      }

      const sub = metaCat.subcategories.find(
        s => s.id === i.subCategoryId
      );
      if (!sub) return null;

      return {
        id: String(sub.id),
        label: sub.label,
        amount:
          analysisScope.value === "MTD"
            ? i.monthToDate
            : i.amount,
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
   Allocated helpers
========================= */
function allocatedValue(item: FollowUpItem): number {
  return Math.max(0, item.amount);
}

function totalAllocatedValue(): number {
  return items.value.reduce(
    (s, i) => s + Math.max(0, i.amount),
    0
  );
}

function allocatedClass(
  allocated: number,
  budget?: number
): string {
  if (budget === undefined) return "allocated-neutral";

  if (natureFilter.value === "E") {
    return allocated > budget
      ? "allocated-bad"
      : "allocated-good";
  }

  return allocated < budget
    ? "allocated-bad"
    : "allocated-good";
}

/* =========================
   TOTAL
========================= */
const totalItem = computed<FollowUpItem | null>(() => {
  if (!items.value.length) return null;

  const amount = items.value.reduce(
    (s, i) => s + Math.abs(i.amount),
    0
  );

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

/* =========================
   Available years
   (from budget.json ONLY)
========================= */
const availableYears = computed<number[]>(() => {
  if (!budgetRaw.value) return [];

  const years = new Set<number>();

  for (const m of budgetRaw.value.budgets) {
    years.add(m.year);
  }

  return Array.from(years).sort((a, b) => a - b);
});

/* =========================
   Misc
========================= */
const followUpSpreadLimit = computed(
  () => appParameters.value?.followUpSpreadLimit ?? 10
);

const statusAsOfLabel = computed(() => {
  if (!followUpRaw.value?.updatedAt) return "As of —";

  const updatedAt = new Date(followUpRaw.value.updatedAt);
  const effective =
    analysisScope.value === "MTD"
      ? endOfPreviousMonth(updatedAt)
      : updatedAt;

  return `As of ${formatDate(effective)}`;
});

/* =========================
   Loaders
========================= */
async function loadFollowUp() {
  const folderId =
    driveState.value!.folders.allocations.budget;

  const files = await listFilesInFolder(folderId);
  const file = files.find(f => f.name === "FollowUp.json");
  if (!file) throw new Error("FollowUp.json not found");

  followUpRaw.value = await readJSON<FollowUpFile>(file.id);
}

async function loadBudget() {
  const folderId =
    driveState.value!.folders.allocations.budget;

  const files = await listFilesInFolder(folderId);
  const file = files.find(f => f.name === "budget.json");
  if (!file) throw new Error("budget.json not found");

  budgetRaw.value = await readJSON<BudgetFile>(file.id);
}

const allocationCategoryIds = computed<number[]>(() =>
  selectedCategory.value === "*"
    ? []
    : [Number(selectedCategory.value)].filter(Number.isFinite)
);

const allocationSubCategoryId = computed<number | null>(() => {
  return selectedSubCategory.value
    ? Number(selectedSubCategory.value)
    : null;
});

/* =========================
   Monthly budget map for Details
========================= */
const detailsMonthlyBudgetMap = computed<Record<string, number>>(() => {
  if (
    !budgetRaw.value ||
    selectedCategory.value === "*" ||
    !selectedSubCategory.value
  ) {
    return {};
  }

  const catId = Number(selectedCategory.value);
  const subId = Number(selectedSubCategory.value);

  const map: Record<string, number> = {};

  for (const m of budgetRaw.value.budgets) {
    if (m.year !== year.value) continue;

    const budget = m.items
      .filter(
        it =>
          it.categoryId === catId &&
          it.subCategoryId === subId
      )
      .reduce((s, it) => s + it.amount, 0);

    const key = `${m.year}-${String(m.month).padStart(2, "0")}`;

    map[key] = budget;
  }

  return map;
});

/* DEBUG */
watch(detailsMonthlyBudgetMap, map => {
  console.log("==== DETAILS MONTHLY BUDGET MAP ====");
  console.log(map);
});

const detailsNature = computed<"E" | "I" | null>(() => {
  if (!activeCategory.value) return null;
  const n = activeCategory.value.nature;
  return n === "E" || n === "I" ? n : null;
});

/* DEBUG */
watch(detailsNature, n => {
  console.log("==== DETAILS NATURE ====", n);
});

const showAllocationsDetail = computed(() => {
  return allocationSubCategoryId.value !== null;
});

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
    await loadBudget();
  },
  { immediate: true }
);
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
      <div
        class="allocated"
        :class="allocatedClass(
          totalAllocatedValue(),
          totalItem.budget
        )"
      >
        {{ fmt(totalAllocatedValue()) }}
      </div>

      <div class="budget">
        <span v-if="totalItem.budget !== undefined">
          {{ fmt(totalItem.budget) }}
        </span>
        <span v-else class="muted">—</span>
      </div>
    </div>

    <!-- ITEMS -->
    <div
      v-for="item in items"
      :key="item.id"
      v-if="selectedSubCategory === null"
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
      <div
        class="allocated"
        :class="allocatedClass(
          allocatedValue(item),
          displayedBudget(item)
        )"
      >
        {{ fmt(allocatedValue(item)) }}
      </div>

      <div class="budget">
        <span v-if="displayedBudget(item) !== undefined">
          {{ fmt(displayedBudget(item)!) }}
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

  <!-- =========================
      DETAILS (ALLOCATIONS)
  ========================= -->
  <FollowUpDetails
    v-if="showAllocationsDetail"
    :year="year"
    :category-ids="allocationCategoryIds"
    :sub-category-id="allocationSubCategoryId"
    :monthly-budget-map="detailsMonthlyBudgetMap"
    :nature="detailsNature"
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

/* =========================================================
   Allocated states
========================================================= */
.allocated-good {
  color: var(--success, #1f9d55);
}

.allocated-bad {
  color: var(--danger, #d64545);
  font-weight: 700;
}

.allocated-neutral {
  color: var(--primary, #1e40af); /* bleu foncé */
}

</style>