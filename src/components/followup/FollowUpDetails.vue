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
  if (props.subCategoryId === null) {
    raw.value = null;
    return;
  }

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
  return n.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/* =========================
   Filtered items
========================= */
const items = computed<FollowUpDetailItem[]>(() => {
  if (!raw.value || props.subCategoryId === null) return [];

  return raw.value.items
    .filter(it => {
      if (
        props.categoryIds.length &&
        !props.categoryIds.includes(it.categoryId)
      ) {
        return false;
      }
      return it.subCategoryId === props.subCategoryId;
    })
    .sort((a, b) =>
      b.allocationDate.localeCompare(a.allocationDate)
    );
});
</script>

<template>
  <section
    v-if="props.subCategoryId !== null"
    class="details"
  >
    <div v-if="loading" class="muted">Loading…</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <div v-else class="table">

      <!-- HEADER -->

      <!-- ROWS -->
      <div
        v-for="(it, idx) in items"
        :key="idx"
        class="grid row"
      >
        <div class="col-label date">
          {{ it.allocationDate }}
        </div>

        <div class="col-bar">
          <div class="desc">
            {{ it.description || "—" }}
          </div>
          <div class="sub muted">
            {{ subCategoryLabel(it.categoryId, it.subCategoryId) }}
          </div>
        </div>

        <div class="col-spent amount">
          {{ fmt(it.amount) }}
        </div>

        <!-- 🔑 COLUMN FANTÔME -->
        <div class="col-budget"></div>
      </div>

      <div v-if="!items.length" class="muted empty">
        No allocations for this selection
      </div>

    </div>
  </section>
</template>

<style scoped>
.details {
  margin-top: 0px;
  padding-top: 2px;
}

/* =========================================================
   SAME GRID AS FOLLOWUPVIEW (CRITICAL)
========================================================= */
.grid {
  display: grid;
  grid-template-columns:
    220px   /* label */
    1fr     /* bar / description */
    100px    /* spent */
    80px;   /* budget (ghost) */
  column-gap: 16px;
  align-items: center;
}

/* =========================================================
   Header
========================================================= */
.header {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-soft);
  border-bottom: 1px solid var(--border);
  padding-bottom: 6px;
  margin-bottom: 6px;
}

.col-spent {
  text-align: right;
}

/* =========================================================
   Rows
========================================================= */
.row {
  padding: 3px 0;
}

.date {
  font-weight: 600;
  text-align: right;
  font-size: 0.8rem;
  color: var(--text-soft);
}

.sub {
  font-weight: 400;
  font-size: 0.75rem;
}

.desc {
  font-size: 0.8rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.amount {
  text-align: right;
  font-weight: 700;
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
}

.col-budget {
  /* intentionally empty */
}

.muted {
  opacity: 0.4;
}

.error {
  color: var(--danger, #d64545);
  font-size: 0.8rem;
}

.empty {
  padding: 12px 0;
}
</style>