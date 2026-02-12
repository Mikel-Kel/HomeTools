<script setup lang="ts">
import { ref, computed, watch } from "vue";

import { listFilesInFolder, readJSON } from "@/services/google/googleDrive";
import { useDrive } from "@/composables/useDrive";
import { useCategories } from "@/composables/useCategories";

/* =========================
   Types
========================= */
interface FollowUpDetailItem {
  categoryId: number;
  subCategoryId: number;
  allocationDate: string;
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
   Props (budget + nature come from parent)
========================= */
const props = defineProps<{
  year: number;
  categoryIds: number[];
  subCategoryId: number | null;
  monthlyBudgetMap?: Record<string, number>;
  nature?: "E" | "I" | null;
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

watch(
  () => [props.year, props.categoryIds, props.subCategoryId],
  loadDetails,
  { immediate: true }
);

/* =========================
   Helpers
========================= */
function subCategoryLabel(categoryId: number, subCategoryId: number): string {
  const cat = categoriesStore.getCategory(categoryId);
  return (
    cat?.subcategories.find(s => s.id === subCategoryId)?.label ??
    `#${subCategoryId}`
  );
}

function monthlyBudgetFor(key: string): number | null {
  if (!props.monthlyBudgetMap) return null;
  const b = props.monthlyBudgetMap[key];
  return b ?? null;
}

function fmt(n: number): string {
  return n.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("en-GB");
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
      ) return false;

      return it.subCategoryId === props.subCategoryId;
    })
    .sort((a, b) =>
      b.allocationDate.localeCompare(a.allocationDate)
    );
});

/* =========================
   Monthly aggregation
========================= */
interface MonthGroup {
  key: string;
  label: string;
  total: number;
  items: FollowUpDetailItem[];
}

function monthKey(date: string) {
  return date.slice(0, 7); // YYYY-MM
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

const monthlyGroups = computed<MonthGroup[]>(() => {
  const map = new Map<string, FollowUpDetailItem[]>();

  for (const it of items.value) {
    const key = monthKey(it.allocationDate);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(it);
  }

  const groups: MonthGroup[] = [];

  for (const [key, list] of map.entries()) {
    groups.push({
      key,
      label: monthLabel(key),
      total: list.reduce((s, i) => s + i.amount, 0),
      items: list.sort((a, b) =>
        b.allocationDate.localeCompare(a.allocationDate)
      ),
    });
  }

  return groups.sort((a, b) => b.key.localeCompare(a.key));
});

/* =========================
   Collapse logic
========================= */
const openMonths = ref<Set<string>>(new Set());

watch(monthlyGroups, groups => {
  if (!groups.length) return;
  openMonths.value = new Set([groups[0].key]);
});

function toggleMonth(key: string) {
  if (openMonths.value.has(key)) openMonths.value.delete(key);
  else openMonths.value.add(key);
}

/* =========================
   Status class (uses parent data safely)
========================= */
function monthStatusClass(key: string, total: number): string {
  if (!props.monthlyBudgetMap || !props.nature) {
    return "neutral";
  }

  const budget = props.monthlyBudgetMap[key];

  if (budget === undefined || budget === null) {
    return "neutral";
  }

  if (props.nature === "E") {
    return total > budget ? "over" : "neutral";
  }

  if (props.nature === "I") {
    return total > budget ? "under" : "neutral";
  }

  return "neutral";
}
</script>

<template>
<section v-if="props.subCategoryId !== null" class="details">
  <div v-if="loading" class="muted">Loading…</div>
  <div v-else-if="error" class="error">{{ error }}</div>

  <div v-else class="table">

    <div
      v-for="group in monthlyGroups"
      :key="group.key"
      class="month-block"
    >

      <!-- MONTH HEADER -->
      <div
        class="grid month-header"
        @click="toggleMonth(group.key)"
      >
        <div class="col-label month-toggle">
          <span class="arrow">
            {{ openMonths.has(group.key) ? "▼" : "►" }}
          </span>
          {{ group.label }}
        </div>

        <div></div>

        <!-- TOTAL -->
        <div
          class="col-spent amount"
          :class="monthStatusClass(group.key, group.total)"
        >
          {{ fmt(group.total) }}
        </div>

        <!-- 🔑 MONTHLY BUDGET -->
        <div class="col-budget amount muted">
          <span v-if="monthlyBudgetFor(group.key) !== null">
            {{ fmtInt(monthlyBudgetFor(group.key)!) }}
          </span>
          <span v-else>—</span>
        </div>
      </div>

      <!-- DETAILS -->
      <div v-if="openMonths.has(group.key)">
        <div
          v-for="(it, idx) in group.items"
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

          <div class="col-budget"></div>
        </div>
      </div>

    </div>

    <div v-if="!items.length" class="muted empty">
      No allocations for this selection
    </div>

  </div>
</section>
</template>

<style scoped>
.details { padding-top: 2px; }

.grid {
  display: grid;
  grid-template-columns: 220px 1fr 100px 80px;
  column-gap: 16px;
  align-items: center;
}

.month-header {
  cursor: pointer;
  font-weight: 600;
  border-top: 1px solid var(--border);
  padding: 6px 0;
  font-size: 0.8rem;
  font-style: italic;
}
.month-header .col-budget {
  padding-right: 12px;
}

.month-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
}

.month-header:hover {
  background: rgba(0,0,0,0.03);
}

.month-header .amount.over {
  color: #d64545;
}

.month-header .amount.under {
  color: #2e8b57;
}

.month-header .amount.neutral {
  color: var(--text-soft);
}

.row { padding: 3px 0; }

.date {
  font-weight: 600;
  text-align: right;
  font-size: 0.8rem;
  color: var(--text-soft);
}

.sub { font-size: 0.75rem; }

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

.muted { opacity: 0.4; }
.error { color: var(--danger, #d64545); font-size: 0.8rem; }
.empty { padding: 12px 0; }
</style>