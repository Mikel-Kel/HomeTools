import { ref } from "vue";

import type { BudgetLine } from "@/contracts/budget";

import {
  getLocalItem,
  removeLocalItem,
  setLocalItem,
} from "@/services/environment/browserStorage";

/* =========================
   Brouillon du budget

   Modifications de la page Budget pas encore envoyées au
   Mac : une entrée par sous-catégorie et par année, avec
   les valeurs saisies (values) et celles de budget.json au
   moment de la première modification (base). « Save all »
   envoie toutes les entrées d'une année en un seul
   événement BUDGET_BATCH_UPDATED
   (../Backend/docs/budget-contract.md).

   Conservé dans l'appareil (localStorage, préfixé par
   l'environnement) : il survit à un rechargement et à la
   fermeture de l'app.

   Une entrée disparaît dès que budget.json contient ses
   valeurs (envoi traité, ou même changement fait ailleurs).
   Si budget.json change autrement pour une ligne du
   brouillon, la ligne est en conflit : garder sa saisie
   (la base devient la version publiée) ou l'abandonner.
========================= */

export interface BudgetLineValues {
  months: number[];
  open: boolean;
  memo: string | null;
}

interface DraftEntry {
  values: BudgetLineValues;
  base: BudgetLineValues;
}

/* Année → sous-catégorie → entrée. */
type Draft = Record<string, Record<string, DraftEntry>>;

const STORAGE_KEY = "budget.draft";

/* Ligne absente du budget de l'année : Open, sans mémo, 12 mois à 0. */
export const EMPTY_LINE_VALUES: BudgetLineValues = {
  months: Array(12).fill(0),
  open: true,
  memo: null,
};

export function lineValues(
  line: BudgetLine | undefined
): BudgetLineValues {
  return line
    ? {
        months: [...line.months],
        open: line.open,
        memo: line.memo,
      }
    : {
        ...EMPTY_LINE_VALUES,
        months: [...EMPTY_LINE_VALUES.months],
      };
}

function normalizedMemo(
  memo: string | null
): string {
  return (memo ?? "").trim();
}

export function sameValues(
  a: BudgetLineValues,
  b: BudgetLineValues
): boolean {
  return (
    a.open === b.open &&
    normalizedMemo(a.memo) === normalizedMemo(b.memo) &&
    a.months.length === b.months.length &&
    a.months.every((value, index) => value === b.months[index])
  );
}

function readDraft(): Draft {
  try {
    const raw =
      getLocalItem(STORAGE_KEY);

    return raw
      ? JSON.parse(raw) as Draft
      : {};

  } catch {
    return {};
  }
}

const draft =
  ref<Draft>({});

/* Lu au premier usage : l'environnement (préfixe des clés) est alors établi. */
let draftRead = false;

function persist() {
  try {
    if (Object.keys(draft.value).length) {
      setLocalItem(STORAGE_KEY, JSON.stringify(draft.value));
    } else {
      removeLocalItem(STORAGE_KEY);
    }

  } catch {
    /* stockage local indisponible : brouillon gardé en mémoire */
  }
}

function setYear(
  year: number,
  entries: Record<string, DraftEntry>
) {
  const next =
    { ...draft.value };

  if (Object.keys(entries).length) {
    next[year] = entries;
  } else {
    delete next[year];
  }

  draft.value = next;

  persist();
}

export function useBudgetDraft() {

  if (!draftRead) {
    draft.value = readDraft();
    draftRead = true;
  }

  function entries(
    year: number
  ): Record<string, DraftEntry> {
    return draft.value[year] ?? {};
  }

  function count(
    year: number
  ): number {
    return Object.keys(entries(year)).length;
  }

  function entry(
    year: number,
    subCategoryId: number
  ): DraftEntry | undefined {
    return entries(year)[subCategoryId];
  }

  /*
    Saisie d'une ligne (« Apply » de la fiche). published :
    valeurs actuelles de budget.json pour cette ligne. Une
    saisie identique à la version publiée retire la ligne du
    brouillon.
  */
  function apply(
    year: number,
    subCategoryId: number,
    published: BudgetLineValues,
    values: BudgetLineValues
  ) {
    const next =
      { ...entries(year) };

    if (sameValues(values, published)) {
      delete next[subCategoryId];
    } else {
      next[subCategoryId] = {
        values,
        base: next[subCategoryId]?.base ?? published,
      };
    }

    setYear(year, next);
  }

  function discard(
    year: number,
    subCategoryIds?: number[]
  ) {
    if (!subCategoryIds) {
      setYear(year, {});
      return;
    }

    const next =
      { ...entries(year) };

    for (const id of subCategoryIds) {
      delete next[id];
    }

    setYear(year, next);
  }

  /* Conflit tranché en gardant la saisie : la version publiée devient la base. */
  function rebase(
    year: number,
    subCategoryId: number,
    published: BudgetLineValues
  ) {
    const current =
      entry(year, subCategoryId);

    if (!current) {
      return;
    }

    setYear(year, {
      ...entries(year),
      [subCategoryId]: { ...current, base: published },
    });
  }

  /*
    Retire les entrées dont budget.json contient déjà les
    valeurs. published : valeurs publiées d'une sous-catégorie
    (ligne absente comprise).
  */
  function prune(
    year: number,
    published: (subCategoryId: number) => BudgetLineValues
  ) {
    const current =
      entries(year);

    const done =
      Object.keys(current)
        .map(Number)
        .filter(id => sameValues(current[id].values, published(id)));

    if (done.length) {
      discard(year, done);
    }
  }

  return {
    draft,
    entries,
    count,
    entry,
    apply,
    discard,
    rebase,
    prune,
  };

}
