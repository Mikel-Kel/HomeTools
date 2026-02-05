<script setup lang="ts">
import { ref, computed, watch } from "vue";

import PageHeader from "@/components/PageHeader.vue";
import FollowUpChartView from "@/components/followup/FollowUpChart.vue";
import CategorySheet from "@/components/followup/CategorySheet.vue";

import { useDrive } from "@/composables/useDrive";
import { listFilesInFolder, readJSON } from "@/services/google/googleDrive";

import { useCategories } from "@/composables/useCategories";

/* =========================
   Follow-Up JSON types
========================= */

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

/* =========================
   Header state
========================= */

const year = ref<number>(2026);

/**
 * "*" → toutes les catégories
 * "<id>" → catégorie sélectionnée
 */
const selectedCategory = ref<string>("*");
const categorySheetOpen = ref(false);

/* =========================
   Categories (settings/categories.json)
========================= */

const categoriesStore = useCategories();

/* =========================
   Drive / FollowUp.json (allocations.root)
========================= */

const { driveState } = useDrive();
const followUpRaw = ref<FollowUpFile | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

async function loadFollowUp(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const folderId = driveState.value!.folders.allocations.budgetusage;
    const files = await listFilesInFolder(folderId);
    const file = files.find(f => f.name === "FollowUp.json");

    if (!file) {
      throw new Error("FollowUp.json not found in allocations folder");
    }

    const raw = await readJSON<FollowUpFile>(file.id);

    if (!raw || !Array.isArray(raw.categories)) {
      throw new Error("Invalid FollowUp.json format");
    }

    followUpRaw.value = raw;
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
   Categories list for sheet
========================= */
const categories = computed(() =>
  categoriesStore.categories.value
    .slice()
    .sort((a, b) => a.seq - b.seq)
    .map(c => ({
      id: String(c.id),
      label: c.label,
    }))
);

/* =========================
   Budgets helpers
   (FROM categories.json ONLY)
========================= */

function getCategoryBudget(
  categoryId: number,
  year: number
): number | undefined {
  const cat = categoriesStore.getCategory(categoryId);
  if (!cat || !("budgets" in cat)) return undefined;

  return cat.budgets
    ?.find(b => b.year === year)
    ?.items?.[0]?.budget;
}

function getSubCategoryBudget(
  subId: number,
  year: number
): number | undefined {
  for (const cat of categoriesStore.categories.value) {
    const sub = cat.subcategories.find(s => s.id === subId);
    if (!sub || !("budgets" in sub)) continue;

    return sub.budgets
      ?.find(b => b.year === year)
      ?.items?.[0]?.budget;
  }
}

/* =========================
   Chart items (CORE LOGIC)
========================= */

const items = computed(() => {
  if (!followUpRaw.value) return [];

  const y = year.value;

  /* ===== MODE : CATEGORIES ===== */
  if (selectedCategory.value === "*") {
    return followUpRaw.value.categories
      .map(cat => {
        const yearData = cat.years.find(v => v.year === y);
        if (!yearData) return null;

        const amount = yearData.items.reduce(
          (sum, i) => sum + i.amount,
          0
        );

        const meta = categoriesStore.getCategory(cat.categoryId);
        if (!meta) return null;

        return {
          id: String(cat.categoryId),
          label: meta.label,
          amount,
          budget: getCategoryBudget(cat.categoryId, y),
        };
      })
      .filter(
        (v): v is NonNullable<typeof v> => v !== null
      );
  }

  /* ===== MODE : SOUS-CATEGORIES ===== */
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
      const sub = metaCat.subcategories.find(
        s => s.id === i.subCategoryId
      );
      if (!sub) return null;

      return {
        id: String(sub.id),
        label: sub.label,
        amount: i.amount,
        budget: getSubCategoryBudget(sub.id, y),
      };
    })
    .filter(
      (v): v is NonNullable<typeof v> => v !== null
    );
});

/* =========================
   Scale (auto)
========================= */

const scale = computed(() => {
  const values = items.value.flatMap(i => [
    i.amount,
    i.budget ?? 0,
  ]);

  return {
    min: 0,
    max: Math.max(0, ...values),
  };
});

/* =========================
   UI helpers
========================= */

const selectedCategoryLabel = computed(() => {
  if (selectedCategory.value === "*") {
    return "All categories";
  }

  const cat = categoriesStore.getCategory(
    Number(selectedCategory.value)
  );
  return cat?.label ?? "Category";
});

const mode = computed<"category" | "subcategory">(() =>
  selectedCategory.value === "*" ? "category" : "subcategory"
);
</script>

<template>
  <PageHeader title="Follow-up" icon="followup" />

  <div class="followup-header">
    <div class="control">
      <label>Year</label>
      <select v-model.number="year">
        <option :value="year - 1">{{ year - 1 }}</option>
        <option :value="year">{{ year }}</option>
        <option :value="year + 1">{{ year + 1 }}</option>
      </select>
    </div>

    <div class="control grow">
      <label>Category</label>
      <button
        class="sheet-trigger"
        @click="categorySheetOpen = true"
      >
        {{ selectedCategoryLabel }}
      </button>
    </div>
  </div>

  <div class="followup-view">
    <div v-if="loading" class="info">Loading…</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <FollowUpChartView
      v-else
      :items="items"
      :scale="scale"
      :mode="mode"
    />
  </div>

  <CategorySheet
    v-model="selectedCategory"
    :open="categorySheetOpen"
    :categories="categories"
    @close="categorySheetOpen = false"
  />
</template>

<style scoped>
.followup-header {
  display: flex;
  gap: 1rem;
  padding: 0.75rem 1.5rem;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}

.control {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.control.grow {
  flex: 1;
}

.control label {
  font-size: 0.75rem;
  font-weight: 600;
  opacity: 0.7;
}

.control select {
  font-size: 1rem;
  padding: 0.4rem 0.5rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
}

.sheet-trigger {
  width: 100%;
  text-align: left;
  padding: 0.4rem 0.5rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 1rem;
}

.followup-view {
  padding: 1.5rem;
  background: var(--bg);
  color: var(--text);
}

.info {
  opacity: 0.6;
}

.error {
  color: var(--negative);
  font-weight: 600;
}
</style>