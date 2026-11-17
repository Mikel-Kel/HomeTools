import {
  computed,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";

import {
  isForeignMovement,
  type SpendingRecord,
} from "@/composables/spending/useSpending";

import {
  getSessionItem,
  removeSessionItem,
  setSessionItem,
} from "@/services/environment/browserStorage";

/* =========================
   Filtres d'une liste de mouvements

   Porteur, devise, année (Period), dates et montant absolu,
   plus l'état ouvert du panneau. Choix des porteurs, devises
   et années tirés des mouvements reçus. Filtres gardés en
   session sous sessionKey, relus à la création ; Reset les
   efface.

   extension : filtre propre à une vue (ex. statut
   d'allocation de Spending), appliqué, enregistré, relu et
   remis à zéro avec les autres. snapshot() donne ses champs
   enregistrés ; leur nom ne doit pas reprendre ceux d'ici.
========================= */

export interface MovementFilterExtension<T> {
  matches: (record: T) => boolean;
  reset: () => void;
  snapshot: () => Record<string, unknown>;
  restore: (saved: Record<string, unknown>) => void;
}

export interface MovementFiltersOptions<T> {
  /* Tous les mouvements de la vue, avant filtre. */
  records: MaybeRefOrGetter<readonly T[]>;

  /* Mouvements chargés : sans eux, l'année n'est jamais jugée vide. */
  loaded: MaybeRefOrGetter<boolean>;

  sessionKey: string;

  extension?: MovementFilterExtension<T>;
}

/* État des filtres affiché par MovementFilters.vue. */
export type MovementFilterState =
  Omit<
    ReturnType<typeof useMovementFilters>,
    "applyFilters"
  >;

export interface ChipItem {
  id: string;
  label: string;
}

/* Choix d'un ChipSelector multiple, rangé dans un Set. */
function setModel(
  source: { value: Set<string> }
) {
  return computed<string[]>({
    get: () =>
      Array.from(source.value),

    set: value => {
      source.value =
        new Set(value);
    },
  });
}

export function useMovementFilters<T extends SpendingRecord>(
  options: MovementFiltersOptions<T>
) {
  const {
    sessionKey,
    extension,
  } = options;

  /*
    Année par défaut : l'année courante, même sans mouvement.
  */
  const CURRENT_YEAR =
    String(new Date().getFullYear());

  const filtersOpen =
    ref(false);

  const ownerFilter =
    ref<Set<string>>(new Set());

  const currencyFilter =
    ref<Set<string>>(new Set());

  /* Année des mouvements ; null : toutes. */
  const yearFilter =
    ref<string | null>(CURRENT_YEAR);

  const dateFrom =
    ref("");

  const dateTo =
    ref("");

  const minAmount =
    ref<number | null>(null);

  const maxAmount =
    ref<number | null>(null);

  const allRecords =
    computed(() =>
      toValue(options.records)
    );

  /* =========================
     Porteurs
  ========================= */

  const ownerItems =
    computed<ChipItem[]>(() =>
      Array
        .from(
          new Set(
            allRecords.value
              .map(record => record.owner)
              .filter(Boolean)
          )
        )
        .sort()
        .map(owner => ({
          id: owner,
          label: owner,
        }))
    );

  const ownerModel =
    setModel(ownerFilter);

  /* =========================
     Devises
  ========================= */

  /* CHF suivi des devises étrangères ; vide s'il n'y en a aucune. */
  const currencyItems =
    computed<ChipItem[]>(() => {
      const foreign =
        new Set(
          allRecords.value
            .filter(isForeignMovement)
            .map(record => record.currency!)
        );

      if (foreign.size === 0) {
        return [];
      }

      return [
        "CHF",
        ...Array.from(foreign).sort(),
      ].map(currency => ({
        id: currency,
        label: currency,
      }));
    });

  const currencyModel =
    setModel(currencyFilter);

  /* =========================
     Année
  ========================= */

  const recordYears =
    computed(() =>
      new Set(
        allRecords.value.map(record =>
          record.date.slice(0, 4)
        )
      )
    );

  /* L'année courante toujours proposée, la plus récente d'abord. */
  const availableYears =
    computed(() =>
      Array
        .from(
          new Set([
            CURRENT_YEAR,
            ...recordYears.value,
          ])
        )
        .sort()
        .reverse()
    );

  const yearItems =
    computed<ChipItem[]>(() =>
      availableYears.value.map(year => ({
        id: year,
        label: year,
      }))
    );

  /* Année choisie sans aucun mouvement. */
  const selectedYearEmpty =
    computed(() =>
      toValue(options.loaded) &&
      yearFilter.value !== null &&
      !recordYears.value.has(yearFilter.value)
    );

  /*
    Année passée choisie qui n'a plus de mouvement : retour à
    l'année courante.
  */
  watch(
    availableYears,
    years => {
      if (
        toValue(options.loaded) &&
        yearFilter.value !== null &&
        !years.includes(yearFilter.value)
      ) {
        yearFilter.value =
          CURRENT_YEAR;
      }
    }
  );

  /* =========================
     Application
  ========================= */

  function matches(
    record: T
  ): boolean {
    if (
      ownerFilter.value.size &&
      !ownerFilter.value.has(record.owner)
    ) {
      return false;
    }

    if (currencyFilter.value.size) {
      const currency =
        isForeignMovement(record)
          ? record.currency!
          : "CHF";

      if (!currencyFilter.value.has(currency)) {
        return false;
      }
    }

    if (
      yearFilter.value &&
      !record.date.startsWith(yearFilter.value)
    ) {
      return false;
    }

    if (
      dateFrom.value &&
      record.date < dateFrom.value
    ) {
      return false;
    }

    if (
      dateTo.value &&
      record.date > dateTo.value
    ) {
      return false;
    }

    const absoluteAmount =
      Math.abs(record.amount);

    if (
      minAmount.value !== null &&
      absoluteAmount < minAmount.value
    ) {
      return false;
    }

    if (
      maxAmount.value !== null &&
      absoluteAmount > maxAmount.value
    ) {
      return false;
    }

    return extension?.matches(record) ?? true;
  }

  function applyFilters(
    records: readonly T[]
  ): T[] {
    return records.filter(matches);
  }

  function resetFilters() {
    ownerFilter.value = new Set();
    currencyFilter.value = new Set();
    yearFilter.value = CURRENT_YEAR;
    dateFrom.value = "";
    dateTo.value = "";
    minAmount.value = null;
    maxAmount.value = null;

    extension?.reset();

    removeSessionItem(sessionKey);
  }

  /* =========================
     Session
  ========================= */

  function snapshot(): Record<string, unknown> {
    return {
      ...extension?.snapshot(),

      owner: Array.from(ownerFilter.value),
      currency: Array.from(currencyFilter.value),
      year: yearFilter.value,
      dateFrom: dateFrom.value,
      dateTo: dateTo.value,
      minAmount: minAmount.value,
      maxAmount: maxAmount.value,
      filtersOpen: filtersOpen.value,
    };
  }

  function restore() {
    const raw =
      getSessionItem(sessionKey);

    if (!raw) {
      return;
    }

    try {
      const saved =
        JSON.parse(raw);

      ownerFilter.value = new Set(saved.owner ?? []);
      currencyFilter.value = new Set(saved.currency ?? []);

      if ("year" in saved) {
        yearFilter.value = saved.year ?? null;
      }

      dateFrom.value = saved.dateFrom ?? "";
      dateTo.value = saved.dateTo ?? "";
      minAmount.value = saved.minAmount ?? null;
      maxAmount.value = saved.maxAmount ?? null;
      filtersOpen.value = saved.filtersOpen ?? false;

      extension?.restore(saved);

    } catch {
      // Ignore corrupted session storage.
    }
  }

  restore();

  watch(
    snapshot,

    value =>
      setSessionItem(
        sessionKey,
        JSON.stringify(value)
      ),

    {
      deep: true,
    }
  );

  return {
    filtersOpen,

    ownerFilter,
    currencyFilter,
    yearFilter,
    dateFrom,
    dateTo,
    minAmount,
    maxAmount,

    ownerItems,
    ownerModel,
    currencyItems,
    currencyModel,
    yearItems,
    selectedYearEmpty,

    applyFilters,
    resetFilters,
  };
}
