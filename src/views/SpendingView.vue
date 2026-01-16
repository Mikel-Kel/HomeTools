<script setup lang="ts">
import { watch , computed} from "vue";
import { useRouter } from "vue-router";

import PageHeader from "@/components/PageHeader.vue";

import { listFilesInFolder, readJSON } from "@/services/google/googleDrive";

import {
  useSpending,
  type SpendingRecord,
} from "@/composables/spending/useSpending";

const accounts = computed(() => spending.accounts.value);

import { useDrive } from "@/composables/useDrive";

/* =========================
   State
========================= */
const router = useRouter();
const spending = useSpending();

const { driveReady, driveState } = useDrive();

/* =========================
   Navigation
========================= */
function openAllocation(record: SpendingRecord) {
  router.push({
    name: "allocation",
    params: {
      record: JSON.stringify(record),
    },
  });
}

/* =========================
   Utils
========================= */
function formatAmount(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/* =========================
   Drive loader (source unique)
========================= */
async function loadFromDrive() {
  if (!driveState.value) return;

  const folderId = driveState.value.folders.spending;
  console.info("[Spending] folderId =", folderId);

  const files = await listFilesInFolder(folderId);
  console.info("[Spending] files in folder =", files);

  const file = files.find(
    (f) => f.name === "spending.json"
  );

  if (!file) {
    console.warn("[Spending] spending.json not found");
    return;
  }

  const data = await readJSON(file.id);
  if (!data) return;

  // ✅ API officielle du composable
  spending.replaceAll(
    data.accounts ?? [],
    data.recordsByAccount ?? []
  );

  console.info("[Spending] spending.json loaded");
}

/* =========================
   React to Drive readiness
========================= */
watch(
  driveReady,
  (ready) => {
    if (ready) {
      loadFromDrive();
    }
  },
  { immediate: true }
);
</script>

<template>
  <PageHeader title="Spending" icon="shopping_cart" />

  <div class="spending-view">
    <section
      v-for="(account, index) in accounts"
      :key="account.id"
      class="account"
    >
      <h2>{{ account.label }}</h2>

      <table class="spending-table">
        <thead>
          <tr>
            <th class="center">Date</th>
            <th>Party</th>
            <th class="right">Amount</th>
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="record in spending.getRecordsForAccount(index)"
            :key="record.id"
            class="clickable"
            @click="openAllocation(record)"
          >
            <td class="center">{{ record.date }}</td>
            <td>{{ record.party }}</td>
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
</template>

<style scoped>
  .spending-view {
  padding: 1rem;
  background: var(--bg);
  color: var(--text);
}

.account {
  margin-bottom: 32px;
}

/* Table */
.spending-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--surface);
}

.spending-table th,
.spending-table td {
  border: 1px solid var(--border);
  padding: 8px;
}

/* Alignment */
.center {
  text-align: center;
}

.right {
  text-align: right;
}

/* Interaction */
.clickable {
  cursor: pointer;
}

.clickable:hover {
  background: var(--primary-soft);
}

/* Amounts */
.positive {
  color: var(--positive);
}

.negative {
  color: var(--negative);
}
</style>