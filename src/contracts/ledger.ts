import type { Movement } from "@/composables/spending/useSpending";

import {
  asArray,
  asBoolean,
  asNullableNumber,
  asNumber,
  asObject,
  asString,
  ContractError,
  type JsonObject,
} from "@/contracts/read";

/* =========================
   ledger/ : vue comptable des mouvements

   Contrat complet : ../Backend/docs/ledger-contract.md.

   Exporté par ledger_export.py (exportLedger, aussi lancé
   par exportSpending) : tous les mouvements par compte, avec
   leur solde et leurs allocations, sur les années du
   Follow-up (année en cours comprise).

   ledger-index.json (§ 3.1) :
     { "version": 1, "updatedAt": "…", "years": [2025, 2026],
       "accounts": [
         { "accountId": 15, "label": "…", "bank": "…",
           "currency": "CHF", "active": true,
           "balanceSource": "statement" | "initial" | "computed",
           "statementBalance": 0 | null, "statementDate": "…" | null,
           "balance": 0, "balanceDate": "…",
           "openings": { "2026": 0 },
           "imports": [
             { "importDate": "2026-11-17", "movements": 4,
               "last": true } ] } ] }

   ledger-<année>.json (§ 3.2) :
     { "version": 1, "year": 2026, "updatedAt": "…",
       "movements": [
         { "fitid": "…", "accountId": 15,
           "valueDate": "…", "operationDate": "…",
           "importDate": "…", "bankDescription": "…",
           "movementPartyID": 0 | null, "transferTypeID": 0,
           "cardHolderID": 0, "expenseOwner": "-",
           "amount": -1, "currency": "CHF",
           "foreignAmount": null, "balance": 0,
           "endOfDay": true, "allocated": true,
           "pending": false, "excluded": false,
           "allocations": [
             { "nb": 0, "subCategoryID": 0, "amount": -1,
               "comment": "…", "tagID": 0,
               "allocationDate": "…", "partyID": 0 } ] } ] }

   Solde (§ 2) : seul le solde de fin de journée (endOfDay)
   est exact ; les autres soldes d'une journée sont
   indicatifs. Un mouvement excluded (exclu des dépenses)
   compte dans le solde. pending : ré-allocation en cours.
   imports : le plus récent en premier ; last = l'import
   effaçable (§ 5, événement PWA-IMP_…).

   Un compte sans accountId, ou un mouvement sans fitid,
   compte, date de valeur ou montant, rend le fichier
   invalide.
========================= */

export const LEDGER_FOLDER = "ledger";
export const LEDGER_INDEX_FILE = "ledger-index.json";

export function ledgerYearFile(
  year: number
): string {
  return `ledger-${year}.json`;
}

/* =========================
   Index
========================= */

export type BalanceSource =
  | "statement"
  | "initial"
  | "computed";

const BALANCE_SOURCES: readonly string[] = [
  "statement",
  "initial",
  "computed",
];

export interface LedgerImport {
  importDate: string;
  movements: number;
  /* Dernier import du compte : le seul effaçable. */
  last: boolean;
}

export interface LedgerAccount {
  /* Identifiant de la base (account.IDAccount). */
  accountId: number;
  /* Même identifiant, clé des mouvements (Movement.accountId). */
  id: string;
  label: string;
  bank: string;
  currency: string;
  active: boolean;
  balanceSource: BalanceSource;
  statementBalance: number | null;
  statementDate: string | null;
  /* Solde après le dernier mouvement du compte. */
  balance: number | null;
  balanceDate: string | null;
  /* Solde au début de chaque année exportée, par année (« 2026 »). */
  openings: Record<string, number>;
  /* Le plus récent en premier. */
  imports: LedgerImport[];
}

export interface LedgerIndex {
  updatedAt: string;
  /* Années exportées, la plus ancienne en premier. */
  years: number[];
  accounts: LedgerAccount[];
}

function readImport(
  value: unknown
): LedgerImport | null {
  const row =
    asObject(value);

  const importDate =
    asString(row?.importDate);

  if (!row || !importDate) {
    return null;
  }

  return {
    importDate,
    movements: asNumber(row.movements),
    last: asBoolean(row.last),
  };
}

function readOpenings(
  value: unknown
): Record<string, number> {
  const openings: Record<string, number> = {};

  for (const [year, amount] of Object.entries(asObject(value) ?? {})) {
    const number =
      asNullableNumber(amount);

    if (number !== null) {
      openings[year] = number;
    }
  }

  return openings;
}

export function readLedgerIndex(
  raw: unknown
): LedgerIndex {
  const root =
    asObject(raw);

  const accounts =
    root?.accounts;

  if (!root || !Array.isArray(accounts)) {
    throw new ContractError(
      LEDGER_INDEX_FILE,
      "accounts is not an array"
    );
  }

  return {
    updatedAt: asString(root.updatedAt),

    years: asArray(root.years)
      .map(year => asNullableNumber(year))
      .filter((year): year is number => year !== null)
      .sort((a, b) => a - b),

    accounts: accounts.map(
      (value, index): LedgerAccount => {
        const row =
          asObject(value) ?? ({} as JsonObject);

        const accountId =
          asNullableNumber(row.accountId);

        if (accountId === null) {
          throw new ContractError(
            LEDGER_INDEX_FILE,
            `invalid account at position ${index + 1}`
          );
        }

        const source =
          asString(row.balanceSource);

        return {
          accountId,
          id: String(accountId),
          label: asString(row.label) || String(accountId),
          bank: asString(row.bank),
          currency: asString(row.currency, "CHF") || "CHF",
          active: row.active !== false,
          balanceSource: BALANCE_SOURCES.includes(source)
            ? source as BalanceSource
            : "computed",
          statementBalance: asNullableNumber(row.statementBalance),
          statementDate: asString(row.statementDate) || null,
          balance: asNullableNumber(row.balance),
          balanceDate: asString(row.balanceDate) || null,
          openings: readOpenings(row.openings),
          imports: asArray(row.imports)
            .map(readImport)
            .filter((item): item is LedgerImport => item !== null),
        };
      }
    ),
  };
}

/* =========================
   Année
========================= */

export interface LedgerAllocation {
  nb: number;
  subCategoryID: number | null;
  amount: number;
  comment: string;
  /* 0 : sans tag. */
  tagID: number;
  allocationDate: string | null;
  partyID: number | null;
}

export interface LedgerMovement extends Movement {
  operationDate: string | null;
  importDate: string | null;
  /* Solde après ce mouvement ; exact seulement si endOfDay. */
  balance: number | null;
  endOfDay: boolean;
  allocated: boolean;
  /* Ré-allocation en cours. */
  pending: boolean;
  /* Exclu des dépenses, compte dans le solde. */
  excluded: boolean;
  allocations: LedgerAllocation[];
}

export interface LedgerYear {
  year: number;
  movements: LedgerMovement[];
}

function readAllocation(
  value: unknown
): LedgerAllocation | null {
  const row =
    asObject(value);

  if (!row) {
    return null;
  }

  return {
    nb: asNumber(row.nb),
    subCategoryID: asNullableNumber(row.subCategoryID) || null,
    amount: asNumber(row.amount),
    comment: asString(row.comment),
    tagID: asNumber(row.tagID),
    allocationDate: asString(row.allocationDate) || null,
    partyID: asNullableNumber(row.partyID) || null,
  };
}

/* Lecteur d'un fichier d'année ; fileName sert aux messages d'erreur. */
export function readLedgerYear(
  raw: unknown,
  fileName: string
): LedgerYear {
  const root =
    asObject(raw);

  const movements =
    root?.movements;

  if (!root || !Array.isArray(movements)) {
    throw new ContractError(
      fileName,
      "movements is not an array"
    );
  }

  return {
    year: asNumber(root.year),

    movements: movements.map(
      (value, index): LedgerMovement => {
        const row =
          asObject(value) ?? ({} as JsonObject);

        const fitid =
          asString(row.fitid);

        const accountId =
          asNullableNumber(row.accountId);

        const valueDate =
          asString(row.valueDate);

        if (
          !fitid ||
          accountId === null ||
          !valueDate ||
          typeof row.amount !== "number"
        ) {
          throw new ContractError(
            fileName,
            `invalid movement at position ${index + 1}`
          );
        }

        const bankDescription =
          asString(row.bankDescription);

        return {
          id: fitid,
          accountId: String(accountId),
          date: valueDate,
          party: bankDescription || "-",
          bankDescription,
          movementPartyID: asNullableNumber(row.movementPartyID),
          transferTypeID: asNullableNumber(row.transferTypeID),
          amount: row.amount,
          owner: asString(row.expenseOwner),
          currency: asString(row.currency, "CHF") || "CHF",
          foreignAmount: asNullableNumber(row.foreignAmount),

          operationDate: asString(row.operationDate) || null,
          importDate: asString(row.importDate) || null,
          balance: asNullableNumber(row.balance),
          endOfDay: asBoolean(row.endOfDay),
          allocated: asBoolean(row.allocated),
          pending: asBoolean(row.pending),
          excluded: asBoolean(row.excluded),
          allocations: asArray(row.allocations)
            .map(readAllocation)
            .filter(
              (allocation): allocation is LedgerAllocation =>
                allocation !== null
            ),
        };
      }
    ),
  };
}

/* =========================
   Effacement du dernier import (§ 5)

   PWA-IMP_<AAAAMMJJHHMMSS>_A<accountId>.json :
     { "eventType": "IMPORT_DELETED", "version": 1,
       "timestamp": "…",
       "payload": { "accountId": 15,
                    "importDate": "2026-11-17",
                    "source": "<appareil>" } }

   Seul le dernier import d'un compte est accepté. Effacés :
   ses mouvements sans allocation ; conservés : ceux qui ont
   une allocation (base, draft ou partial). Statut du Mac :
   « 42 movements deleted, 3 kept (allocated) » ; refus :
   « Invalid import event: … ».
========================= */

export const IMPORT_EVENT_TRIGRAM = "IMP";
export const IMPORT_DELETED_VERSION = 1;

export function importEventSuffix(
  accountId: number
): string {
  return `A${accountId}`;
}
