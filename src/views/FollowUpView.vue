<script setup lang="ts">
import { ref, computed, watch } from "vue";

import PageHeader from "@/components/PageHeader.vue";
import FollowUpBar from "@/components/followup/FollowUpBar.vue";
import CategorySheet from "@/components/followup/CategorySheet.vue";

import { useDrive } from "@/composables/useDrive";
import { listFilesInFolder, readJSON } from "@/services/google/googleDrive";
import { useCategories } from "@/composables/useCategories";

/* =========================
   Types
========================= */
type RawItem =
  | {
      id: string;
      label: string;
      amount: number;
      budget?: number;
    }
  | null;


interface FollowUpYearItem {
  subCategoryId: number;
  amount: number;
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
const categorySheetOpen = ref(false);

const year = ref<number>(2026);
const categoriesStore = useCategories();

const selectedCategory = ref<string>("*");
const selectedSubCategory = ref<string | null>(null);

const followUpRaw = ref<FollowUpFile | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

  /* =========================
   Filters (Follow-up)
========================= */
const filtersOpen = ref(false);

/* =========================
   Helpers UI
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

const activeCategory = computed(() =>
  selectedCategory.value === "*"
    ? null
    : categoriesStore.getCategory(Number(selectedCategory.value))
);

const categoryChips = computed(() =>
  categoriesStore.categories.value
    .slice()
    .sort((a, b) => a.seq - b.seq)
);

const subCategoryChips = computed(() => {
  if (!activeCategory.value) return [];
  return activeCategory.value.subcategories
    .slice()
    .sort((a, b) => a.seq - b.seq);
});

const selectedCategoryLabel = computed(() => {
  if (selectedCategory.value === "*") {
    return "All categories";
  }

  const cat = categoriesStore.getCategory(
    Number(selectedCategory.value)
  );
  return cat?.label ?? "Category";
});

/* =========================
   Mode
========================= */
const mode = computed<"category" | "subcategory">(() =>
  selectedCategory.value === "*" ? "category" : "subcategory"
);

/* =========================
   Available years
   (from categories.json ONLY)
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

    if (!file) {
      throw new Error("FollowUp.json not found");
    }

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
  async (state) => {
    if (!state) return;

    if (!categoriesStore.categories.value.length) {
      await categoriesStore.load();
    }

    await loadFollowUp();
  },
  { immediate: true }
);

/* =========================
   Normalize items (CORE)
========================= */
const items = computed<FollowUpItem[]>(() => {
  if (!followUpRaw.value) return [];

  const y = year.value;

  const rawItems: RawItem[] =
    followUpRaw.value.categories.map(cat => {
      const yearData = cat.years.find(v => v.year === y);
      if (!yearData) return null;

      const meta = categoriesStore.getCategory(cat.categoryId);
      if (!meta) return null;

      const amount = yearData.items.reduce(
        (sum, i) => sum + i.amount,
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
    });

  return rawItems.filter(
    (v): v is FollowUpItem => v !== null
  );
});

/* =========================
   Scale (defensive)
========================= */
const scale = computed(() => {
  if (!items.value.length) {
    return { min: 0, max: 0 };
  }

  const values = items.value.flatMap(i => [
    i.amount,
    i.budget ?? 0,
  ]);

  return {
    min: 0,
    max: Math.max(0, ...values),
  };
});
</script>

<template>
  <PageHeader title="Follow-up" icon="followup" />

  <!-- Sticky filters zone -->
<!-- Sticky zone (Filters) -->
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
        <select v-model.number="year">
          <option
            v-for="y in availableYears"
            :key="y"
            :value="y"
          >
            {{ y }}
          </option>
        </select>
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
<hr class="followup-separator" />

  <!-- Content -->
  <div class="followup-view">
    <div v-if="loading" class="info">Loading…</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <div v-else class="followup-table">
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
            :item="item"
            :scale="scale"
          />
        </div>

        <!-- Budget -->
        <div class="budget">
          <span v-if="item.budget !== undefined">
            {{ item.budget.toLocaleString() }}
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

.label {
  width: 70px;
  opacity: 0.7;
  flex: 0 0 auto;
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
  grid-template-columns: 220px 1fr 120px;
  align-items: center;
  column-gap: 16px;
}

.label {
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chart {
  height: 20px;
}

.budget {
  text-align: right;
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