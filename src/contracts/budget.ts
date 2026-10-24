import {
  asArray,
  asBoolean,
  asNumber,
  asObject,
  asString,
  type JsonObject,
} from "@/contracts/read";

/* =========================
   Page Budget

   Contrat complet : ../Backend/docs/budget-contract.md.

   allocations/budget/budget.json (exportBudget, étape
   « Export settings ») :
     { "budgets": [ { "year": 2026, "month": 1,
                      "items": [ { "categoryId": 1,
                                   "subCategoryId": 6,
                                   "amount": 0 } ] } ],
       "years": [ { "year": 2026,
                    "subCategories": [ { "subCategoryId": 4,
                                         "open": true,
                                         "memo": "…" | null } ] } ] }

   Montants en francs entiers, sans signe : le signe vient
   de la nature de la catégorie (I revenu, E dépense).
========================= */

/* Même fichier que celui lu par Follow-up. */
export {
  BUDGET_FILE,
  FOLLOW_UP_FOLDER as BUDGET_FOLDER,
} from "@/contracts/followUp";

export function budgetLogFile(
  year: number
): string {
  return `budgetLog-${year}.json`;
}

function objects(
  value: unknown
): JsonObject[] {
  return asArray(value)
    .map(asObject)
    .filter(
      (item): item is JsonObject =>
        item !== null
    );
}

export interface BudgetLine {
  categoryId: number;
  subCategoryId: number;

  /* Janvier à décembre. */
  months: number[];

  open: boolean;
  memo: string | null;
}

export interface BudgetYear {
  year: number;
  lines: BudgetLine[];
}

/*
  Une ligne par sous-catégorie présente dans l'année
  (section years, ou montants de budgets). Années triées
  de la plus récente à la plus ancienne.
*/
export function readBudgetYears(
  raw: unknown
): BudgetYear[] {
  const file =
    asObject(raw);

  const years =
    new Map<number, Map<number, BudgetLine>>();

  function lineOf(
    year: number,
    subCategoryId: number
  ): BudgetLine {
    let lines =
      years.get(year);

    if (!lines) {
      lines = new Map();
      years.set(year, lines);
    }

    let line =
      lines.get(subCategoryId);

    if (!line) {
      line = {
        categoryId: 0,
        subCategoryId,
        months: Array(12).fill(0),
        open: true,
        memo: null,
      };

      lines.set(subCategoryId, line);
    }

    return line;
  }

  for (const month of objects(file?.budgets)) {
    const year =
      asNumber(month.year);

    const index =
      asNumber(month.month) - 1;

    if (!year || index < 0 || index > 11) {
      continue;
    }

    for (const item of objects(month.items)) {
      const line =
        lineOf(
          year,
          asNumber(item.subCategoryId)
        );

      line.categoryId =
        asNumber(item.categoryId);

      line.months[index] =
        asNumber(item.amount);
    }
  }

  for (const entry of objects(file?.years)) {
    const year =
      asNumber(entry.year);

    if (!year) {
      continue;
    }

    /* Une année sans montant reste proposée. */
    if (!years.has(year)) {
      years.set(year, new Map());
    }

    for (const item of objects(entry.subCategories)) {
      const line =
        lineOf(
          year,
          asNumber(item.subCategoryId)
        );

      /* Ouvert sauf indication contraire. */
      line.open =
        item.open !== false;

      line.memo =
        asString(item.memo) || null;
    }
  }

  return [...years.entries()]
    .sort(
      ([a], [b]) => b - a
    )
    .map(
      ([year, lines]) => ({
        year,
        lines: [...lines.values()],
      })
    );
}

/* =========================
   allocations/budget/budgetLog-<année>.json

     { "year": 2026,
       "entries": [
         { "at": "…", "eventType": "BUDGET_UPDATED",
           "source": "Mac", "subCategoryId": 4,
           "label": "Salaire Michel",
           "months": [ { "month": 3, "from": 2570,
                         "to": 2700 } ],
           "open": { "from": true, "to": false },
           "memoChanged": true },
         { "at": "…", "eventType": "BUDGET_YEAR_CREATED",
           "source": "Mac", "sourceYear": 2025,
           "subCategories": 44 } ] }

   Entrées de la plus récente à la plus ancienne.
========================= */

export interface BudgetMonthChange {
  month: number;
  from: number;
  to: number;
}

export interface BudgetLogEntry {
  at: string;
  eventType: string;
  source: string;
  subCategoryId: number | null;
  label: string;
  months: BudgetMonthChange[];
  open: { from: boolean; to: boolean } | null;
  memoChanged: boolean;
  sourceYear: number | null;
}

export function readBudgetLog(
  raw: unknown
): BudgetLogEntry[] {
  return objects(
    asObject(raw)?.entries
  ).map(
    entry => {
      const open =
        asObject(entry.open);

      return {
        at:
          asString(entry.at),

        eventType:
          asString(entry.eventType),

        source:
          asString(entry.source),

        subCategoryId:
          entry.subCategoryId == null
            ? null
            : asNumber(entry.subCategoryId),

        label:
          asString(entry.label),

        months:
          objects(entry.months).map(
            change => ({
              month: asNumber(change.month),
              from: asNumber(change.from),
              to: asNumber(change.to),
            })
          ),

        open:
          open
            ? {
                from: asBoolean(open.from),
                to: asBoolean(open.to),
              }
            : null,

        memoChanged:
          asBoolean(entry.memoChanged),

        sourceYear:
          entry.sourceYear == null
            ? null
            : asNumber(entry.sourceYear),
      };
    }
  );
}
