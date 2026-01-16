// src/composables/useSpending.ts
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
  date: string;
  party: string;
  amount: number;
}

/* =========================
   State (singleton)
========================= */
const accounts = ref<Account[]>([]);
const recordsByAccount = ref<SpendingRecord[][]>([]);

/* =========================
   Composable
========================= */
export function useSpending() {
  /* =========================
     Replace all data (Drive source)
  ========================= */
  function replaceAll(
    newAccounts: Account[],
    newRecordsByAccount: SpendingRecord[][]
  ) {
    accounts.value = newAccounts;
    recordsByAccount.value = newRecordsByAccount;
  }

  /* =========================
     API publique
  ========================= */
  function getRecordsForAccount(index: number): SpendingRecord[] {
    return recordsByAccount.value[index] ?? [];
  }

  return {
    // state
    accounts,
    recordsByAccount,

    // actions
    replaceAll,
    getRecordsForAccount,
  };
}