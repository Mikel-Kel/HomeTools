<script setup lang="ts">
import { watch, onMounted, computed, ref } from "vue";
import { useRouter } from "vue-router";

import PageHeader from "@/components/PageHeader.vue";
import { listFilesInFolder, readJSON } from "@/services/google/googleDrive";
import { useSpending, type SpendingRecord } from "@/composables/spending/useSpending";
import { useDrive } from "@/composables/useDrive";
import { transformSpendingRaw } from "@/spending/transformSpendingRaw";

/* =========================
   State
========================= */
const router = useRouter();
const spending = useSpending();
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
const isCollapsed = (id: string) => collapsedAccounts.value.has(id);

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

function toggleOwner(owner: string) {
  ownerFilter.value.has(owner)
    ? ownerFilter.value.delete(owner)
    : ownerFilter.value.add(owner);
}
const isOwnerActive = (o: string) => ownerFilter.value.has(o);

function resetFilters() {
  ownerFilter.value.clear();
  dateFrom.value = "";
  dateTo.value = "";
  minAmount.value = null;
  maxAmount.value = null;
}

function applyFilters(records: SpendingRecord[]) {
  return records.filter(r => {
    if (ownerFilter.value.size && !ownerFilter.value.has(r.owner)) return false;
    if (dateFrom.value && r.date < dateFrom.value) return false;
    if (dateTo.value && r.date > dateTo.value) return false;

    const abs = Math.abs(r.amount);
    if (minAmount.value !== null && abs < minAmount.value) return false;
    if (maxAmount.value !== null && abs > maxAmount.value) return false;

    return true;
  });
}

function recordsFor(accountId: string) {
  return applyFilters(spending.getRecordsForAccount(accountId));
}

function totalFor(accountId: string) {
  return recordsFor(accountId).reduce((s, r) => s + r.amount, 0);
}

const remainingAmount = computed(() =>
  accounts.value.reduce((sum, account) => sum + totalFor(account.id), 0)
);

const absRemainingAmount = computed(() =>
  Math.abs(remainingAmount.value)
);
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
const formatDate = (d: string) => new Date(d).toLocaleDateString();

/* =========================
   Navigation
========================= */
function openAllocation(record: SpendingRecord) {
  router.push({
    name: "allocation",
    params: { record: JSON.stringify(record) },
  });
}

/* =========================
   Drive loader
========================= */
async function loadFromDrive() {
  if (!driveState.value) return;
  const folderId = driveState.value.folders.spending;
  const files = await listFilesInFolder(folderId);
  const file = files.find(f => f.name === "spending.json");
  if (!file) return;

  const raw = await readJSON(file.id);
  const { accounts, records } = transformSpendingRaw(raw);
  spending.replaceAll(accounts, records);
}

/* =========================
   Lifecycle
========================= */
onMounted(() => driveState.value && loadFromDrive());
watch(() => driveState.value, s => s && loadFromDrive());
</script>



<template>
  <PageHeader title="Spending" icon="shopping_cart" />

  <!-- =========================
       Filters
  ========================== -->
  <section class="filters">
    <header class="account-header clickable" @click="filtersOpen = !filtersOpen">
      <div class="account-title filters-title">
        <span class="arrow">{{ filtersOpen ? "▼" : "►" }}</span>
        <h2>Filters</h2>
      </div>
      <div></div><div></div><div></div><div></div>
    </header>

    <div v-if="filtersOpen" class="filters-body">
      <div class="filter-row">
        <span class="label">Owner</span>

        <button
          v-for="owner in availableOwners"
          :key="owner"
          class="chip"
          :class="{ active: isOwnerActive(owner) }"
          @click="toggleOwner(owner)"
        >
          {{ owner }}
        </button>
      </div>

      <div class="filter-row">
        <span class="label">Period</span>
        <input type="date" v-model="dateFrom" />
        <input type="date" v-model="dateTo" />
      </div>

      <div class="filter-row">
        <span class="label">Amount</span>
        <input type="number" min="0" step="0.01" placeholder="Min" v-model.number="minAmount" />
        <input type="number" min="0" step="0.01" placeholder="Max" v-model.number="maxAmount" />
        <button class="reset" @click="resetFilters">Reset</button>
      </div>
    </div>
  </section>

  <!-- =========================
       Accounts
  ========================== -->
  <div class="spending-view">
    <section v-for="account in accounts" :key="account.id" class="account">
      <div class="account-separator"></div>
      <header class="account-header clickable" @click="toggleAccount(account.id)">
        <div class="account-title">
          <span class="arrow">{{ isCollapsed(account.id) ? "►" : "▼" }}</span>
          <h2>{{ account.label }}</h2>
          <span class="ops-count">{{ recordsFor(account.id).length }} ops</span>
        </div>
        <div></div>
        <div></div>
        <div></div>
        <div class="total right" :class="totalFor(account.id) >= 0 ? 'positive' : 'negative'">
          {{ formatAmount(totalFor(account.id)) }}
        </div>
      </header>
      <table v-if="!isCollapsed(account.id)" class="spending-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Party</th>
            <th>Owner</th>
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
            <td class="right" :class="record.amount >= 0 ? 'positive' : 'negative'">
              {{ formatAmount(record.amount) }}
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>



<style scoped>
/* =========================
   Filters
========================= */
.filters {
  margin-bottom: 0.5rem;
}
.filters-title h2 {
  font-size: 1.05rem;
  color: var(--text-soft);
}
.filters-body {
  padding: 0.25rem 1rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.filter-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.label { width: 70px; opacity: 0.7; }
.chip {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  cursor: pointer;
}
.chip.active {
  background: var(--primary-soft);
  border-color: var(--primary);
}
.reset { margin-left: auto; }

/* =========================
   Accounts
========================= */
.account-separator {
  height: 1px;
  background: var(--border);
  margin: 0.25rem 0 0.5rem;
}
.account { margin-bottom: 0.5rem; }
.account-header {
  display: grid;
  grid-template-columns:
    1fr
    90px
    1fr
    120px
    120px;
  gap: 0.5rem;
  align-items: baseline;
}
.account-title {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}
.ops-count {
  font-size: 0.85rem;
  opacity: 0.6;
}
.total {
  font-weight: 600;
  text-align: right;
}

/* =========================
   Table
========================= */
.spending-table {
  width: 100%;
  border-collapse: collapse;
}
.spending-table th:last-child,
.spending-table td:last-child {
  width: 120px;
}.spending-table td {
  padding: 8px;
  border-bottom: 1px solid var(--border);
}
.spending-table tbody tr:nth-child(even) {
  background: var(--surface-soft);
}

/* =========================
   Misc
========================= */
.right { text-align: right; }
.arrow { opacity: 0.5; }
.positive { color: var(--positive); }
.negative { color: var(--negative); }
.row:hover { background: var(--primary-soft); }
</style>