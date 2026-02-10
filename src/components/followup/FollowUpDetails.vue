<script setup lang="ts">
import { ref, computed, watch } from "vue";

import { listFilesInFolder, readJSON } from "@/services/google/googleDrive";
import { useDrive } from "@/composables/useDrive";
import { useCategories } from "@/composables/useCategories";

/* =========================
   Types (JSON exact)
========================= */
interface FollowUpDetailItem {
  categoryId: number;
  subCategoryId: number;
  allocationDate: string; // YYYY-MM-DD
  amount: number;
  description: string;
  partyId: number | null;
  tagId: number | null;
}

interface FollowUpDetailsFile {
  version?: number;
  updatedAt?: string;
  year: number;
  items: FollowUpDetailItem[];
}

/* =========================
   Props
========================= */
const props = defineProps<{
  year: number;
  categoryIds: number[];
  subCategoryId: number | null;
}>();

/* =========================
   State
========================= */
const { driveState } = useDrive();
const categoriesStore = useCategories();

const raw = ref<FollowUpDetailsFile | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

/* =========================
   Load JSON
========================= */
async function loadDetails() {
  loading.value = true;
  error.value = null;

  try {
    const folderId = driveState.value!.folders.allocations.budget;

    const files = await listFilesInFolder(folderId);
    const file = files.find(
      f => f.name === `FollowUpDetails-${props.year}.json`
    );
    if (!file) {
      throw new Error(`FollowUpDetails-${props.year}.json not found`);
    }

    raw.value = await readJSON<FollowUpDetailsFile>(file.id);
  } catch (e: any) {
    error.value = e?.message ?? "Unable to load FollowUpDetails";
    raw.value = null;
  } finally {
    loading.value = false;
  }
}

/* =========================
   Reload on context change
========================= */
watch(
  () => [props.year, props.categoryIds, props.subCategoryId],
  loadDetails,
  { immediate: true }
);

/* =========================
   Helpers
========================= */
function categoryLabel(categoryId: number): string {
  return (
    categoriesStore.getCategory(categoryId)?.label ??
    `#${categoryId}`
  );
}

function subCategoryLabel(
  categoryId: number,
  subCategoryId: number
): string {
  const cat = categoriesStore.getCategory(categoryId);
  return (
    cat?.subcategories.find(s => s.id === subCategoryId)?.label ??
    `#${subCategoryId}`
  );
}

function fmt(n: number): string {
  return n.toLocaleString("fr-CH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/* =========================
   Filtered items
========================= */
const items = computed<FollowUpDetailItem[]>(() => {
  if (!raw.value) return [];

  return raw.value.items
    .filter(it => {
      if (
        props.categoryIds.length &&
        !props.categoryIds.includes(it.categoryId)
      ) {
        return false;
      }

      if (
        props.subCategoryId !== null &&
        it.subCategoryId !== props.subCategoryId
      ) {
        return false;
      }

      return true;
    })
    .sort((a, b) =>
      b.allocationDate.localeCompare(a.allocationDate)
    );
});
</script>

<template>
  <section class="details">

    <h3 class="title">Allocations details</h3>

    <div v-if="loading" class="muted">Loading…</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <div v-else class="table">

      <div
        v-for="(it, idx) in items"
        :key="idx"
        class="row"
      >
        <div class="date">
          {{ it.allocationDate }}
        </div>

        <div class="labels">
          <div class="sub">
            {{ subCategoryLabel(it.categoryId, it.subCategoryId) }}
          </div>
          <div class="cat muted">
            {{ categoryLabel(it.categoryId) }}
          </div>
        </div>

        <div class="desc muted">
          {{ it.description || "—" }}
        </div>

        <div class="amount">
          {{ fmt(it.amount) }}
        </div>
      </div>

      <div v-if="!items.length" class="muted empty">
        No allocations for this selection
      </div>

    </div>
  </section>
</template>

<style scoped>
.details {
  margin-top: 24px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.title {
  font-size: 0.9rem;
  font-weight: 700;
  margin-bottom: 10px;
}

.table {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.row {
  display: grid;
  grid-template-columns:
    90px
    180px
    1fr
    80px;
  gap: 12px;
  align-items: center;
}

.date {
  font-size: 0.75rem;
  color: var(--text-soft);
}

.labels {
  display: flex;
  flex-direction: column;
}

.sub {
  font-weight: 600;
  font-size: 0.8rem;
}

.cat {
  font-size: 0.7rem;
}

.desc {
  font-size: 0.75rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.amount {
  text-align: right;
  font-weight: 700;
  font-size: 0.8rem;
}

.muted {
  opacity: 0.5;
}

.error {
  color: var(--danger, #d64545);
  font-size: 0.8rem;
}

.empty {
  padding: 12px 0;
}
</style>