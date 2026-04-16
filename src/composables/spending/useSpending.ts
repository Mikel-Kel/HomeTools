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
  partyID: number | null;
  amount: number;
  owner: string;

  // 🔵 NOUVEAU — multi-devise
  currency?: string;            // "CHF", "EUR", "USD", etc.
  foreignAmount?: number | null; // Montant original si != CHF

  // 🔽 additional fields to ease allocation process
  categoryID: number | null;
  subCategoryID: number | null;
  allocComment: string;
  tagID: number | null;
}

export type AllocationStatus = "none" | "partial" | "draft" | "released";

export interface SpendingWithStatus extends SpendingRecord {
  allocationStatus: AllocationStatus;
  draftToProcess: boolean;
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

  function replaceAll(
    newAccounts: Account[],
    newRecords: SpendingRecord[]
  ) {
    accounts.value = newAccounts;
    records.value = newRecords.map(r => ({
      ...r,
      allocationStatus: "none",
      draftToProcess: false,
    }));
  }

  function applyAllocationStatus(
    draftIds: Set<string>,
    releasedIds: Set<string>,
    readyDraftIds: Set<string>
  ) {
    records.value = records.value.map(r => ({
      ...r,

      allocationStatus: releasedIds.has(r.id)
        ? "released"
        : draftIds.has(r.id)
        ? readyDraftIds.has(r.id)
          ? "draft"
          : "partial"
        : "none",

      draftToProcess: readyDraftIds.has(r.id)
    }));
  }
  
  function getRecordsForAccount(accountId: string) {
    return records.value
      .filter(r => r.accountId === accountId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  function getDraftRecords() {
    return records.value.filter(
      r => r.allocationStatus === "draft"
    );
  }

  function getReleaseableDraftRecords() {
    return records.value.filter(
      r =>
        r.allocationStatus === "draft" &&
        r.draftToProcess
    );
  }

const spendingLastModified = ref<string | null>(null);

function setSpendingLastModified(ts: string) {
  spendingLastModified.value = ts;
}

function clear() {
  accounts.value = [];
  records.value = [];
}

return {
    accounts,
    records,
    replaceAll,
    applyAllocationStatus,
    getRecordsForAccount,
    getDraftRecords,
    getReleaseableDraftRecords,
    spendingLastModified,
    setSpendingLastModified,
    clear,
  };
}

