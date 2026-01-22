import { ref } from "vue";

/* =========================
   Types
========================= */
export interface Account {
  id: string;
  label: string;
}

export interface SpendingRecord {
  id: string;
  accountId: string;
  date: string;
  party: string;
  amount: number;
  owner: string;
}

export type AllocationStatus = "none" | "draft" | "released";

export interface SpendingWithStatus extends SpendingRecord {
  allocationStatus: AllocationStatus;
}

/* =========================
   State (singleton)
========================= */
const accounts = ref<Account[]>([]);
const records = ref<SpendingWithStatus[]>([]);

/* =========================
   Composable
========================= */
// useSpending.ts
export function useSpending() {
  function replaceAll(
    newAccounts: Account[],
    newRecords: SpendingRecord[]
  ) {
    accounts.value = newAccounts;
    records.value = newRecords.map(r => ({
      ...r,
      allocationStatus: "none",
    }));
  }

  function applyAllocationStatus(
    draftIds: Set<string>,
    releasedIds: Set<string>
  ) {
    records.value = records.value.map(r => ({
      ...r,
      allocationStatus: releasedIds.has(r.id)
        ? "released"
        : draftIds.has(r.id)
        ? "draft"
        : "none",
    }));
  }

  function getRecordsForAccount(accountId: string) {
    return records.value
      .filter(r => r.accountId === accountId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  return {
    accounts,
    records,
    replaceAll,
    applyAllocationStatus,
    getRecordsForAccount,
  };
}