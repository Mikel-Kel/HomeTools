<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useDriveWatcher } from "@/composables/useDriveWatcher";

import PageHeader from "@/components/PageHeader.vue";
import FollowUpBar from "@/components/followup/FollowUpBar.vue";
import CategorySheet from "@/components/followup/CategorySheet.vue";

import { useDrive } from "@/composables/useDrive";
import { useRouter } from "vue-router";

import { useAppBootstrap } from "@/composables/useAppBootstrap"
const { loadSettings } = useAppBootstrap()

import { loadJSONFromFolder } from "@/services/driveAdapter";

import { useCategories } from "@/composables/useCategories";
import type { CategoryNature } from "@/composables/useCategories";

import ChipSelector from "@/components/ChipSelector.vue";

import FollowUpDetails from "@/components/followup/FollowUpDetails.vue";

import { useAppParameters } from "@/composables/useAppParameters";

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
  lastKnownState: followUpLastModified,
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
function isCategoryVisible(meta: any): boolean {
  if (!meta) return false;
  if (meta.displayScope === "X") return false;
  if (
    natureFilter.value !== "ALL" &&
    meta.nature !== natureFilter.value
  ) {
    return false;
  }
  if (
    meta.displayScope === "S" &&
    !showSecondaryCategories.value
  ) {
    return false;
  }
  return true;
}

const categoryChips = computed(() => {
  if (!followUpRaw.value) return [];

  return followUpRaw.value.categories
    .map((c: any) =>
      categoriesStore.getCategory(c.categoryId)
    )
    .filter((meta): meta is NonNullable<typeof meta> => !!meta)
    .filter(isCategoryVisible)
    .sort((a, b) => a.seq - b.seq);
});

const categoryChipItems = computed(() => {
  const base = categoryChips.value.map(cat => ({
    id: String(cat.id),
    label: cat.label
  }));
  return [
    { id: "*", label: "All" },
    ...base,
    {
      id: "__TOGGLE__",
      label: showSecondaryCategories.value ? "←" : "→"
    }
  ];
});

/* =========================
   Derived state
========================= */
let followUpSpreadLimit = ref(10)

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

const subCategoryChipItems = computed(() => {
  if (!activeCategory.value) return [];
  return [
    { id: "*", label: "All" },
    ...subCategoryChips.value.map(sub => ({
      id: String(sub.id),
      label: sub.label
    }))
  ];
});

function selectAllCategories() {
  selectedCategory.value = "*";
  selectedSubCategory.value = null;
}

function selectCategory(id: number) {
  selectedCategory.value = String(id);
  selectedSubCategory.value = null;
}

function onCategorySelect(id: string) {
  if (id === "__TOGGLE__") {
    showSecondaryCategories.value = !showSecondaryCategories.value;
    return;
  }
  if (id === "*") {
    selectAllCategories();
    return;
  }
  selectCategory(Number(id));
}

function selectSubCategory(id: number) {
  selectedSubCategory.value = String(id);
}

function onSubCategorySelect(id: string) {
  if (id === "*") {
    selectedSubCategory.value = null;
    return;
  }
  selectSubCategory(Number(id));
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

function computeCategoryItems(): FollowUpItem[] {
  if (!followUpRaw.value) return [];

  const out: FollowUpItem[] = [];

  for (const c of followUpRaw.value.categories) {

    const meta = categoriesStore.getCategory(c.categoryId);
    if (!meta) continue;

    if (!isCategoryVisible(meta)) continue;

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

function computeSubCategoryItems(): FollowUpItem[] {

  if (!followUpRaw.value) return [];

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

  const subTotals = new Map<number, number>();

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

  const out: FollowUpItem[] = [];

  const officialSubs =
    meta.subcategories
      .slice()
      .sort((a, b) => a.seq - b.seq);

  for (const sub of officialSubs) {

    if (!subTotals.has(sub.id)) continue;

    if (
      selectedSubCategory.value !== null &&
      Number(selectedSubCategory.value) !== sub.id
    ) continue;

    out.push({
      id: String(sub.id),
      label: sub.label,
      amount: subTotals.get(sub.id) ?? 0
    });
  }

  return out;
}

const items = computed<FollowUpItem[]>(() => {

  if (selectedCategory.value === "*") {
    return computeCategoryItems();
  }

  return computeSubCategoryItems();
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

    await loadSettings();
    await loadFollowUp();
    await loadBudget();
/*    await FollowUpDetails();*/
    const { appParameters } = useAppParameters()

    followUpSpreadLimit.value =
      appParameters.value?.followUpSpreadLimit ?? 10
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

          <div class="category-block">
            <!-- Categories -->
            <ChipSelector
              label="Category"
              :items="categoryChipItems"
              :model-value="selectedCategory"
              @update:modelValue="onCategorySelect"
              :align-with-content="false"
            />

            <!-- Subcategories -->
            <ChipSelector
              v-if="activeCategory"
              label=""
              :items="subCategoryChipItems"
              :model-value="selectedSubCategory ?? '*'"
              @update:modelValue="onSubCategorySelect"
              :align-with-content="false"
            />
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

  /* 🔥 FIX dark mode translucide */
  background: color-mix(in srgb, var(--bg) 92%, transparent);

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
  width: 90px;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-soft); /* 🔥 FIX */
}

.category-block {
  display: flex;
  flex-direction: column;
  gap: 6px; /* espace léger global */
}

/* vraie séparation visuelle */
.subcategory-row {
  margin-top: 6px;
  padding-left: 110px; /* 🔥 aligne avec les chips (important) */
}

/* Primary group */
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
   3️⃣ HEADER BAND
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
   4️⃣ TOTAL
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

.followup-grid {
  display: grid;
  grid-template-columns:
    220px
    1fr
    90px
    90px;
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
   6️⃣ CONTROLS
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
  transition: all 0.15s ease;
}

.year-segment.active {
  background: var(--primary-soft);
  border: 1px solid var(--primary);
  color: var(--primary);
  opacity: 1;

  /* 🔥 FIX shadow */
  box-shadow: var(--shadow-sm);
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
  transition: all 0.15s ease;
}

.scope-btn.active {
  background: var(--primary-soft);
  border-color: var(--primary);
  color: var(--primary);
  opacity: 1;

  /* 🔥 FIX shadow */
  box-shadow: var(--shadow-sm);
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
  transition: all 0.15s ease;
}

.chip:hover {
  opacity: 0.9;
}

.chip.active {
  opacity: 1;
  background: var(--primary-soft);
  border-color: var(--primary);
  color: var(--primary); /* 🔥 FIX */
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