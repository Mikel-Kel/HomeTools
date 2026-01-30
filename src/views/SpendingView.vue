<script setup lang="ts">
import { onMounted, onBeforeUnmount, computed, ref } from "vue";
import { useRouter } from "vue-router";

import PageHeader from "@/components/PageHeader.vue";
import AppIcon from "@/components/AppIcon.vue";

import { listFilesInFolder } from "@/services/google/googleDrive";
import { loadJSONFromFolder } from "@/services/google/driveRepository";
import {
  useSpending,
  type SpendingWithStatus,
  type AllocationStatus,
} from "@/composables/spending/useSpending";
import { useDrive } from "@/composables/useDrive";
import { transformSpendingRaw } from "@/spending/transformSpendingRaw";
import { releaseDraftsBatch } from  "@/composables/allocations/releaseBatch";

/* =========================
   State
========================= */
const router = useRouter();
const spending = useSpending();
const statusFilter = ref<Set<AllocationStatus>>(new Set());
const { driveState } = useDrive();

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

function openArchives() {
  router.push({ name: "allocationsArchive" });
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
  const folderId =
    driveState.value!.folders.spending;

  const raw = await loadJSONFromFolder<any>(
    folderId,
    "spending.json"
  );
  if (!raw) return;

  const { accounts, records } =
    transformSpendingRaw(raw.items);

  // backend = vérité
  spending.replaceAll(accounts, records);

  // statuts depuis Drive
  await loadAllocationStatusFromDrive();
}

async function loadAllocationStatusFromDrive() {
  const draftsFolder =
    driveState.value!.folders.allocations.drafts;
  const releasedFolder =
    driveState.value!.folders.allocations.released;

  const [draftFiles, releasedFiles] =
    await Promise.all([
      listFilesInFolder(draftsFolder),
      listFilesInFolder(releasedFolder),
    ]);

  const draftIds = new Set(
    draftFiles.map(f =>
      f.name.replace(".json", "")
    )
  );
  const releasedIds = new Set(
    releasedFiles.map(f =>
      f.name.replace(".json", "")
    )
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
  <header class="page-header">
    <AppTitle
      :text="title"
      :icon="icon"
    />

    <div class="page-actions">
      <slot name="actions" />
      <NavigationButtons :disabled="disabled" />
    </div>
  </header>

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
            <input type="date" v-model="dateFrom" />
            <input type="date" v-model="dateTo" />
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
            <button class="reset" @click="resetFilters">Reset</button>
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
            {{ formatAmount(totalFor(account.id)) }}
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
              <td>{{ formatDate(record.date) }}</td>
              <td>{{ record.party }}</td>
              <td>{{ record.owner }}</td>
              <td>
                <span
                  :class="['status-pill', record.allocationStatus]"
                >
                  {{ record.allocationStatus }}
                </span>              </td>
              <td
                class="right"
                :class="record.amount >= 0 ? 'positive' : 'negative'"
              >
                {{ formatAmount(record.amount) }}
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </div>
</template>

<style scoped>

.header-action {
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  font-weight: 600;
  cursor: pointer;
}

.header-action:hover {
  background: var(--primary-soft);
}

.header-icon {
  cursor: pointer;
}

.header-icon.disabled {
  opacity: 0.35;
  pointer-events: none;
}

/* =========================================================
   Root scroll area
========================================================= */
.spending-scroll {
  height: calc(100vh - 64px);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  background: var(--bg);
}

/* =========================================================
   Sticky zone (Filters)
========================================================= */
.sticky-zone {
  position: sticky;
  top: 0;
  z-index: 200;
  background: var(--bg);
  border-bottom: 1px solid var(--border);

  /* mis à jour par ResizeObserver */
  --sticky-height: 48px;
}

.filters {
  font-size: var(--font-size-sm);
  background: var(--bg);
}

.filters-header {
  padding: 0.5rem 1rem;
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
  padding: 0.5rem 1rem 0.75rem;
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

.reset {
  margin-left: auto;
}

/* =========================================================
   Chips (generic)
========================================================= */
.chip {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  cursor: pointer;
  user-select: none;
  font-size: var(--font-size-xs);
  font-weight: 600;
  text-transform: uppercase;
  opacity: 0.7;
}

.chip.active {
  opacity: 1;
  background: var(--primary-soft);
  border-color: var(--primary);
}

/* =========================================================
   Status styles (shared by chips & pills)
========================================================= */
.status.none {
  background: #eee;
  color: #666;
  border-color: #ccc;
}

.status.draft {
  background: #fff4cc;
  color: #a37b00;
  border-color: #e6c866;
}

.status.released {
  background: #e6f7ed;
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
   Accounts
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

/* ✅ sticky account headers (Excel style) */
.account-header {
  position: sticky;
  top: var(--sticky-height);
  z-index: 120;
  background: var(--bg);
  border-bottom: 1px solid var(--border);

  /* 🔑 EXACTEMENT la même grille que le tableau */
  display: grid;
  grid-template-columns: 110px auto 110px 100px 120px; /* date | party | owner | status | amount */
  column-gap: 0.5rem;

  padding: 0.25rem 0;
  align-items: center;
}

/* bloc gauche = prend les 4 premières colonnes */
.account-title {
  grid-column: 1 / 5;

  display: flex;
  align-items: baseline;
  gap: 0.5rem;

  padding-left: 0.5rem;

  /* ✅ sur une ligne si possible, wrap si nécessaire */
  flex-wrap: wrap;
  min-width: 0; /* important pour éviter débordements en grid */
}

.account-title h2 {
  font-size: var(--font-size-lg);
  font-weight: 600;
  margin: 0;
  min-width: 0;
}

/* ops : petit et discret */
.ops-count {
  font-size: var(--font-size-sm);
  opacity: 0.6;
  white-space: nowrap;
}

/* bloc droite = 5e colonne (Amount) */
.total {
  grid-column: 5 / 6;

  font-weight: 600;
  text-align: right;
  padding-right: 0.5rem;
  white-space: nowrap;
}

/* =========================================================
   Table (GLOBAL & FIXED LAYOUT)
========================================================= */
.spending-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: var(--font-size-md);
}

/* Column widths (must match account-header grid) */
.spending-table col.col-date   { width: 110px; }
.spending-table col.col-party  { width: auto; }
.spending-table col.col-owner  { width: 110px; }
.spending-table col.col-status { width: 100px; }
.spending-table col.col-amount { width: 120px; }

/* Cells */
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

/* =========================================================
   Column alignment (KEY FIX)
========================================================= */
.spending-table th:nth-child(1),
.spending-table td:nth-child(1),
.spending-table th:nth-child(2),
.spending-table td:nth-child(2) {
  text-align: left;
}

.spending-table th:nth-child(3),
.spending-table td:nth-child(3),
.spending-table th:nth-child(4),
.spending-table td:nth-child(4) {
  text-align: center;
}

.spending-table th:nth-child(5),
.spending-table td:nth-child(5) {
  text-align: right;
}

/* center status pill visually */
.spending-table td:nth-child(4) {
  display: flex;
  justify-content: center;
}

/* =========================================================
   Status pill (table)
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
  line-height: 1.2;

  border: 1px solid transparent;
}

/* Couleurs par statut */
.status-pill.none {
  background: #eee;
  color: #666;
  border-color: #ccc;
}

.status-pill.draft {
  background: #fff4cc;
  color: #a37b00;
  border-color: #e6c866;
}

.status-pill.released {
  background: #e6f7ed;
  color: var(--positive);
  border-color: var(--positive);
}
/* =========================================================
   Misc
========================================================= */
.right { text-align: right; }
.arrow { opacity: 0.5; }

.positive { color: var(--positive); }
.negative { color: var(--negative); }

.row:hover {
  background: var(--primary-soft);
}
</style>