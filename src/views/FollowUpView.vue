<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useDriveWatcher } from "@/composables/useDriveWatcher";

import PageHeader from "@/components/PageHeader.vue";
import FollowUpBar from "@/components/followup/FollowUpBar.vue";
import CategorySheet from "@/components/followup/CategorySheet.vue";

import { useDrive } from "@/composables/useDrive";
import { useRouter } from "vue-router";

import { loadJSONFromFolder } from "@/services/driveAdapter";

import { useCategories } from "@/composables/useCategories";
import type { CategoryNature } from "@/composables/useCategories";

import FollowUpDetails from "@/components/followup/FollowUpDetails.vue";

import { useAppParameters } from "@/composables/useAppParameters";

const { appParameters, load } = useAppParameters();

import { formatDate } from "@/utils/dateFormat";

/* =========================
   Types
========================= */

type AnalysisScope = "FULL" | "MTD" | "YTD";

/* ---- Follow-up ---- */

interface FollowUpYearItem {
  subCategoryId: number;
  amount: number;
  monthToDate: number;
  amountOffBudget?: number;
  monthToDateOffBudget?: number;
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

/* ---- Budget ---- */

interface BudgetItem {
  categoryId: number;
  subCategoryId: number;
  amount: number;
}

interface BudgetMonth {
  year: number;
  month: number;
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

const router = useRouter();
const { driveStatus } = useDrive();

const categoriesStore = useCategories();

const categorySheetOpen = ref(false);

const year = ref<number>(2026);
const selectedCategory = ref<string>("*");
const selectedSubCategory = ref<string | null>(null);

const includeOffBudget = ref(true);

const followUpRaw = ref<FollowUpFile | null>(null);
const budgetRaw = ref<BudgetFile | null>(null);

const analysisScope = ref<AnalysisScope>("YTD");

/* =========================
   Drive watcher
========================= */

const followUpLastModified = ref<string | null>(null);

watch(driveStatus, (status) => {
  if (status !== "CONNECTED") {
    router.replace({ name: "authentication" });
  }
});

useDriveWatcher({
  folderId: "allocations/budget",
  fileName: "FollowUp.json",
  lastKnownModified: followUpLastModified,
  onChanged: loadFollowUp,
});

/* =========================
   Filters
========================= */

const filtersOpen = ref(true);

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
   Helpers
========================= */

function getMonthIndex(): number {
  return new Date().getMonth() + 1;
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
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((a, b) => a.seq - b.seq);
});

/* =========================
   Derived state
========================= */

const followUpSpreadLimit = computed(() => {
  return appParameters.value?.followUpSpreadLimit ?? 10;
});

const availableYears = computed(() => {
  if (!followUpRaw.value) return [];

  return followUpRaw.value.categories
    .flatMap(c => c.years.map(y => y.year))
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort((a, b) => b - a);
});

const activeCategory = computed(() => {
  if (selectedCategory.value === "*") return null;

  return categoriesStore.getCategory(Number(selectedCategory.value));
});

const subCategoryChips = computed(() => {
  if (!activeCategory.value) return [];

  return categoriesStore
    .getSubcategories(activeCategory.value.id)
    .sort((a, b) => a.seq - b.seq);
});

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

function analysedValue(
  amount: number,
  offBudget?: number
) {
  if (includeOffBudget.value) return amount;
  return amount - (offBudget ?? 0);
}

/* =========================
   Follow-up computation
========================= */
const items = computed<FollowUpItem[]>(() => {

  if (!followUpRaw.value) return [];

  const out: FollowUpItem[] = [];

  /* =========================================================
     MODE 1 — aucune catégorie sélectionnée
     → liste des catégories
  ========================================================= */

  if (selectedCategory.value === "*") {

    for (const c of followUpRaw.value.categories) {

      const meta = categoriesStore.getCategory(c.categoryId);
      if (!meta) continue;
      if (meta.displayScope === "X") continue;

      /* 🔹 filtres cohérents avec les chips */

      if (
        natureFilter.value !== "ALL" &&
        meta.nature !== natureFilter.value
      ) continue;

      if (
        meta.displayScope === "S" &&
        !showSecondaryCategories.value
      ) continue;

      /* ---------------------------------- */

      const yearData = c.years.find(y => y.year === year.value);
      if (!yearData) continue;

        const amount = yearData.items.reduce((sum, i) => {

          const base =
            analysisScope.value === "MTD"
              ? i.monthToDate
              : i.amount;

          const off =
            analysisScope.value === "MTD"
              ? i.monthToDateOffBudget
              : i.amountOffBudget;

          return sum + analysedValue(base, off);

        }, 0);

      out.push({
        id: String(c.categoryId),
        label: meta.label,
        amount
      });

    }

    return out.sort((a, b) => a.label.localeCompare(b.label));

  }

  /* =========================================================
     MODE 2 / 3 — catégorie sélectionnée
     → liste des sous-catégories
     → ou une seule sous-catégorie si sélectionnée
  ========================================================= */

  const catId = Number(selectedCategory.value);

  const cat =
    followUpRaw.value.categories
      .find(c => c.categoryId === catId);

  const meta =
    categoriesStore.getCategory(catId);

  if (!cat || !meta) return [];

  const yearData =
    cat.years.find(y => y.year === year.value);

  if (!yearData) return [];

  const subTotals =
    new Map<number, number>();

  for (const i of yearData.items) {

    const base =
      analysisScope.value === "MTD"
        ? i.monthToDate
        : i.amount;

    const off =
      analysisScope.value === "MTD"
        ? i.monthToDateOffBudget
        : i.amountOffBudget;

    const value = analysedValue(base, off);

    subTotals.set(
      i.subCategoryId,
      (subTotals.get(i.subCategoryId) ?? 0) + value
    );

  }

  const officialSubs =
    meta.subcategories
      .slice()
      .sort((a, b) => a.seq - b.seq);

  for (const sub of officialSubs) {
  
    if (!subTotals.has(sub.id)) continue;

    if (
      selectedSubCategory.value !== null &&
      Number(selectedSubCategory.value) !== sub.id
    ) {
      continue;
    }

    out.push({
      id: String(sub.id),
      label: sub.label,
      amount: subTotals.get(sub.id) ?? 0
    });

  }

  return out;

});

function displayedBudget(item: FollowUpItem) {
  if (!budgetRaw.value) return undefined;

  const currentMonth = getMonthIndex();

  const rows = budgetRaw.value.budgets.filter(b => {
    if (b.year !== year.value) return false;

    if (analysisScope.value === "FULL") return true;
    if (analysisScope.value === "MTD") return b.month < currentMonth;
    if (analysisScope.value === "YTD") return b.month <= currentMonth;

    return false;
  });

  let total = 0;

  /* =========================================================
     MODE 1 — catégories
  ========================================================= */
  if (selectedCategory.value === "*") {
    const categoryId = Number(item.id);

    for (const r of rows) {
      for (const i of r.items) {
        if (i.categoryId === categoryId) {
          total += i.amount;
        }
      }
    }

    return total || undefined;
  }

  /* =========================================================
     MODE 2 / 3 — sous-catégories
  ========================================================= */
  const categoryId = Number(selectedCategory.value);
  const subCategoryId = Number(item.id);

  for (const r of rows) {
    for (const i of r.items) {
      if (
        i.categoryId === categoryId &&
        i.subCategoryId === subCategoryId
      ) {
        total += i.amount;
      }
    }
  }

  return total || undefined;
}

/* =========================
   Budget helpers
========================= */

function allocatedValue(item: FollowUpItem) {
  return item.amount;
}

function totalAllocatedValue() {
  return items.value.reduce((s, i) => s + i.amount, 0);
}

const totalItem = computed<FollowUpItem | null>(() => {

  if (!items.value.length) return null;

  const amount = totalAllocatedValue();

  const budget = items.value
    .map(i => displayedBudget(i) ?? 0)
    .reduce((a, b) => a + b, 0);

  return {
    id: "total",
    label: "Total",
    amount,
    budget
  };
});

/* =========================
   Display helpers
========================= */

const currentNature = computed<CategoryNature | "-">(() => {

  if (natureFilter.value === "ALL") return "-";

  return natureFilter.value;
});


const scale = computed(() => {

  const values = items.value.map(i => Math.abs(i.amount));

  const max = Math.max(...values, 1);

  return {
    min: 0,
    max
  };

});

function allocatedClass(amount: number, budget?: number) {
  const b = budget ?? 0;
  if (amount > b) return "allocated-bad";
  if (amount < b) return "allocated-good";
  return "allocated-neutral";
}

/* =========================
   Labels
========================= */

const statusAsOfLabel = computed(() => {

  if (!followUpRaw.value?.updatedAt) return "";

  const d = new Date(followUpRaw.value.updatedAt);

  return "as of " + formatDate(d, "text");
});

const allocatedColumnLabel = computed(() => {

  if (analysisScope.value === "MTD") return "MTD";

  if (analysisScope.value === "YTD") return "YTD";

  return "Total";
});

/* =========================
   Details
========================= */

const showAllocationsDetail = computed(() => {
  return selectedCategory.value !== "*";
});

const allocationCategoryIds = computed(() => {

  if (selectedCategory.value === "*") return [];

  return [Number(selectedCategory.value)];
});

const allocationSubCategoryId = computed(() => {

  if (!selectedSubCategory.value) return null;

  return Number(selectedSubCategory.value);
});

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

const detailsNature = computed(() => {
  return currentNature.value === "-" ? null : currentNature.value;
});

const detailsMaxMonth = computed<number | null>(() => {
  const currentMonth = getMonthIndex();

  if (analysisScope.value === "FULL") {
    return null;
  }

  if (analysisScope.value === "MTD") {
    return currentMonth - 1;
  }

  if (analysisScope.value === "YTD") {
    return currentMonth;
  }

  return null;
});

/* =========================
   Loaders
========================= */

async function loadFollowUp() {

  const folderId =
    "allocations/budget";

  const data =
    await loadJSONFromFolder<FollowUpFile>(
      folderId,
      "FollowUp.json"
    );

  if (!data)
    throw new Error("FollowUp.json not found");

  followUpRaw.value = data;
}

async function loadBudget() {

  const folderId =
    "allocations/budget";

  const data =
    await loadJSONFromFolder<BudgetFile>(
      folderId,
      "budget.json"
    );

  if (!data)
    throw new Error("budget.json not found");

  budgetRaw.value = data;
}

/* =========================
   Init
========================= */

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
/*    await FollowUpDetails();*/
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
    <div
      class="sticky-stack"
      :key="selectedCategory + '-' + selectedSubCategory"
    >  

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
            <button
              class="scope-btn offbudget-toggle"
              :class="{ active: includeOffBudget }"
              @click="includeOffBudget = !includeOffBudget"
              :title="includeOffBudget
                ? 'Off-budget included'
                : 'Off-budget excluded'"
            >
              Off-Budget
            </button>

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
            :budget="displayedBudget(item) ?? 0"
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
      :include-off-budget="includeOffBudget"
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
  transform: translateZ(0);
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

/* Primary group (Year / Scope / Nature / Off budget) */
.primary-group {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;
  padding: 8px 0;
}

.offbudget-toggle {
  margin-left: 4px;
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
  color: var(--text);
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
  color: var(--positive);
}

.allocated-bad {
  color: var(--negative);
  font-weight: 700;
}

.allocated-neutral {
  color: var(--primary);
}
</style>