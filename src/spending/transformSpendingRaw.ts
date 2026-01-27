import type { Account, SpendingRecord } from "@/composables/spending/useSpending";

/* =========================
   Types backend brut
========================= */
export interface BackendSpendingRow {
  fitid: string;
  amount: number;
  account: string;
  partyName: string;
  partyID?: number | null;
  valueDate: string;
  expenseOwner: string;
  // champs ajoutés dans spending.json (déjà en camelCase)
  categoryID?: number | null;
  subCategoryID?: number | null;
  allocComment?: string;
  tagID?: number | null;
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
      !row.fitid ||
      !row.account ||
      !row.partyName ||
      !row.valueDate ||
      typeof row.amount !== "number"
    ) {
      throw new Error("Invalid backend spending row");
    }
    // Comptes uniques
    if (!accountMap.has(row.account)) {
      accountMap.set(row.account, {
        id: row.account,
        label: row.account,
      });
    }

    records.push({
      id: row.fitid,
      accountId: row.account,
      date: row.valueDate,
      party: row.partyName,
      partyID: row.partyID ?? null,
      amount: row.amount,
      owner: row.expenseOwner ?? "",

      // nouveaux champs à véhiculer
      categoryID: row.categoryID ?? null,
      subCategoryID: row.subCategoryID ?? null,
      allocComment: row.allocComment ?? "",
      tagID: row.tagID ?? null,
    });
  }

  return {
    accounts: Array.from(accountMap.values()),
    records,
  };
}