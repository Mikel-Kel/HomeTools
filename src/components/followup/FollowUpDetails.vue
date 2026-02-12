<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { listFilesInFolder, readJSON } from "@/services/google/googleDrive";
import { useDrive } from "@/composables/useDrive";
import { useCategories } from "@/composables/useCategories";

/* =========================================================
   TYPES
========================================================= */
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

interface MonthGroup {
  key: string;          // YYYY-MM
  label: string;
  total: number;
  items: FollowUpDetailItem[];
}

/* =========================================================
   PROPS
========================================================= */
const props = defineProps<{
  year: number;
  categoryIds: number[];
  subCategoryId: number | null;
  monthlyBudgetMap?: Record<string, number>;
  nature?: "E" | "I" | null;
  maxMonth?: number | null;
}>();

/* =========================================================
   STATE
========================================================= */
const { driveState } = useDrive();
const categoriesStore = useCategories();

const raw = ref<FollowUpDetailsFile | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

/* =========================================================
   LOAD
========================================================= */
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

/* =========================================================
   HELPERS
========================================================= */
function fmt(n: number) {
  return n.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtInt(n: number) {
  return Math.round(n).toLocaleString("en-GB");
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

function subCategoryLabel(catId: number, subId: number) {
  const cat = categoriesStore.getCategory(catId);
  return (
    cat?.subcategories.find(s => s.id === subId)?.label ??
    `#${subId}`
  );
}

/* =========================================================
   FILTERED ITEMS
========================================================= */
const filteredItems = computed(() => {
  if (!raw.value || props.subCategoryId === null) return [];

  return raw.value.items
    .filter(it => {
      if (
        props.categoryIds.length &&
        !props.categoryIds.includes(it.categoryId)
      ) return false;

      if (it.subCategoryId !== props.subCategoryId) return false;

      // 🔥 Scope filter (MTD)
      if (props.maxMonth != null) {
        const month = Number(it.allocationDate.slice(5, 7));
        if (month > props.maxMonth) return false;
      }

      return true;
    })
    .sort((a, b) =>
      b.allocationDate.localeCompare(a.allocationDate)
    );
});

/* =========================================================
   MONTHLY GROUPS
========================================================= */
const monthlyGroups = computed<MonthGroup[]>(() => {
  const map = new Map<string, FollowUpDetailItem[]>();

  for (const it of filteredItems.value) {
    const key = monthKey(it.allocationDate);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(it);
  }

  return Array.from(map.entries())
    .map(([key, list]) => ({
      key,
      label: monthLabel(key),
      total: list.reduce((s, i) => s + i.amount, 0),
      items: list.sort((a, b) =>
        b.allocationDate.localeCompare(a.allocationDate)
      ),
    }))
    .sort((a, b) => b.key.localeCompare(a.key));
});

/* =========================================================
   COLLAPSE
========================================================= */
const openMonths = ref<Set<string>>(new Set());

watch(monthlyGroups, groups => {
  if (groups.length) {
    openMonths.value = new Set([groups[0].key]);
  }
});

function toggleMonth(key: string) {
  if (openMonths.value.has(key)) {
    openMonths.value.delete(key);
  } else {
    openMonths.value.add(key);
  }
}

/* =========================================================
   STATUS
========================================================= */
function monthStatusClass(key: string, total: number) {
  if (!props.monthlyBudgetMap || !props.nature) return "neutral";

  const budget = props.monthlyBudgetMap[key];
  if (budget == null) return "neutral";

  if (props.nature === "E") {
    return total > budget ? "over" : "neutral";
  }

  if (props.nature === "I") {
    return total < budget ? "under" : "neutral";
  }

  return "neutral";
}
</script>

<template>
<section v-if="props.subCategoryId !== null" class="details">

  <div v-if="loading" class="muted">Loading…</div>
  <div v-else-if="error" class="error">{{ error }}</div>

  <div v-else>

    <div
      v-for="group in monthlyGroups"
      :key="group.key"
      class="month-block"
    >

      <!-- Month header -->
      <div
        class="grid month-header"
        @click="toggleMonth(group.key)"
      >
        <div class="col-label month-toggle">
          <span>{{ openMonths.has(group.key) ? "▼" : "►" }}</span>
          {{ group.label }}
        </div>

        <div></div>

        <div
          class="col-spent amount"
          :class="monthStatusClass(group.key, group.total)"
        >
          {{ fmt(group.total) }}
        </div>

        <div class="col-budget amount">
          <span v-if="props.monthlyBudgetMap?.[group.key] != null">
            {{ fmtInt(props.monthlyBudgetMap[group.key]) }}
          </span>
          <span v-else>—</span>
        </div>
      </div>

      <!-- Month rows -->
      <div v-if="openMonths.has(group.key)">
        <div
          v-for="(it, idx) in group.items"
          :key="idx"
          class="grid row"
        >
          <div class="col-label date">
            {{ it.allocationDate }}
          </div>

          <div>
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

          <div></div>
        </div>
      </div>

    </div>

    <div v-if="!filteredItems.length" class="muted empty">
      No allocations for this selection
    </div>

  </div>
</section>
</template>

<style scoped>
/* =========================================================
   Container
========================================================= */
.details {
  padding-top: 2px;
}

/* =========================================================
   Grid layout
========================================================= */
.grid {
  display: grid;
  grid-template-columns: 220px 1fr 100px 80px;
  column-gap: 16px;
  align-items: center;
}

/* =========================================================
   Month header
========================================================= */
.month-header {
  cursor: pointer;
  font-weight: 600;
  border-top: 1px solid var(--border);
  padding: 6px 0;
  font-size: 0.8rem;
  font-style: italic;
  color: var(--primary);
  opacity: 0.85;
}

.month-header:hover {
  background: rgba(0,0,0,0.03);
}

.month-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* =========================================================
   Month header – budget status override
========================================================= */

.month-header .col-spent.amount.over {
  color: var(--danger, #d64545);
}

.month-header .col-spent.amount.under {
  color: var(--success, #1f9d55);
}

.month-header .col-spent.amount.neutral {
  color: inherit;
}

/* =========================================================
   Rows
========================================================= */
.row {
  padding: 3px 0;
}

.date {
  text-align: right;
  font-weight: 600;
  font-size: 0.8rem;
  color: var(--text-soft);
}

.desc {
  font-size: 0.8rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sub {
  font-size: 0.75rem;
}

.amount {
  text-align: right;
  font-weight: 700;
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
}

/* =========================================================
   States
========================================================= */
.muted {
  opacity: 0.4;
}

.error {
  color: var(--danger);
  font-size: 0.8rem;
}

.empty {
  padding: 12px 0;
}
</style>