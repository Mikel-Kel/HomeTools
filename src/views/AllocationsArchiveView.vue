<script setup lang="ts">
import { ref, computed, watch } from "vue";
import PageHeader from "@/components/PageHeader.vue";
import { onMounted } from "vue";
import { listFilesInFolder } from "@/services/google/googleDrive";
import { loadJSONFromFolder } from "@/services/google/driveRepository";
import { useDrive } from "@/composables/useDrive";
import { useCategories } from "@/composables/useCategories";
import { useBanks } from "@/composables/useBanks";

/* =========================
   Types (vue interne)
========================= */
export type ArchivedAllocationView = {
  spendingId: string;

  bankID: string;
  bankLabel: string;

  allocationId: string;
  allocationDate: string;
  amount: number;

  categoryID: number;
  categoryLabel: string;

  subCategoryID: number | null;
  subCategoryLabel: string | null;

  allocatedTagID: number | null;
  comment: string;

  processedAt: string;
};

/* =========================
   State
========================= */
const records = ref<ArchivedAllocationView[]>([]);
const { driveState } = useDrive();
const categoriesStore = useCategories();
const banksStore = useBanks();

/* =========================
   Filters
========================= */
const filtersOpen = ref(false);

const dateFrom = ref("");
const dateTo = ref("");

const minAmount = ref<number | null>(null);
const maxAmount = ref<number | null>(null);

const bankFilter = ref<Set<string>>(new Set());
const categoryFilter = ref<Set<number>>(new Set());
const subCategoryFilter = ref<Set<number>>(new Set());

/* =========================
   Chips sources
========================= */

// Banks (depuis banksStore)
const availableBanks = computed(() =>
  banksStore.banks.value
    .map(b => ({
      id: b.bankID,
      label: b.label,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
);

// Categories (depuis categoriesStore)
const availableCategories = computed(() =>
  categoriesStore.categories.value
    .map(c => ({
      id: c.id,
      label: c.label,
      subcategories: c.subcategories,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
);

// SubCategories dépendantes des catégories sélectionnées
const availableSubCategories = computed(() => {
  // aucune catégorie sélectionnée → aucune sous-cat affichée
  if (!categoryFilter.value.size) return [];

  return categoriesStore.categories.value
    .filter(c => categoryFilter.value.has(c.id))
    .flatMap(c =>
      c.subcategories.map(sc => ({
        id: sc.id,
        label: sc.label,
        categoryID: c.id,
      }))
    )
    .sort((a, b) => a.label.localeCompare(b.label));
});

/* =========================
  Helpers
========================= */
function toggleSet<T>(set: Set<T>, value: T) {
  set.has(value) ? set.delete(value) : set.add(value);
}

function resolveBank(spendingId: string) {
  const bankID = spendingId.slice(0, 3);

  return banksStore.banks.value.find(
    b => b.bankID === bankID
  ) ?? null;
}

function resolveCategory(categoryID: number) {
  return categoriesStore.categories.value.find(
    c => c.id === categoryID
  ) ?? null;
}

function resolveSubCategory(
  categoryID: number,
  subCategoryID: number | null
) {
  if (subCategoryID === null) return null;

  const cat = resolveCategory(categoryID);
  return cat?.subcategories.find(
    sc => sc.id === subCategoryID
  ) ?? null;
}

function applyFilters(list: ArchivedAllocationView[]) {
  return list.filter(r => {
    if (dateFrom.value && r.allocationDate < dateFrom.value)
      return false;
    if (dateTo.value && r.allocationDate > dateTo.value)
      return false;

    const abs = Math.abs(r.amount);
    if (minAmount.value !== null && abs < minAmount.value)
      return false;
    if (maxAmount.value !== null && abs > maxAmount.value)
      return false;

    if (bankFilter.value.size &&
        !bankFilter.value.has(r.bankID))
      return false;

    if (categoryFilter.value.size &&
        !categoryFilter.value.has(r.categoryID))
      return false;

    if (subCategoryFilter.value.size &&
        r.subCategoryID !== null &&
        !subCategoryFilter.value.has(r.subCategoryID))
      return false;

    return true;
  });
}

/* =========================
   Computed
========================= */
const filteredRecords = computed(() => {
  return applyFilters(records.value)
    .slice() // copie défensive
    .sort((a, b) => {
      // 1️⃣ date décroissante
      if (a.allocationDate !== b.allocationDate) {
        return b.allocationDate.localeCompare(a.allocationDate);
      }

      // 2️⃣ montant décroissant (valeur absolue)
      return Math.abs(b.amount) - Math.abs(a.amount);
    });
});

/* =========================
   Formatting
========================= */
function formatAmount(amount: number) {
  const sign = amount > 0 ? "+" : "";
  return (
    sign +
    amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString();


async function loadArchivedAllocations() {
  const folderId =
    driveState.value!.folders.allocations.archived;

  const files = await listFilesInFolder(folderId);

  const out: ArchivedAllocationView[] = [];

  for (const f of files) {
    if (!f.name.endsWith(".json")) continue;

    const raw = await loadJSONFromFolder<any>(
      folderId,
      f.name
    );
    if (!raw) continue;

    const spendingId = raw.spendingId;
    const processedAt = raw.processedAt;

    const bank = resolveBank(spendingId);

    for (const a of raw.allocations ?? []) {
      const category = resolveCategory(a.categoryID);
      const subCategory = resolveSubCategory(
        a.categoryID,
        a.subCategoryID
      );

      out.push({
        spendingId,

        bankID: bank?.bankID ?? "unknown",
        bankLabel: bank?.label ?? "Unknown bank",

        allocationId: a.id,
        allocationDate: a.allocationDate,
        amount: a.amount,

        categoryID: a.categoryID,
        categoryLabel: category?.label ?? "Unknown category",

        subCategoryID: a.subCategoryID,
        subCategoryLabel: subCategory?.label ?? null,

        allocatedTagID: a.allocatedTagID ?? null,
        comment: a.comment ?? "",

        processedAt,
      });
    }
  }

  records.value = out;
}
watch(categoryFilter, () => {
  // ids valides selon catégories actives
  const validSubIds = new Set(
    availableSubCategories.value.map(sc => sc.id)
  );

  // purge des sous-catégories non pertinentes
  for (const id of subCategoryFilter.value) {
    if (!validSubIds.has(id)) {
      subCategoryFilter.value.delete(id);
    }
  }
});

onMounted(async () => {
  await Promise.all([
    categoriesStore.load?.(),
    banksStore.load?.(),
  ]);

  await loadArchivedAllocations();
});
</script>

<template>
  <PageHeader title="Archives" icon="folder" />

  <div class="archives-scroll">

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
        <!-- Date -->
        <div class="filter-row">
          <span class="label">Date</span>
          <input type="date" v-model="dateFrom" />
          <input type="date" v-model="dateTo" />
        </div>

        <!-- Amount -->
        <div class="filter-row">
          <span class="label">Amount</span>
          <input type="number" v-model.number="minAmount" placeholder="Min" />
          <input type="number" v-model.number="maxAmount" placeholder="Max" />
        </div>

        <!-- Bank / Category filters -->
        <!-- Bank -->
        <div class="filter-row">
          <span class="label">Bank</span>
          <button
            v-for="b in availableBanks"
            :key="b.id"
            class="chip"
            :class="{ active: bankFilter.has(b.id) }"
            @click="toggleSet(bankFilter, b.id)"
          >
            {{ b.label }}
          </button>
        </div>

        <!-- Category -->
        <div class="filter-row">
          <span class="label">Category</span>
          <button
            v-for="c in availableCategories"
            :key="c.id"
            class="chip"
            :class="{ active: categoryFilter.has(c.id) }"
            @click="toggleSet(categoryFilter, c.id)"
          >
            {{ c.label }}
          </button>
        </div>

        <!-- SubCategory (contextual) -->
        <div
          v-if="availableSubCategories.length"
          class="filter-row"
        >
          <span class="label">Sub</span>
          <button
            v-for="sc in availableSubCategories"
            :key="sc.id"
            class="chip"
            :class="{ active: subCategoryFilter.has(sc.id) }"
            @click="toggleSet(subCategoryFilter, sc.id)"
          >
            {{ sc.label }}
          </button>
        </div>
      </div>
    </section>

    <!-- Table -->
    <table class="archives-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Bank</th>
          <th>Category</th>
          <th>Comment</th>
          <th class="right">Amount</th>
        </tr>
      </thead>

      <tbody>
        <tr
          v-for="r in filteredRecords"
          :key="r.allocationId"
        >
          <td>{{ formatDate(r.allocationDate) }}</td>
          <td>{{ r.bankLabel }}</td>
          <td>
            {{ r.categoryLabel }}
            <span v-if="r.subCategoryLabel">
              › {{ r.subCategoryLabel }}
            </span>
          </td>
          <td class="comment">
            {{ r.comment || "(no comment)" }}
          </td>
          <td class="right">
            {{ formatAmount(r.amount) }}
          </td>
        </tr>
      </tbody>
    </table>

  </div>
</template>

<style scoped>
.archives-scroll {
  padding: 1rem;
  background: var(--bg);
}

.filters {
  margin-bottom: 1rem;
}

.filters-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filters-body {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.label {
  width: 70px;
  opacity: 0.7;
}

.archives-table {
  width: 100%;
  border-collapse: collapse;
}

.archives-table th,
.archives-table td {
  padding: 8px;
  border-bottom: 1px solid var(--border);
}

.archives-table tbody tr:nth-child(even) {
  background: var(--surface-soft);
}

.right {
  text-align: right;
}

.comment {
  opacity: 0.8;
}

.arrow {
  opacity: 0.6;
}

.hint {
  font-size: var(--font-size-sm);
  opacity: 0.6;
}
</style>