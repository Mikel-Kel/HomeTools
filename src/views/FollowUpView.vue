<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRouter } from "vue-router";

import PageHeader from "@/components/PageHeader.vue";
import FollowUpBar from "@/components/followup/FollowUpBar.vue";
import CategorySheet from "@/components/followup/CategorySheet.vue";
import FollowUpDetails from "@/components/followup/FollowUpDetails.vue";

import { useDrive } from "@/composables/useDrive";
import { useCategories } from "@/composables/useCategories";
import type { CategoryNature } from "@/composables/useCategories";

import { useAppParameters } from "@/composables/useAppParameters";

import { useFollowUpFilters } from "@/composables/followup/useFollowUpFilters";
import { useFollowUpData } from "@/composables/followup/useFollowUpData";
import { useFollowUpComputation } from "@/composables/followup/useFollowUpComputation";

/* =========================================================
   FollowUp types (local typing for JSON)
========================================================= */

interface FollowUpYearItem {
  subCategoryId: number
  amount: number
  monthToDate: number
}

interface FollowUpYear {
  year: number
  items: FollowUpYearItem[]
}

interface FollowUpCategory {
  categoryId: number
  years: FollowUpYear[]
}

interface FollowUpFile {
  version?: number
  updatedAt?: string
  categories: FollowUpCategory[]
}

/* =========================================================
   Core services
========================================================= */

const router = useRouter();

const { driveStatus } = useDrive();
const categoriesStore = useCategories();

const { appParameters, load } = useAppParameters();

type FollowUpItem = {
  id: string
  label: string
  amount: number
  budget?: number
}
type AnalysisScope = "FULL" | "MTD" | "YTD"

/* =========================================================
   Filters composable
========================================================= */

const filters = useFollowUpFilters();

const {
  year,
  analysisScope,

  selectedCategory,
  selectedSubCategory,

  natureFilter,
  showSecondaryCategories,

  filtersOpen,
  isCurrentYear,

  selectAllCategories,
  selectCategory,
  selectSubCategory
} = filters;

/* =========================================================
   Data composable
========================================================= */

const {
  followUpRaw,
  budgetRaw,
  loadFollowUp,
  loadBudget
} = useFollowUpData();

/* =========================================================
   Computation composable
========================================================= */
const {
  items,
  totalItem
} = useFollowUpComputation(
  followUpRaw,
  budgetRaw,
  filters
) as {
  items: import("vue").ComputedRef<FollowUpItem[]>
  totalItem: import("vue").ComputedRef<FollowUpItem | null>
};

/* =========================================================
   Local view state
========================================================= */

const categorySheetOpen = ref(false);

/* =========================================================
   Navigation level (debug helper)
========================================================= */

type FollowUpLevel =
  | "CATEGORIES"
  | "SUBCATEGORIES"
  | "DETAILS";

const viewLevel = computed<FollowUpLevel>(() => {

  if (selectedSubCategory.value !== null)
    return "DETAILS";

  if (selectedCategory.value !== "*")
    return "SUBCATEGORIES";

  return "CATEGORIES";

});

if (import.meta.env.DEV) {

  watch(viewLevel, lvl => {
    console.debug("FollowUpView level →", lvl);
  });

}

/* =========================================================
   Helpers
========================================================= */

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

function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}

/* =========================================================
   Category chips
========================================================= */

const categoryChips = computed(() => {

  if (!followUpRaw.value) return [];

  return followUpRaw.value.categories
    .map((c: any) => {

      const meta =
        categoriesStore.getCategory(c.categoryId);

      if (!meta) return null;

      if (
        natureFilter.value !== "ALL" &&
        meta.nature !== natureFilter.value
      )
        return null;

      if (
        meta.displayScope === "S" &&
        !showSecondaryCategories.value
      )
        return null;

      if (meta.displayScope === "X")
        return null;

      return meta;

    })
    .filter((c: any): c is NonNullable<typeof c> => c !== null)
    .sort((a: any, b: any) => a.seq - b.seq);

});

/* =========================================================
   Derived values
========================================================= */

const followUpSpreadLimit = computed(() =>
  appParameters.value?.followUpSpreadLimit ?? 10
);

const availableYears = computed<number[]>(() => {
  if (!followUpRaw.value) return [];

  const years = new Set<number>();

  for (const c of followUpRaw.value.categories as FollowUpCategory[]) {
    for (const y of c.years) {
      years.add(y.year);
    }
  }

  return Array.from(years).sort((a, b) => b - a);
});

const activeCategory = computed(() => {

  if (selectedCategory.value === "*")
    return null;

  return categoriesStore.getCategory(
    Number(selectedCategory.value)
  );

});

const subCategoryChips = computed(() => {

  if (!activeCategory.value) return [];

  return categoriesStore
    .getSubcategories(activeCategory.value.id)
    .sort((a, b) => a.seq - b.seq);

});

/* =========================================================
   Budget helpers
========================================================= */

function displayedBudget(item: any) {

  if (!budgetRaw.value) return undefined;

  const currentMonth = getMonthIndex();

  const rows =
    budgetRaw.value.budgets.filter((b: any) => {

      if (b.year !== year.value)
        return false;

      if (analysisScope.value === "FULL")
        return true;

      if (analysisScope.value === "MTD")
        return b.month < currentMonth;

      if (analysisScope.value === "YTD")
        return b.month <= currentMonth;

      return false;

    });

  let total = 0;

  if (selectedCategory.value === "*") {

    const categoryId = Number(item.id);

    for (const r of rows) {
      for (const i of r.items) {
        if (i.categoryId === categoryId)
          total += i.amount;
      }
    }

    return total || undefined;

  }

  const categoryId =
    Number(selectedCategory.value);

  const subCategoryId =
    Number(item.id);

  for (const r of rows) {
    for (const i of r.items) {

      if (
        i.categoryId === categoryId &&
        i.subCategoryId === subCategoryId
      )
        total += i.amount;

    }
  }

  return total || undefined;

}

/* =========================================================
   Totals
========================================================= */

function allocatedValue(item: any) {
  return item.amount;
}

function totalAllocatedValue() {

  return items.value.reduce(
    (s, i) => s + i.amount,
    0
  );

}

/* =========================================================
   Display helpers
========================================================= */

const currentNature = computed<CategoryNature | "-">(() => {

  if (natureFilter.value === "ALL")
    return "-";

  return natureFilter.value;

});

const scale = computed(() => {

  const values =
    items.value.map(i => Math.abs(i.amount));

  const max = Math.max(...values, 1);

  return { min: 0, max };

});

function allocatedClass(
  amount: number,
  budget?: number
) {

  if (!budget)
    return "allocated-neutral";

  if (amount > budget)
    return "allocated-bad";

  return "allocated-good";

}

/* =========================================================
   Labels
========================================================= */

const statusAsOfLabel = computed(() => {

  if (!followUpRaw.value?.updatedAt)
    return "";

  const d =
    new Date(followUpRaw.value.updatedAt);

  return "as of " + formatDate(d);

});

const allocatedColumnLabel = computed(() => {

  if (analysisScope.value === "MTD")
    return "MTD";

  if (analysisScope.value === "YTD")
    return "YTD";

  return "Total";

});

/* =========================================================
   Details
========================================================= */

const showAllocationsDetail =
computed(() => selectedCategory.value !== "*");

const allocationCategoryIds =
computed(() => {

  if (selectedCategory.value === "*")
    return [];

  return [Number(selectedCategory.value)];

});

const allocationSubCategoryId =
computed(() => {

  if (!selectedSubCategory.value)
    return null;

  return Number(selectedSubCategory.value);

});

const detailsMonthlyBudgetMap =
computed<Record<string, number>>(() => {

  if (
    !budgetRaw.value ||
    selectedCategory.value === "*" ||
    !selectedSubCategory.value
  )
    return {};

  const catId =
    Number(selectedCategory.value);

  const subId =
    Number(selectedSubCategory.value);

  const map: Record<string, number> = {};

  for (const m of budgetRaw.value.budgets) {

    if (m.year !== year.value)
      continue;

    const budget =
      m.items
        .filter(
          (it:any) =>
            it.categoryId === catId &&
            it.subCategoryId === subId
        )
        .reduce((s:number, it:any) => s + it.amount, 0);

    const key =
      `${m.year}-${String(m.month).padStart(2, "0")}`;

    map[key] = budget;

  }

  return map;

});

const detailsNature =
computed(() =>
  currentNature.value === "-"
    ? null
    : currentNature.value
);

const detailsMaxMonth =
computed<number | null>(() => {

  const currentMonth = getMonthIndex();

  if (analysisScope.value === "FULL")
    return null;

  if (analysisScope.value === "MTD")
    return currentMonth - 1;

  if (analysisScope.value === "YTD")
    return currentMonth;

  return null;

});

/* =========================================================
   Init
========================================================= */

watch(
  () => driveStatus,
  async state => {

    if (!state || driveStatus.value !== "CONNECTED") {

      router.replace({ name: "authentication" });
      return;

    }

    await load();

    await categoriesStore.load();

    await loadFollowUp();

    await loadBudget();

  },
  { immediate: true }
);
</script>

<template>
  <div v-if="driveStatus !== 'CONNECTED'" class="loading">
    <p>Drive session not available.</p>
  </div>
  <div v-else>
    <PageHeader title="Follow-up" icon="followup" />

    <!-- =========================
        STICKY STACK (Filters + Header + Total)
    ========================= -->
    <div class="sticky-stack">

      <!-- Filters -->
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
          <div class="primary-group">
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
          <div class="filter-row with-label">
            <span class="filter-label">Category</span>

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
          <div v-if="activeCategory" class="filter-row with-label">
            <span class="filter-label"></span>
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

      <!-- Header band -->
      <div class="followup-header-wrapper">
        <div class="followup-grid followup-header">
          <div class="col-label">Categories</div>

          <div class="col-chart centered">
            <span class="status-pill">
              {{ statusAsOfLabel }}
            </span>
          </div>

          <div class="col-allocated">
            {{ allocatedColumnLabel }}
          </div>

          <div class="col-budget">Budget</div>
        </div>
      </div>

      <!-- Total row (sticky as part of the stack) -->
      <div v-if="totalItem" class="followup-total-wrapper">
        <div class="followup-grid followup-row total">
          <div class="label">{{ totalItem.label }}</div>

          <div class="chart">
            <FollowUpBar
              :amount="totalItem.amount"
              :budget="totalItem.budget"
              :scale="scale"
              :spreadLimit="followUpSpreadLimit"
              :nature="currentNature === '-' ? null : currentNature"
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
      </div>

    </div>

    <!-- =========================
        CONTENT (scrolls under sticky stack)
    ========================= -->
    <div class="followup-table">
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
            :nature="currentNature === '-' ? null : currentNature"
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

    <!-- le reste inchangé -->
    <CategorySheet
      v-model="selectedCategory"
      :open="categorySheetOpen"
      :categories="[]"
      @close="categorySheetOpen = false"
    />

    <FollowUpDetails
      v-if="showAllocationsDetail"
      :year="year"
      :category-ids="allocationCategoryIds"
      :sub-category-id="allocationSubCategoryId"
      :monthly-budget-map="detailsMonthlyBudgetMap"
      :nature="detailsNature"
      :max-month="detailsMaxMonth"
    />
  </div>
</template>

<style scoped>
/* =========================================================
   1️⃣ STICKY STACK (Filters + Header + Total)
========================================================= */
.sticky-stack {
  position: sticky;
  top: 0;
  z-index: 200;
  background: var(--bg);
}


/* =========================================================
   2️⃣ FILTERS
========================================================= */
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
  padding: 0 8px 10px 8px;
}

/* Filter rows with aligned labels */
.filter-row.with-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 6px;
}

.filter-label {
  width: 90px;              /* Align Category & Sub rows */
  font-size: 0.85rem;
  font-weight: 500;
  opacity: 0.8;
}

/* Primary group (Year / Scope / Nature) */
.primary-group {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;
  padding: 8px 0;
}


/* =========================================================
   3️⃣ HEADER BAND (Categories / Spent / Budget)
========================================================= */
.followup-header-wrapper {
  background: var(--bg-soft);
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  padding: 0 12px;
  margin-top: 10px;
}

.followup-header {
  padding: 10px 0;
  font-size: var(--font-size-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-soft);
}


/* =========================================================
   4️⃣ TOTAL (part of sticky stack)
========================================================= */
.followup-total-wrapper {
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}

.followup-row.total {
  font-weight: 700;
  padding: 10px 12px;
  margin: 0;
}

/* =========================================================
   5️⃣ TABLE & GRID
========================================================= */
.followup-table {
  padding: 0 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Canonical grid structure */
.followup-grid {
  display: grid;
  grid-template-columns:
    220px   /* label */
    1fr     /* bar */
    90px    /* allocated */
    90px;   /* budget */
  align-items: center;
  column-gap: 16px;
}

/* Cells */
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

.col-allocated,
.col-budget,
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
   6️⃣ CONTROLS (Segmented & Chips)
========================================================= */

/* Year segmented */
.year-segmented {
  display: inline-flex;
  padding: 2px;
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


/* Scope selector */
.scope-selector {
  display: inline-flex;
  gap: 4px;
  padding: 2px;
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


/* Chips */
.chip {
  padding: 8px 10px;
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
   7️⃣ STATUS & STATES
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

.allocated-good {
  color: var(--success, #1f9d55);
}

.allocated-bad {
  color: var(--danger, #d64545);
  font-weight: 700;
}

.allocated-neutral {
  color: var(--primary, #1e40af);
}
</style>