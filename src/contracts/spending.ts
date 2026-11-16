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
   alloués (AllocationChecked = 0), avec les suggestions
   d’allocation d’allocation_suggest.py (règles et
   historique, ../Backend/docs/allocation-rules-contract.md,
   § 4 et § 12).
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
           "allocComment": "…", "tagID": 0,
           "allocDate": "2026-10-08",
           "suggestions": [
             { "source": "rule", "ruleId": 12,
               "partyID": 0, "allocPartyName": "…",
               "categoryID": 0, "subCategoryID": 0,
               "allocComment": "…", "tagID": 0,
               "allocDate": "2026-10-08",
               "contradicted": true,
               "confidence": null, "recent": null } ] } ] }

   partyName et bankDescription : texte de la banque
   (partyName vaut « - » s'il est vide). movementPartyID :
   contrepartie identifiée d'après ce texte, null si inconnue
   (absent avant le 2026-11-13 : null) ; partyID : partie
   proposée pour l'allocation. L'une n'est jamais déduite de
   l'autre. Libellé affiché : useMovementLabel.

   partyID … tagID : suggestion principale, première de
   suggestions (au plus 5 candidats, dans l'ordre).
   allocDate : mois de référence proposé (date de valeur
   décalée). Absents (ancien fichier, échec du moteur) :
   allocDate null, suggestions [] ; un candidat de source
   inconnue est ignoré. Une règle peut ne proposer que la
   partie (catégorie et sous-catégorie null).

   Un mouvement sans fitid, compte, partie, date ou montant
   rend le fichier invalide.
========================= */

export const SPENDING_FOLDER = "spending";
export const SPENDING_FILE = "spending.json";

export type SuggestionSource =
  | "rule"
  | "learn-party"
  | "learn-text"
  | "party"
  | "bank";

const SUGGESTION_SOURCES: readonly string[] = [
  "rule",
  "learn-party",
  "learn-text",
  "party",
  "bank",
];

export interface AllocationSuggestion {
  source: SuggestionSource;
  ruleId: number | null;
  partyID: number | null;
  allocPartyName: string;
  categoryID: number | null;
  subCategoryID: number | null;
  allocComment: string;
  tagID: number | null;
  allocDate: string | null;

  /* Règle migrée passée derrière l'historique. */
  contradicted: boolean;

  /* Historique : confiance (0 à 1) et allocations parmi les 10 dernières. */
  confidence: number | null;
  recent: number | null;
}

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

function readSuggestion(
  value: unknown
): AllocationSuggestion | null {
  const row =
    asObject(value);

  if (!row) {
    return null;
  }

  const source =
    asString(row.source);

  if (!SUGGESTION_SOURCES.includes(source)) {
    return null;
  }

  return {
    source: source as SuggestionSource,
    ruleId: asNullableNumber(row.ruleId),
    partyID: asNullableNumber(row.partyID),
    allocPartyName: asString(row.allocPartyName),
    categoryID: asNullableNumber(row.categoryID) || null,
    subCategoryID: asNullableNumber(row.subCategoryID) || null,
    allocComment: asString(row.allocComment),
    tagID: asNullableNumber(row.tagID),
    allocDate: asString(row.allocDate) || null,
    contradicted: row.contradicted === true,
    confidence: asNullableNumber(row.confidence),
    recent: asNullableNumber(row.recent),
  };
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
          allocDate: asString(row.allocDate) || null,
          suggestions: asArray(row.suggestions)
            .map(readSuggestion)
            .filter(
              (suggestion): suggestion is AllocationSuggestion =>
                suggestion !== null
            ),
        };
      }
    );

  return {
    accounts: [...accounts.values()],
    records,
  };
}
