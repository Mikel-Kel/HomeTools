<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useAppParameters } from "@/composables/useAppParameters";
import { loadJSONFromFolder } from "@/services/google/driveRepository";
import { useDrive } from "@/composables/useDrive";
import { formatDate } from "@/utils/dateFormat";

import { useCategories } from "@/composables/useCategories";
import { useAllocationTags } from "@/composables/allocations/useAllocationTags"
import { useParties } from "@/composables/useParties"
import { loadSettings } from "@/services/loadSettings";

/* =========================================================
   TYPES
========================================================= */

interface FollowUpDetailItem {
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

const { folders } = useDrive();
const { appParameters, load } = useAppParameters();

const categoriesStore = useCategories();
const tagsStore = useAllocationTags()
const partiesStore = useParties()

const raw = ref<FollowUpDetailsFile | null>(null);

const loading = ref(false);
const error = ref<string | null>(null);

const fxPopover = ref<{
  item: FollowUpDetailItem;
  x: number;
  y: number;
} | null>(null);

let fxTimer: number | null = null;


const partyMap = computed(() => {

  const map = new Map<number,string>()

  for (const p of partiesStore.parties.value) {
    map.set(p.id, p.label)
  }

  return map
})

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
    const folderId =
      folders.value.allocations.budget;
    const filename =
      `FollowUpDetails-${props.year}.json`;
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
  () => [
    props.year,
    props.categoryIds,
    props.subCategoryId
  ],
  loadDetails,
  { immediate: true }
);

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
  return partyMap.value.get(partyId) ?? `#${partyId}`
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
  await load();
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
          :key="idx"
          class="grid row"
        >
          <div class="col-label date">
            {{ formatDate(it.allocationDate,"text") }}
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
            <div
              v-if="it.tagId !== null"
              class="tag-container"
            >
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
            @click="showFxPopover($event, it)"
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
}

.date {
  text-align: right;
  font-weight: 600;
  font-size: 0.8rem;
  color: var(--text-soft);
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
  min-width: 0; /* important pour ellipsis */
}

/* =========================================================
   Tag chip
========================================================= */

.tag-container {
  display: flex;
  align-items: center;
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

.tag-chip.off {
  background: var(--negative-soft, rgba(255,0,0,0.08));
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

/* valeur principale */
.amount-value {
  display: inline-block;
}

/* =========================================================
   Currency indicator
========================================================= */

.ccy-dot {
  position: absolute;

  right: -12px;   /* décale le point à droite du montant */
  top: 50%;

  transform: translateY(-50%);

  width: 6px;
  height: 6px;

  border-radius: 50%;
  background: var(--primary);
}

/* =========================================================
   FX popover
========================================================= */
.fx-popover {
  position: fixed;

  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;

  padding: 4px 8px;

  font-size: 0.75rem;
  font-weight: 600;

  box-shadow: 0 4px 10px rgba(0,0,0,0.15);

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