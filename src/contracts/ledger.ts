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
   ledger/ : vue comptable des mouvements (version 2)

   Contrat complet : ../Backend/docs/ledger-contract.md.

   Exporté par ledger_export.py : tous les mouvements par
   compte, avec leur solde et leurs allocations, sur les
   années du Follow-up (année en cours comprise). Un fichier
   par compte et par année, republié après un import, un
   effacement d'import, un rafraîchissement demandé et la
   nuit (§ 6) ; pas après les allocations, seulement
   signalées dans l'index (allocationsChangedAt).

   ledger-index.json (§ 5.2) :
     { "version": 2, "updatedAt": "…", "years": [2025, 2026],
       "accounts": [
         { "accountId": 15, "label": "…", "bank": "…",
           "currency": "CHF", "active": true,
           "balanceSource": "statement" | "carried" | "none",
           "statementBalance": 0 | null, "statementDate": "…" | null,
           "carriedBalance": 0 | null, "carriedDate": "…" | null,
           "balance": 0, "balanceDate": "…",
           "openings": { "2026": 0 },
           "imports": [
             { "importDate": "2026-11-17", "movements": 4,
               "last": true } ],
           "files": [
             { "year": 2026, "file": "ledger-15-2026.json",
               "movements": 470, "updatedAt": "…" } ],
           "exportedAt": "…",
           "allocationsChangedAt": "…" | null } ] }

   ledger-<accountId>-<année>.json (§ 5.3) :
     { "version": 2, "accountId": 15, "year": 2026,
       "updatedAt": "…",
       "movements": [
         { "fitid": "…", "valueDate": "…",
           "operationDate": "…", "importDate": "…",
           "bankDescription": "…",
           "movementPartyID": 0 | null, "transferTypeID": 0,
           "cardHolderID": 0, "expenseOwner": "-",
           "amount": -1, "currency": "CHF",
           "foreignAmount": null, "balance": 0,
           "endOfDay": true, "carried": false,
           "allocated": true, "pending": false,
           "excluded": false,
           "allocations": [
             { "nb": 0, "subCategoryID": 0, "amount": -1,
               "comment": "…", "tagID": 0,
               "allocationDate": "…", "partyID": 0 } ] } ] }

   Solde (§ 4) : seul le solde de fin de journée (endOfDay)
   est exact. Source statement : ancré sur le dernier relevé ;
   carried : sur le dernier report (type 998) ; none : 0 au
   1er janvier de chaque année. Un report (carried) donne le
   solde à la fin de sa date : son montant n'est pas un flux.
   Un mouvement excluded (exclu des dépenses) compte dans le
   solde. pending : ré-allocation en cours. imports : le plus
   récent en premier ; last = l'import effaçable (§ 8).

   Une version autre que 2, un compte sans accountId, ou un
   mouvement sans fitid, date de valeur ou montant, rend le
   fichier invalide.
========================= */

export const LEDGER_FOLDER = "ledger";
export const LEDGER_INDEX_FILE = "ledger-index.json";

const LEDGER_VERSION = 2;

function checkVersion(
  root: JsonObject,
  fileName: string
) {
  if (root.version !== LEDGER_VERSION) {
    throw new ContractError(
      fileName,
      `version ${String(root.version)} not supported (expected ${LEDGER_VERSION})`
    );
  }
}

/* =========================
   Index
========================= */

export type BalanceSource =
  | "statement"
  | "carried"
  | "none";

const BALANCE_SOURCES: readonly string[] = [
  "statement",
  "carried",
  "none",
];

export interface LedgerImport {
  importDate: string;
  movements: number;
  /* Dernier import du compte : le seul effaçable. */
  last: boolean;
}

export interface LedgerFile {
  year: number;
  file: string;
  movements: number;
  /* Dernier changement du contenu : un autre updatedAt = fichier à relire. */
  updatedAt: string;
}

export interface LedgerAccount {
  /* Identifiant de la base (account.AccountID). */
  accountId: number;
  /* Même identifiant, clé des mouvements (Movement.accountId). */
  id: string;
  label: string;
  bank: string;
  currency: string;
  active: boolean;
  balanceSource: BalanceSource;
  /* Source statement : dernier solde de relevé. */
  statementBalance: number | null;
  statementDate: string | null;
  /* Source carried : dernier report (type 998). */
  carriedBalance: number | null;
  carriedDate: string | null;
  /* Solde après le dernier mouvement du compte. */
  balance: number | null;
  balanceDate: string | null;
  /* Solde au début de chaque année exportée, par année (« 2026 »). */
  openings: Record<string, number>;
  /* Le plus récent en premier. */
  imports: LedgerImport[];
  /* Années exportées qui ont des mouvements. */
  files: LedgerFile[];
  exportedAt: string | null;
  /* Premier changement d'allocation depuis le dernier export du compte, null sinon. */
  allocationsChangedAt: string | null;
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

function readFile(
  value: unknown
): LedgerFile | null {
  const row =
    asObject(value);

  const year =
    asNullableNumber(row?.year);

  const file =
    asString(row?.file);

  if (!row || year === null || !file) {
    return null;
  }

  return {
    year,
    file,
    movements: asNumber(row.movements),
    updatedAt: asString(row.updatedAt),
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

  checkVersion(root, LEDGER_INDEX_FILE);

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
            : "none",
          statementBalance: asNullableNumber(row.statementBalance),
          statementDate: asString(row.statementDate) || null,
          carriedBalance: asNullableNumber(row.carriedBalance),
          carriedDate: asString(row.carriedDate) || null,
          balance: asNullableNumber(row.balance),
          balanceDate: asString(row.balanceDate) || null,
          openings: readOpenings(row.openings),
          imports: asArray(row.imports)
            .map(readImport)
            .filter((item): item is LedgerImport => item !== null),
          files: asArray(row.files)
            .map(readFile)
            .filter((item): item is LedgerFile => item !== null),
          exportedAt: asString(row.exportedAt) || null,
          allocationsChangedAt: asString(row.allocationsChangedAt) || null,
        };
      }
    ),
  };
}

/* =========================
   Fichier d'un compte et d'une année
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
  /* Report de solde (type 998) : amount est le solde à la fin de sa date, pas un flux. */
  carried: boolean;
  allocated: boolean;
  /* Ré-allocation en cours. */
  pending: boolean;
  /* Exclu des dépenses, compte dans le solde. */
  excluded: boolean;
  allocations: LedgerAllocation[];
}

export interface LedgerYearFile {
  accountId: number;
  year: number;
  /* Même valeur que l'entrée de l'index quand le fichier est à jour. */
  updatedAt: string;
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

/* Lecteur d'un fichier ; fileName (celui de l'index) sert aux messages d'erreur. */
export function readLedgerYearFile(
  raw: unknown,
  fileName: string
): LedgerYearFile {
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

  checkVersion(root, fileName);

  const accountId =
    asNullableNumber(root.accountId);

  if (accountId === null) {
    throw new ContractError(
      fileName,
      "accountId is missing"
    );
  }

  return {
    accountId,
    year: asNumber(root.year),
    updatedAt: asString(root.updatedAt),

    movements: movements.map(
      (value, index): LedgerMovement => {
        const row =
          asObject(value) ?? ({} as JsonObject);

        const fitid =
          asString(row.fitid);

        const valueDate =
          asString(row.valueDate);

        if (
          !fitid ||
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
          carried: asBoolean(row.carried),
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
   Effacement du dernier import (§ 8)

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

/* =========================
   Rafraîchissement d'un compte (§ 7)

   PWA-LDG_<AAAAMMJJHHMMSS>_A<accountId>.json :
     { "eventType": "LEDGER_REFRESH_REQUESTED", "version": 1,
       "timestamp": "…",
       "payload": { "accountId": 15, "source": "<appareil>" } }

   Le Mac réexporte les fichiers du compte et l'index. Statut :
   « Ledger refreshed: <compte> » ; refus : « Invalid ledger
   event: … ».
========================= */

export const LEDGER_EVENT_TRIGRAM = "LDG";
export const LEDGER_REFRESH_VERSION = 1;

/* Suffixe des événements d'un compte (IMP, LDG). */
export function accountEventSuffix(
  accountId: number
): string {
  return `A${accountId}`;
}
