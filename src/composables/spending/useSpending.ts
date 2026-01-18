import { ref, computed } from "vue";

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

/* =========================
   State (singleton)
========================= */
const accounts = ref<Account[]>([]);
const records = ref<SpendingRecord[]>([]);

/* =========================
   Composable
========================= */
export function useSpending() {
  function replaceAll(
    newAccounts: Account[],
    newRecords: SpendingRecord[]
  ) {
    accounts.value = newAccounts;
    records.value = newRecords;
  }

  function getRecordsForAccount(
    accountId: string
  ): SpendingRecord[] {
    return records.value
      .filter(r => r.accountId === accountId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  return {
    // state
    accounts,
    records,

    // actions
    replaceAll,
    getRecordsForAccount,
  };
}