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
export function useSpending() {
  /* =========================
     Replace backend data
  ========================= */
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

  /* =========================
     Apply allocation status
     (from Drive)
  ========================= */
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

  /* =========================
     Get records per account
  ========================= */
  function getRecordsForAccount(
    accountId: string,
    options?: { includeReleased?: boolean }
  ): SpendingWithStatus[] {
    return records.value
      .filter(r =>
        r.accountId === accountId &&
        (options?.includeReleased ||
          r.allocationStatus !== "released")
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }

return {
  // state
  accounts,
  records,

  // actions
  replaceAll,
  applyAllocationStatus, // ✅ MANQUAIT ICI
  getRecordsForAccount,
};
}