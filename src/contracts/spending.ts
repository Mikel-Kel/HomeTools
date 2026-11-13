import type {
  Account,
  SpendingRecord,
} from "@/composables/spending/useSpending";

import {
  asArray,
  asNumber,
  asObject,
  asString,
  ContractError,
  type JsonObject,
} from "@/contracts/read";

/* =========================
   spending/spending.json

   Contrat complet : ../Backend/docs/spending-contract.md.

   Exporté par exportSpending : les mouvements non encore
   alloués (AllocationChecked = 0), avec la suggestion
   d’allocation de sp_find_allocation_rule.
     { "version": 1, "generatedAt": "…", "count": 45,
       "items": [
         { "account": "…", "valueDate": "2026-10-08",
           "partyName": "…", "amount": -12.5,
           "fitid": "<FITID>", "fallbackPartyID": 0,
           "expenseOwner": "…", "transferTypeID": 0,
           "cardHolderID": 0, "bankDescription": "…",
           "currency": "CHF", "foreignAmount": null,
           "movementPartyID": 802 | null,
           "partyID": 0, "allocPartyName": "…",
           "categoryID": 0, "subCategoryID": 0,
           "allocComment": "…", "tagID": 0 } ] }

   partyName et bankDescription : texte de la banque
   (partyName vaut « - » s'il est vide). movementPartyID :
   contrepartie identifiée d'après ce texte, null si inconnue
   (absent avant le 2026-11-13 : null) ; partyID : partie
   proposée pour l'allocation. L'une n'est jamais déduite de
   l'autre. Libellé affiché : useMovementLabel.

   Un mouvement sans fitid, compte, partie, date ou montant
   rend le fichier invalide.
========================= */

export const SPENDING_FOLDER = "spending";
export const SPENDING_FILE = "spending.json";

export interface SpendingFile {
  accounts: Account[];
  records: SpendingRecord[];
}

function asNullableNumber(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number =
    asNumber(value, Number.NaN);

  return Number.isNaN(number)
    ? null
    : number;
}

export function readSpending(
  raw: unknown
): SpendingFile {
  const items =
    asObject(raw)?.items;

  if (!Array.isArray(items)) {
    throw new ContractError(
      SPENDING_FILE,
      "items is not an array"
    );
  }

  const accounts =
    new Map<string, Account>();

  const records =
    asArray(items).map(
      (value, index): SpendingRecord => {
        const row =
          asObject(value) ?? ({} as JsonObject);

        const fitid =
          asString(row.fitid);

        const account =
          asString(row.account);

        const partyName =
          asString(row.partyName);

        const valueDate =
          asString(row.valueDate);

        if (
          !fitid ||
          !account ||
          !partyName ||
          !valueDate ||
          typeof row.amount !== "number"
        ) {
          throw new ContractError(
            SPENDING_FILE,
            `invalid movement at position ${index + 1}`
          );
        }

        if (!accounts.has(account)) {
          accounts.set(
            account,
            {
              id: account,
              label: account,
            }
          );
        }

        return {
          id: fitid,
          accountId: account,
          date: valueDate,
          party: partyName,
          bankDescription: asString(row.bankDescription),
          movementPartyID: asNullableNumber(row.movementPartyID),
          transferTypeID: asNullableNumber(row.transferTypeID),
          partyID: asNullableNumber(row.partyID),
          amount: row.amount,
          owner: asString(row.expenseOwner),
          currency: asString(row.currency, "CHF") || "CHF",
          foreignAmount: asNullableNumber(row.foreignAmount),
          categoryID: asNullableNumber(row.categoryID),
          subCategoryID: asNullableNumber(row.subCategoryID),
          allocComment: asString(row.allocComment),
          tagID: asNullableNumber(row.tagID),
        };
      }
    );

  return {
    accounts: [...accounts.values()],
    records,
  };
}
