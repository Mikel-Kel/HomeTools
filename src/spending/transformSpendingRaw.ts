import type { Account, SpendingRecord } from "@/composables/spending/useSpending";

/* =========================
   Types backend brut
========================= */
export interface BackendSpendingRow {
  FITID: string;
  Amount: number;
  Account: string;
  Comment?: string;
  PartyName: string;
  PartyID?: number;
  ValueDate: string;
  ExpenseOwner: string;
}

/* =========================
   Transformateur officiel
========================= */
export function transformSpendingRaw(
  raw: BackendSpendingRow[]
): {
  accounts: Account[];
  records: SpendingRecord[];
} {
  if (!Array.isArray(raw)) {
    throw new Error("Backend spending payload is not an array");
  }

  const accountMap = new Map<string, Account>();
  const records: SpendingRecord[] = [];
  for (const row of raw) {
    if (
      !row.FITID ||
      !row.Account ||
      !row.PartyName ||
      !row.ValueDate ||
      typeof row.Amount !== "number" ||
      !row.ExpenseOwner
    ) {
      throw new Error("Invalid backend spending row");
    }

    // Comptes uniques
    if (!accountMap.has(row.Account)) {
      accountMap.set(row.Account, {
        id: row.Account,
        label: row.Account,
      });
    }

    records.push({
      id: row.FITID,
      accountId: row.Account,
      date: row.ValueDate,
      party: row.PartyName,
      partyID: row.PartyID ?? null,
      amount: row.Amount,
      owner: row.ExpenseOwner,
    });
  }

  return {
    accounts: Array.from(accountMap.values()),
    records,
  };
}