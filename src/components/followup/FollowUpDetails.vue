<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";

import { useAppBootstrap } from "@/composables/useAppBootstrap"
const { loadSettings } = useAppBootstrap()

import { loadJSONFromFolder } from "@/services/driveAdapter";
import { useDriveJsonFile } from "@/composables/useDriveJsonFile"
import { useDriveWatcher } from "@/composables/useDriveWatcher"
import { formatDate } from "@/utils/dateFormat";

import { useCategories } from "@/composables/useCategories";
import { useAllocationTags } from "@/composables/allocations/useAllocationTags"
import { useParties } from "@/composables/useParties"

/* =========================================================
   TYPES
========================================================= */

interface FollowUpDetailItem {
  allocationId: string;
  categoryId: number;
  subCategoryId: number;
  allocationDate: string; // YYYY-MM-DD
  amount: number;
  amountCcy: number;
  currency:string;
  description: string;
  bankDescription: string;
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
  key: string;
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
  includeOffBudget?: boolean;
}>();

/* =========================================================
   STATE
========================================================= */

const activeRowFitid = ref<string | null>(null)
const raw = ref<FollowUpDetailsFile | null>(null);
const pendingReallocationIds =
  ref<Set<string>>(new Set());

    const categoriesStore = useCategories();
const tagsStore = useAllocationTags()
const partiesStore = useParties()
const detailsRemoteState = ref<string | null>(null)

const loading = ref(false);
const error = ref<string | null>(null);

const isTouchDevice =
  window.matchMedia("(hover: none)").matches

const fxPopover = ref<{
    item: FollowUpDetailItem;
  x: number;
  y: number;
} | null>(null);

  
let fxTimer: number | null = null;

function toggleRowAction(fitid: string) {
  if (!isTouchDevice) return
  activeRowFitid.value =
    activeRowFitid.value === fitid
      ? null
      : fitid
}

/* ========
   HANDLER
=========== */

function buildEventFileName(fitid: string): string {
  const now = new Date()

  const YYYY = now.getFullYear()
  const MM = String(now.getMonth() + 1).padStart(2, "0")
  const DD = String(now.getDate()).padStart(2, "0")
  const HH = String(now.getHours()).padStart(2, "0")
  const mm = String(now.getMinutes()).padStart(2, "0")
  const ss = String(now.getSeconds()).padStart(2, "0")
  const shortFitid = fitid.slice(0, 12)

  return `REA_${YYYY}${MM}${DD}${HH}${mm}${ss}_${shortFitid}.json`
}

async function requestReallocation(item: FollowUpDetailItem) {
  if (pendingReallocationIds.value.has(item.allocationId)) return

  const ok = confirm(
    "Request allocation change for this transaction?\n" +
    "(back to Spending Drafts)"
  )
  if (!ok) return

  try {
    const event = {
      eventType: "REALLOCATION_REQUEST",
      version: 1,
      timestamp: new Date().toISOString(),
      allocationMetadata: {
        allocationId: item.allocationId
      }
    }

    const fileName =
      buildEventFileName(item.allocationId)
    const { save } =
      useDriveJsonFile("events", fileName)
    
      await save(event)
    
      pendingReallocationIds.value.add(item.allocationId)
    activeRowFitid.value = null

  } catch (e) {
    console.error(
      "Failed to request reallocation",
      e
    )
  }
}

/* ========
   LOAD
=========== */

async function loadDetails() {
  if (props.subCategoryId === null) {
    raw.value = null;
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const folderId = "allocations/budget";
    const filename = `FollowUpDetails-${props.year}.json`;
    const data =
      await loadJSONFromFolder<FollowUpDetailsFile>(
        folderId,
        filename
      );
    if (!data) {
      throw new Error(`${filename} not found`);
    }

    raw.value = data;

  }

  catch (e: any) {
    error.value =
      e?.message ??
      "Unable to load FollowUpDetails";
    raw.value = null;
  }

  finally {
    loading.value = false;
  }
}

watch(
  () => props.year,
  async () => {
    activeRowFitid.value = null
    pendingReallocationIds.value.clear()
    detailsRemoteState.value = null
    await loadDetails()
  },
  { immediate: true }
)

watch(
  () => props.subCategoryId,
  async (v) => {
    activeRowFitid.value = null
    if (v !== null && raw.value === null) {
      await loadDetails()
    }
  }
)

useDriveWatcher({
  folderId: "allocations/budget",
  fileName: `FollowUpDetails-${props.year}.json`,
  lastKnownState: detailsRemoteState,
  onChanged: async () => {
    await loadDetails()
    activeRowFitid.value = null
  },
})

/* =========================================================
   HELPERS
========================================================= */
function fmt(n: number) {
  return n.toLocaleString(
    "en-GB",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  );
}

function fmtInt(n: number) {
  return Math.round(n)
    .toLocaleString("en-GB");
}

function fmtForeign(it: FollowUpDetailItem) {
  if (!it.amountCcy) return "";
  const val = it.amountCcy.toLocaleString(
    "en-GB",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  );
  return it.currency
    ? `${val} ${it.currency}`
    : val;
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function monthLabel(key: string) {
  const [y, m] =
    key.split("-").map(Number);
  return new Date(y, m - 1)
    .toLocaleDateString(
      "en-GB",
      {
        month: "long",
        year: "numeric"
      }
    );
}

function subCategoryLabel(
  catId: number,
  subId: number
) {
  const cat =
    categoriesStore.getCategory(catId);
  return (
    cat?.subcategories
      .find(s => s.id === subId)
      ?.label ??
    `#${subId}`
  );
}

function partyLabel(partyId: number | null) {
  if (partyId == null) return ""
  return partiesStore.getParty(partyId)?.label ?? `#${partyId}`
}

function getTag(tagId: number | null) {
  if (tagId === null) return null
  return tagsStore.getTag(tagId)
}

function tagLabel(tagId: number | null) {
  return getTag(tagId)?.tagName ?? ""
}

function isForeign(it: FollowUpDetailItem) {
  return it.amountCcy !== 0;
}

function showFxPopover(event: MouseEvent, item: FollowUpDetailItem) {
  if (!isForeign(item)) return;
  const rect =
    (event.currentTarget as HTMLElement)
      .getBoundingClientRect();
  fxPopover.value = {
    item,
    x: rect.right - 10,
    y: rect.top - 8,
  };
  if (fxTimer) clearTimeout(fxTimer);
  fxTimer = window.setTimeout(() => {
    fxPopover.value = null;
  }, 2000);
}

function closeFxPopover() {
  fxPopover.value = null;
  if (fxTimer) clearTimeout(fxTimer);
}

/* =========================================================
   FILTERED ITEMS
========================================================= */
const filteredItems = computed<FollowUpDetailItem[]>(() => {
  if (!raw.value || props.subCategoryId === null) {
    return [];
  }

  const selectedCategoryIds = new Set(props.categoryIds);
  const selectedSubCategoryId = props.subCategoryId;
  const maxMonth = props.maxMonth;
  const includeOffBudget = props.includeOffBudget;

  return raw.value.items
    .filter((it) => {
      const matchesCategory =
        selectedCategoryIds.size === 0 ||
        selectedCategoryIds.has(it.categoryId);

      if (!matchesCategory) return false;

      const matchesSubCategory =
        it.subCategoryId === selectedSubCategoryId;

      if (!matchesSubCategory) return false;

      const matchesMonth =
        maxMonth == null ||
        Number(it.allocationDate.slice(5, 7)) <= maxMonth;

      if (!matchesMonth) return false;

      const isOffBudget =
        getTag(it.tagId)?.offBudget === true;

      if (!includeOffBudget && isOffBudget) return false;

      return true;
    })
    .sort((a, b) =>
      b.allocationDate.localeCompare(a.allocationDate)
    );
});

/* =========================================================
   MONTHLY GROUPS
========================================================= */

const monthlyGroups =
computed<MonthGroup[]>(() => {

  const map =
    new Map<string,
      FollowUpDetailItem[]
    >();

  for (const it of filteredItems.value) {
    const key =
      monthKey(it.allocationDate);

    if (!map.has(key))
      map.set(key, []);

    map.get(key)!.push(it);
  }

  return Array
    .from(map.entries())
    .map(([key, list]) => ({
      key,
      label:
        monthLabel(key),
      total:
        list.reduce(
          (s, i) =>
            s + i.amount,
          0
        ),

      items:
        list.sort((a, b) =>
          b.allocationDate
            .localeCompare(a.allocationDate)
        )
    }))
    .sort((a, b) =>
      b.key.localeCompare(a.key)
    );
});

/* =========================================================
   COLLAPSE
========================================================= */

const openMonths =
ref<Set<string>>(new Set());

watch(monthlyGroups, groups => {
  if (groups.length) {
    openMonths.value =
      new Set([groups[0].key]);
  }
});

function toggleMonth(key: string) {
  if (openMonths.value.has(key)) {
    openMonths.value.delete(key);
  }
  else {
    openMonths.value.add(key);
  }
}

/* =========================================================
   STATUS
========================================================= */

function monthStatusClass(
  key: string,
  total: number
) {
  if (
    !props.monthlyBudgetMap ||
    !props.nature
  )
    return "neutral";

  const budget =
    props.monthlyBudgetMap[key];

  if (budget == null)
    return "neutral";

  if (props.nature === "E") {
    if (total > budget)
      return "over";
    if (total < budget)
      return "under";
    return "neutral";
  }

  if (props.nature === "I") {
    if (total < budget)
      return "over";
    if (total > budget)
      return "under";
    return "neutral";
  }
  return "neutral";
}

onMounted(async () => {
  await loadSettings();
});
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
          :key="`${it.allocationId}-${idx}`"
          class="grid row"
          :class="{
            active: activeRowFitid === it.allocationId,
            pending: pendingReallocationIds.has(it.allocationId)
          }"
            @click="!pendingReallocationIds.has(it.allocationId) && toggleRowAction(it.allocationId)"
          >

          <div class="col-label date-cell">
            <span
              v-if="pendingReallocationIds.has(it.allocationId)"
              class="pending-inline"
            >
              Pending 
            </span>
            <button
              v-else
              class="reallocate-btn"
              :class="{ visible: activeRowFitid === it.allocationId }"
              @click.stop="requestReallocation(it)"
              title="Request allocation change"
            >
              🔄
            </button>
            <span class="date">
              {{ formatDate(it.allocationDate,"text") }}
            </span>
          </div>

          <div class="desc-block">

            <div class="desc-text">
              <div class="desc">
                {{ it.description || "—" }}
              </div>

              <div class="sub muted">
                {{ partyLabel(it.partyId) }}
                <span v-if="it.bankDescription">
                  · {{ it.bankDescription }}
                </span>
              </div>
            </div>

            <div class="tag-container">

              <span
                v-if="it.tagId !== null"
                class="tag-chip"
                :class="{ off: getTag(it.tagId)?.offBudget }"
              >
                {{ tagLabel(it.tagId) }}
              </span>

            </div>

          </div>

          <div
            class="col-spent amount amount-cell"
            @mouseenter="showFxPopover($event, it)"
            @mouseleave="closeFxPopover"
            @click.stop="showFxPopover($event, it)"
          >
            <span class="amount-value">
              {{ fmt(it.amount) }}
            </span>

            <span
              v-if="isForeign(it)"
              class="ccy-dot"
            ></span>
          </div>

          <div></div>

        </div>
      </div>
    </div>

    <div v-if="!filteredItems.length" class="muted empty">
      No allocations for this selection
    </div>
  </div>

  <div
    v-if="fxPopover"
    class="fx-popover"
    :style="{
      left: fxPopover.x + 'px',
      top: fxPopover.y + 'px'
    }"
  >
    {{ fmtForeign(fxPopover.item) }}
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
  color: var(--text-soft);
  opacity: 0.85;

  transition: background 0.15s ease; /* 🔥 smooth */
}

.month-header:hover {
  background: var(--primary-soft);
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
  color: var(--negative);
}

.month-header .col-spent.amount.under {
  color: var(--positive);
}

.month-header .col-spent.amount.neutral {
  color: inherit;
}

/* =========================================================
   Rows
========================================================= */
.row {
  padding: 3px 0;
  transition: background 0.15s ease;
}

.row.active {
  background: var(--primary-soft);
}

.row.pending {
  opacity: 0.45;
}
.pending-inline {
  font-size: 0.85rem;
  font-style: italic;
  font-weight: 600;
  color: var(--negative);
  white-space: nowrap;
  min-width: 48px;
  text-align: right;
}

/* Hover visuel desktop */
.row:hover {
  background: var(--primary-soft);
}

.reallocate-btn {
  width: 22px;
  height: 22px;

  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;

  opacity: 0;
  pointer-events: none;

  transition:
    opacity 0.15s ease,
    transform 0.15s ease;

  transform: scale(0.9);
}

/* Hover desktop */
.row:hover .reallocate-btn {
  opacity: 0.75;
  pointer-events: auto;
  transform: scale(1);
}

/* Active mobile/touch */
.row.active .reallocate-btn {
  opacity: 0.75;
  pointer-events: auto;
  transform: scale(1);
}

.row.pending:hover .reallocate-btn {
  opacity: 0;
  pointer-events: none;
}

/* =========================================================
   Date
========================================================= */
.date-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  justify-self: end;
  width: max-content;
}

.date {
  font-weight: 600;
  font-size: 0.8rem;
  color: var(--text-soft);
  white-space: nowrap;
}


/* =========================================================
   Description + tag layout
========================================================= */
.desc-block {
  display: grid;
  grid-template-columns: 1fr auto;
  column-gap: 8px;
  align-items: center;
}

.desc-text {
  min-width: 0;
}

/* =========================================================
   Tag chip
========================================================= */
.tag-container {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tag-chip {
  padding: 1px 6px;

  border-radius: 999px;
  border: 1px solid var(--border);

  font-size: 0.65rem;
  font-weight: 700;

  background: var(--surface-soft);
  color: var(--text-soft);
}

/* 🔥 FIX DARK MODE */
.tag-chip.off {
  background: var(--primary-soft); /* fallback cohérent */
  border-color: var(--negative);
  color: var(--negative);
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
  color: var(--text-soft); /* 🔥 FIX cohérence */
}

.amount {
  text-align: right;
  font-weight: 700;
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
}

/* =========================================================
   Amount cell
========================================================= */
.amount-cell {
  position: relative;
  text-align: right;
}

.amount-value {
  display: inline-block;
}

/* =========================================================
   Currency indicator
========================================================= */
.ccy-dot {
  position: absolute;
  right: -12px;
  top: 50%;
  transform: translateY(-50%);

  width: 6px;
  height: 6px;
  border-radius: 50%;

  background: var(--primary);

  /* 🔥 améliore visibilité dark */
  box-shadow: 0 0 0 1px var(--surface);
}

/* =========================================================
   FX popover
========================================================= */
.fx-popover {
  position: fixed;

  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;

  padding: 4px 8px;

  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text);

  box-shadow: var(--shadow-md); /* 🔥 FIX */
  pointer-events: none;
  z-index: 1000;
}

/* =========================================================
   States
========================================================= */
.muted {
  opacity: 0.4;
}

.error {
  color: var(--negative);
  font-size: 0.8rem;
}

.empty {
  padding: 12px 0;
}
</style>