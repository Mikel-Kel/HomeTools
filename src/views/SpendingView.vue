<script setup lang="ts">
import { onMounted, onBeforeUnmount, computed, ref, watch} from "vue";
import { useRouter } from "vue-router";

import PageHeader from "@/components/PageHeader.vue";
import AppIcon from "@/components/AppIcon.vue";

import { useDrive } from "@/composables/useDrive";
const { driveStatus } = useDrive();

import { useAppBootstrap } from "@/composables/useAppBootstrap"
const { loadSettings } = useAppBootstrap()

import { listFiles, loadJSONFromFolder } from "@/services/driveAdapter";
import DateChip from "@/components/DateChip.vue"

import {
  useSpending,
  type SpendingWithStatus,
  type AllocationStatus,
} from "@/composables/spending/useSpending";

import { transformSpendingRaw } from "@/spending/transformSpendingRaw";
import { releaseDraftsBatch } from "@/composables/allocations/releaseBatch";
import { useDriveWatcher } from "@/composables/useDriveWatcher";

import { formatDate } from "@/utils/dateFormat";
import { formatAmount } from "@/utils/amountFormat"

/* =========================
   Router & Stores
========================= */
const router = useRouter();
const statusFilter = ref<Set<AllocationStatus>>(new Set());

const spending = useSpending();

/* =========================
   Drive watcher
========================= */
useDriveWatcher({
  folderId: "spending",
  fileName: "spending.json",
  lastKnownModified: spending.spendingLastModified,
  onChanged: loadFromDrive,
});

watch(driveStatus, (s) => {
  if (s !== "CONNECTED") {
    spending.clear();  // méthode à créer
  }
});

/* =========================
   Filters
========================= */
const filtersOpen = ref(false);
const ownerFilter = ref<Set<string>>(new Set());
const dateFrom = ref("");
const dateTo = ref("");
const minAmount = ref<number | null>(null);
const maxAmount = ref<number | null>(null);

/* =========================
   Collapse accounts
========================= */
const collapsedAccounts = ref<Set<string>>(new Set());

const toggleAccount = (id: string) =>
  collapsedAccounts.value.has(id)
    ? collapsedAccounts.value.delete(id)
    : collapsedAccounts.value.add(id);

const isCollapsed = (id: string) =>
  collapsedAccounts.value.has(id);

/* =========================
   Helpers
========================= */
const accounts = computed(() => spending.accounts.value);

const availableOwners = computed(() => {
  const set = new Set<string>();
  spending.records.value.forEach(r => {
    if (r.owner) set.add(r.owner);
  });
  return Array.from(set).sort();
});

const allStatuses: AllocationStatus[] = [
  "none",
  "draft",
  "released",
];

function toggleStatus(status: AllocationStatus) {
  statusFilter.value.has(status)
    ? statusFilter.value.delete(status)
    : statusFilter.value.add(status);
}

const isStatusActive = (s: AllocationStatus) =>
  statusFilter.value.has(s);

function toggleOwner(owner: string) {
  ownerFilter.value.has(owner)
    ? ownerFilter.value.delete(owner)
    : ownerFilter.value.add(owner);
}

const isOwnerActive = (o: string) =>
  ownerFilter.value.has(o);

const isAllStatusesActive = computed(
  () => statusFilter.value.size === 0
);

function resetFilters() {
  ownerFilter.value = new Set();
  statusFilter.value = new Set();
  dateFrom.value = "";
  dateTo.value = "";
  minAmount.value = null;
  maxAmount.value = null;
}

function applyFilters(records: SpendingWithStatus[]) {
  return records.filter(r => {
    if (
      statusFilter.value.size &&
      !statusFilter.value.has(r.allocationStatus)
    )
      return false;

    if (ownerFilter.value.size && !ownerFilter.value.has(r.owner))
      return false;

    if (dateFrom.value && r.date < dateFrom.value) return false;
    if (dateTo.value && r.date > dateTo.value) return false;

    const abs = Math.abs(r.amount);
    if (minAmount.value !== null && abs < minAmount.value) return false;
    if (maxAmount.value !== null && abs > maxAmount.value) return false;

    return true;
  });
}

function selectAllStatuses() {
  statusFilter.value.clear();
}

function recordsFor(accountId: string) {
  return applyFilters(
    spending.getRecordsForAccount(accountId)
  );
}

function totalFor(accountId: string) {
  return recordsFor(accountId).reduce(
    (s, r) => s + r.amount,
    0
  );
}

const remainingAmount = computed(() =>
  accounts.value.reduce(
    (sum, account) => sum + totalFor(account.id),
    0
  )
);

const absRemainingAmount = computed(() =>
  Math.abs(remainingAmount.value)
);

function openFollowUp() {
  router.push({
    name: "followup",
  });
}

function isForeign(record: SpendingWithStatus) {
  return (
    record.foreignAmount != null &&
    record.currency &&
    record.currency !== "CHF"
  );
}

const fxPopover = ref<{
  record: SpendingWithStatus;
  x: number;
  y: number;
} | null>(null);

let fxTimer: number | null = null;

function showFxPopover(event: MouseEvent, record: SpendingWithStatus) {
  if (!isForeign(record)) return;

  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();

  fxPopover.value = {
    record,
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

/* =========================
   Release all drafts
========================= */

const draftRecords = computed(() =>
  spending.getDraftRecords()
);

const draftCount = computed(
  () => draftRecords.value.length
);

const canReleaseAll = computed(
  () => draftCount.value > 0
);

async function releaseAllDrafts() {
  if (!canReleaseAll.value) return;

  const ok = confirm(
    `Release ${draftCount.value} draft(s)?\nThis action cannot be undone.`
  );
  if (!ok) return;

  await releaseDraftsBatch(draftRecords.value);

  // 🔁 refresh spending (statuts + données)
  await loadFromDrive();
}

/* =========================
   Navigation
========================= */
function openAllocation(record: SpendingWithStatus) {
  router.push({
    name: "allocation",
    params: { id: record.id },
  });
}

/* =========================
   Drive loader
========================= */
async function loadFromDrive() {
  const folderId = "spending";

  const raw = await loadJSONFromFolder<any>(
    folderId,
    "spending.json"
  );
  if (!raw) return;

  // 🔑 mémorise la date de mise à jour Drive
  if (raw.modifiedTime) {
    spending.setSpendingLastModified(raw.modifiedTime);
  }
  const { accounts, records } =
    transformSpendingRaw(raw.items);
  spending.replaceAll(accounts, records);

  await loadAllocationStatusFromDrive();
}

async function loadAllocationStatusFromDrive() {
  const draftsFolder =
    "allocations/drafts";
  const releasedFolder =
    "allocations/released";

  const [draftFiles, releasedFiles] =
    await Promise.all([
      listFiles(draftsFolder),
      listFiles(releasedFolder),
    ]);

  const draftIds = new Set(
    draftFiles.map(f => f.name.replace(".json", ""))
  );
  const releasedIds = new Set(
    releasedFiles.map(f => f.name.replace(".json", ""))
  );

  spending.applyAllocationStatus(
    draftIds,
    releasedIds
  );
}

/* =========================
   Lifecycle
========================= */
onMounted(loadFromDrive);

/* =========================
   Sticky header sizing
========================= */
const stickyRef = ref<HTMLElement | null>(null);
let ro: ResizeObserver | null = null;

onMounted(() => {
  const el = stickyRef.value;
  if (!el) return;

  const apply = () => {
    const h = el.getBoundingClientRect().height;
    el.style.setProperty(
      "--sticky-height",
      `${Math.ceil(h)}px`
    );
  };

  apply();
  ro = new ResizeObserver(apply);
  ro.observe(el);
});

onBeforeUnmount(() => {
  if (ro && stickyRef.value)
    ro.unobserve(stickyRef.value);
  ro = null;
});
</script>
  
<template>
  <PageHeader
    title="Spending"
    icon="spending"
  >
    <template #actions>
      <div class="header-actions">
        <!-- Groupe navigation -->
        <div class="header-group">
          <AppIcon
            name="followup"
            :size="32"
            class="header-icon"
            title="Follow up"
            @click="openFollowUp"
          />
        </div>

        <!-- Groupe action forte -->
        <div
          class="header-group danger"
          :class="{ disabled: !canReleaseAll }"
          :title="canReleaseAll ? 'Release all drafts' : 'No drafts to release'"
          @click="canReleaseAll && releaseAllDrafts()"
        >
          <AppIcon
            name="rss"
            :size="32"
            class="header-icon"
          />
        </div>
      </div>
    </template>
  </PageHeader>
  <div class="spending-scroll">
    <!-- Sticky zone (Filters) -->
    <div ref="stickyRef" class="sticky-zone">
      <section class="filters">
        <header
          class="filters-header clickable"
          @click="filtersOpen = !filtersOpen"
        >
          <span class="arrow">{{ filtersOpen ? "▼" : "►" }}</span>
          <h2>Filters</h2>
          <button
            v-if="filtersOpen"
            class="reset-button"
            @click.stop="resetFilters"
          >
            Reset
          </button>
        </header>

        <div v-if="filtersOpen" class="filters-body">

          <!-- Owner -->
          <div class="filter-row">
            <span class="label">Owner</span>
            <button
              v-for="owner in availableOwners"
              :key="owner"
              class="chip"
              :class="{ active: isOwnerActive(owner) }"
              @click="toggleOwner(owner)"
            >
              {{ owner || "-" }}
            </button>
          </div>

          <!-- Status -->
          <div class="filter-row">
            <span class="label">Status</span>

            <button
              class="chip status all"
              :class="{ active: isAllStatusesActive }"
              @click="selectAllStatuses"
            >
              All
            </button>

            <button
              v-for="s in allStatuses"
              :key="s"
              class="chip status"
              :class="[s, { active: isStatusActive(s) }]"
              @click="toggleStatus(s)"
            >
              {{ s }}
            </button>
          </div>

          <!-- Period -->
           <div class="filter-row">
            <span class="label">Period</span>

            <div class="dates-row">
              <DateChip v-model="dateFrom" placeholder="From" />
              <DateChip v-model="dateTo" placeholder="To" />
            </div>
          </div>

          <!-- Amount -->
          <div class="filter-row">
            <span class="label">Amount</span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Min"
              v-model.number="minAmount"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Max"
              v-model.number="maxAmount"
            />
          </div>
        </div>
      </section>
    </div>

    <!-- Accounts -->
    <div class="spending-view">
      <section v-for="account in accounts" :key="account.id" class="account">
        <div class="account-separator"></div>
        <header class="account-header clickable" @click="toggleAccount(account.id)">
          <!-- gauche : flèche + label + ops -->
          <div class="account-title">
            <span class="arrow">{{ isCollapsed(account.id) ? "►" : "▼" }}</span>
            <h2>{{ account.label }}</h2>
            <span class="ops-count">{{ recordsFor(account.id).length }} ops</span>
          </div>

          <!-- droite : total aligné sur Amount -->
          <div
            class="total right"
            :class="totalFor(account.id) >= 0 ? 'positive' : 'negative'"
          >
            {{ formatAmount(totalFor(account.id), { showPlus: true }) }}
          </div>
        </header>
        <!-- ✅ TABLE ALIGNÉE -->
        <table v-if="!isCollapsed(account.id)" class="spending-table">
          <colgroup>
            <col class="col-date">
            <col class="col-party">
            <col class="col-owner">
            <col class="col-status">
            <col class="col-amount">
          </colgroup>

          <thead>
            <tr>
              <th>Date</th>
              <th>Party</th>
              <th>Owner</th>
              <th>Status</th>
              <th class="right">Amount</th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="record in recordsFor(account.id)"
              :key="record.id"
              class="row"
              @click="openAllocation(record)"
            >
              <td>{{ formatDate(record.date, "compact") }}</td>
              <td>{{ record.party }}</td>
              <td>{{ record.owner }}</td>
              <td>
                <span
                  :class="['status-pill', record.allocationStatus]"
                >
                  {{ record.allocationStatus }}
                </span>
              </td>
              <td
                class="right amount-cell"
                :class="[
                  record.amount >= 0 ? 'positive' : 'negative',
                  { foreign: isForeign(record) }
                ]"
                @click.stop="showFxPopover($event, record)"
              >
                <span v-if="isForeign(record)" class="fx-code">
                  {{ record.currency }}
                </span>

                <span>
                  {{
                    isForeign(record)
                      ? record.foreignAmount?.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })
                      : formatAmount(record.amount, { showPlus: true })
                  }}
                </span>
              </td>  
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </div>
  <!-- FX micro popover -->
  <div
    v-if="fxPopover"
    class="fx-popover"
    :style="{ top: fxPopover.y + 'px', left: fxPopover.x + 'px' }"
    @click.stop="closeFxPopover"
  >
    {{ formatAmount(fxPopover.record.amount, { showPlus: true }) }} CHF
  </div>
</template>

<style scoped>
/* =========================================================
   1️⃣ HEADER ACTIONS
========================================================= */
.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-group {
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

/* séparateur */
.header-group + .header-group {
  padding-left: 12px;
  border-left: 1px solid var(--border);
}

/* danger */
.header-group.danger .header-icon {
  color: var(--negative);
}

.header-group.danger:not(.disabled):hover .header-icon {
  background: var(--primary-soft); /* 🔥 FIX (neutralisé) */
  border-radius: 6px;
}

/* disabled */
.header-group.disabled {
  opacity: 0.35;
  cursor: default;
  pointer-events: none;
}

/* =========================================================
   2️⃣ ROOT SCROLL
========================================================= */
.spending-scroll {
  height: calc(100vh - 64px);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  background: var(--bg);
}

/* =========================================================
   3️⃣ STICKY ZONE
========================================================= */
.sticky-zone {
  position: sticky;
  top: 0;
  z-index: 200;

  /* 🔥 FIX dark translucide */
  background: color-mix(in srgb, var(--bg) 92%, transparent);

  border-bottom: 1px solid var(--border);
  --sticky-height: 48px;
}

.filters {
  font-size: var(--font-size-sm);
  background: var(--bg);
}

.filters-header {
  padding: 0.5rem;
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

.dates-row {
  display: flex;
  gap: 10px;
}

/* reset */
.reset-button {
  padding: 2px 20px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface-soft);
  color: var(--text-soft);
  font-size: var(--font-size-xs);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.reset-button:hover {
  background: var(--primary-soft);
  border-color: var(--primary);
  color: var(--primary);
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

/* =========================================================
   4️⃣ INPUTS
========================================================= */

.filter-row input:not(.hidden-date-input) {
  height: 30px;
  padding: 0 8px;

  border-radius: 18px;
  border: 1px solid var(--border);

  background: var(--surface);
  color: var(--text);

  font-size: var(--font-size-xs);
  font-weight: 600;
  font-family: inherit;
}

.filter-row input[type="date"] {
  width: 120px;
  letter-spacing: 0.04rem;
}

.filter-row input[type="number"] {
  width: 80px;
}

.filter-row input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary-soft);
}

.label {
  width: 70px;
  color: var(--text-soft); /* 🔥 FIX */
  flex: 0 0 auto;
}

/* =========================================================
   5️⃣ CHIPS
========================================================= */
.chip {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface-soft); /* 🔥 FIX typo */
  color: var(--text-soft);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  height: 30px;
  user-select: none;
  font-size: var(--font-size-xs);
  font-weight: 600;
  text-transform: uppercase;
  opacity: 0.7;
  transition: all 0.15s ease;
}

.chip:hover {
  opacity: 0.9;
}

.chip.active {
  opacity: 1;
  background: var(--primary-soft);
  color: var(--primary);
  border-color: var(--primary);
}

/* =========================================================
   6️⃣ STATUS
========================================================= */
.status.none {
  background: var(--bg-soft);
  color: var(--text-soft);
  border-color: var(--border);
}

.status.draft {
  background: var(--primary-soft);
  color: var(--primary);
  border-color: var(--primary);
}

.status.released {
  background: color-mix(in srgb, var(--positive) 15%, transparent); /* 🔥 FIX */
  color: var(--positive);
  border-color: var(--positive);
}

.chip.status.all {
  background: var(--surface-soft);
  color: var(--text-soft);
  border-color: var(--border);
}

.chip.status.all.active {
  background: var(--primary-soft);
  color: var(--primary);
  border-color: var(--primary);
}

/* =========================================================
   7️⃣ ACCOUNT HEADER
========================================================= */
.spending-view {
  padding-bottom: 1rem;
}

.account {
  margin-bottom: 0.75rem;
}

.account-separator {
  height: 1px;
  background: var(--border);
  margin: 0.25rem 0 0.5rem;
}

.account-header {
  position: sticky;
  top: var(--sticky-height);
  z-index: 120;

  /* 🔥 FIX dark */
  background: color-mix(in srgb, var(--surface-soft) 90%, transparent);

  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);

  display: grid;
  grid-template-columns: 110px auto 110px 100px 120px;
  column-gap: 0.5rem;

  padding: 0.25rem 0;
  align-items: center;
}

.account-title {
  grid-column: 1 / 5;
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  padding-left: 0.5rem;
  flex-wrap: wrap;
  min-width: 0;
}

.account-title h2 {
  font-size: var(--font-size-lg);
  font-weight: 600;
  margin: 0;
}

.ops-count {
  font-size: var(--font-size-sm);
  opacity: 0.6;
  white-space: nowrap;
}

.total {
  grid-column: 5 / 6;
  font-weight: 600;
  text-align: right;
  padding-right: 0.5rem;
}

/* =========================================================
   8️⃣ TABLE
========================================================= */
.spending-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: var(--font-size-md);
}

.spending-table col.col-date   { width: 110px; }
.spending-table col.col-party  { width: auto; }
.spending-table col.col-owner  { width: 110px; }
.spending-table col.col-status { width: 100px; }
.spending-table col.col-amount { width: 120px; }

.spending-table th,
.spending-table td {
  padding: 8px;
  border-bottom: 1px solid var(--border);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.spending-table tbody tr:nth-child(even) {
  background: var(--surface-soft);
}

/* alignements */
.spending-table th:nth-child(1),
.spending-table td:nth-child(1) { text-align: center; }

.spending-table th:nth-child(2),
.spending-table td:nth-child(2) { text-align: left; }

.spending-table th:nth-child(3),
.spending-table td:nth-child(3),
.spending-table th:nth-child(4),
.spending-table td:nth-child(4) { text-align: center; }

.spending-table th:nth-child(5),
.spending-table td:nth-child(5) { text-align: right; }

/* =========================================================
   STATUS PILL
========================================================= */
.status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: var(--font-size-xs);
  font-weight: 600;
  text-transform: uppercase;
  border: 1px solid transparent;
  margin: 0 auto;
}

.status-pill.none {
  background: var(--bg-soft);
  color: var(--text-soft);
  border-color: var(--border);
}

.status-pill.draft {
  background: var(--primary-soft);
  color: var(--primary);
  border-color: var(--primary);
}

.status-pill.released {
  background: color-mix(in srgb, var(--positive) 15%, transparent);
  color: var(--positive);
  border-color: var(--positive);
}

/* =========================================================
   FX
========================================================= */

.fx-code {
  display: inline-block;
  min-width: 34px;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--primary);
  margin-right: 6px;
}

.amount-cell.foreign {
  cursor: pointer;
}

.fx-popover {
  position: fixed;
  transform: translate(-100%, -100%);
  background: var(--surface);
  color: var(--text);
  padding: 6px 10px;
  border-radius: 10px;
  font-size: var(--font-size-xs);
  font-weight: 600;
  white-space: nowrap;
  box-shadow: var(--shadow-md); /* 🔥 FIX */
  animation: fxFade 0.15s ease-out;
  z-index: 1000;
}

@keyframes fxFade {
  from {
    opacity: 0;
    transform: translate(-100%, -90%) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translate(-100%, -100%) scale(1);
  }
}

</style>