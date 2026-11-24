import {
  computed,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";

import {
  TRANSACTION_TYPES,
  type PortfolioTransaction,
} from "@/contracts/portfolio";

import {
  getSessionItem,
  removeSessionItem,
  setSessionItem,
} from "@/services/environment/browserStorage";

/* =========================
   Filtres du journal du portefeuille

   Même esprit que les filtres des mouvements
   (useMovementFilters) : dépositaire, titre, type, devise,
   année (Period), dates et montant absolu, plus l'état ouvert
   du panneau. Choix tirés des transactions du journal ; un
   choix qui n'y figure plus est retiré. Toutes les années
   par défaut (journal repris depuis l'origine). Filtres
   gardés en session, relus à la création ; Reset les efface.

   - Dépositaire : celui de la transaction ou le destinataire
     d'un transfert.
   - Devise et montant : liquidités réglées, ou reçues d'un
     change.
========================= */

const SESSION_KEY =
  "portfolio.journal.filters";

export interface ChipItem {
  id: string;
  label: string;
}

export interface TransactionFiltersOptions {
  transactions: MaybeRefOrGetter<readonly PortfolioTransaction[]>;

  /* Journal chargé : sans lui, aucun choix n'est retiré. */
  loaded: MaybeRefOrGetter<boolean>;

  partyLabel: (partyId: number) => string;
  securityLabel: (securityId: number) => string;
}

/* État affiché par TransactionFilters.vue. */
export type TransactionFilterState =
  Omit<
    ReturnType<typeof useTransactionFilters>,
    "matches" | "active"
  >;

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

function partiesOf(
  transaction: PortfolioTransaction
): number[] {
  return [transaction.partyId, transaction.toPartyId]
    .filter((id): id is number => id !== null);
}

function currenciesOf(
  transaction: PortfolioTransaction
): string[] {
  return [
    transaction.cashAmount !== null ? transaction.cashCurrency : null,
    transaction.counterAmount !== null ? transaction.counterCurrency : null,
  ].filter((code): code is string => !!code);
}

function amountsOf(
  transaction: PortfolioTransaction
): number[] {
  return [transaction.cashAmount, transaction.counterAmount]
    .filter((amount): amount is number => amount !== null)
    .map(Math.abs);
}

export function useTransactionFilters(
  options: TransactionFiltersOptions
) {
  const filtersOpen =
    ref(false);

  const partyFilter =
    ref<Set<string>>(new Set());

  const securityFilter =
    ref<Set<string>>(new Set());

  const typeFilter =
    ref<Set<string>>(new Set());

  const currencyFilter =
    ref<Set<string>>(new Set());

  /* Année des transactions ; null : toutes. */
  const yearFilter =
    ref<string | null>(null);

  const dateFrom =
    ref("");

  const dateTo =
    ref("");

  const minAmount =
    ref<number | null>(null);

  const maxAmount =
    ref<number | null>(null);

  const partyModel =
    setModel(partyFilter);

  const securityModel =
    setModel(securityFilter);

  const typeModel =
    setModel(typeFilter);

  const currencyModel =
    setModel(currencyFilter);

  const transactions =
    computed(() =>
      toValue(options.transactions)
    );

  /* =========================
     Choix proposés
  ========================= */

  const partyItems =
    computed<ChipItem[]>(() =>
      [...new Set(transactions.value.flatMap(partiesOf))]
        .map(id => ({ id: String(id), label: options.partyLabel(id) }))
        .sort((a, b) => a.label.localeCompare(b.label))
    );

  const securityItems =
    computed<ChipItem[]>(() =>
      [
        ...new Set(
          transactions.value
            .map(transaction => transaction.securityId)
            .filter((id): id is number => id !== null)
        ),
      ]
        .map(id => ({ id: String(id), label: options.securityLabel(id) }))
        .sort((a, b) => a.label.localeCompare(b.label))
    );

  const typeItems =
    computed<ChipItem[]>(() => {
      const used =
        new Set(transactions.value.map(transaction => transaction.type));

      return TRANSACTION_TYPES
        .filter(type => used.has(type.value))
        .map(type => ({ id: type.value, label: type.label }));
    });

  const currencyItems =
    computed<ChipItem[]>(() =>
      [...new Set(transactions.value.flatMap(currenciesOf))]
        .sort()
        .map(code => ({ id: code, label: code }))
    );

  const yearItems =
    computed<ChipItem[]>(() =>
      [...new Set(transactions.value.map(transaction => transaction.date.slice(0, 4)))]
        .sort()
        .reverse()
        .map(year => ({ id: year, label: year }))
    );

  /* Choix qui ne figurent plus dans le journal : retirés. */
  function keepKnown(
    source: { value: Set<string> },
    items: ChipItem[]
  ) {
    const known =
      new Set(items.map(item => item.id));

    const kept =
      [...source.value].filter(id => known.has(id));

    if (kept.length !== source.value.size) {
      source.value = new Set(kept);
    }
  }

  watch(
    [partyItems, securityItems, typeItems, currencyItems, yearItems],
    () => {
      if (!toValue(options.loaded)) {
        return;
      }

      keepKnown(partyFilter, partyItems.value);
      keepKnown(securityFilter, securityItems.value);
      keepKnown(typeFilter, typeItems.value);
      keepKnown(currencyFilter, currencyItems.value);

      if (
        yearFilter.value !== null &&
        !yearItems.value.some(item => item.id === yearFilter.value)
      ) {
        yearFilter.value = null;
      }
    },
    { immediate: true }
  );

  /* =========================
     Application
  ========================= */

  const active =
    computed(() =>
      partyFilter.value.size > 0 ||
      securityFilter.value.size > 0 ||
      typeFilter.value.size > 0 ||
      currencyFilter.value.size > 0 ||
      yearFilter.value !== null ||
      !!dateFrom.value ||
      !!dateTo.value ||
      minAmount.value !== null ||
      maxAmount.value !== null
    );

  function matches(
    transaction: PortfolioTransaction
  ): boolean {
    if (
      partyFilter.value.size &&
      !partiesOf(transaction).some(id => partyFilter.value.has(String(id)))
    ) {
      return false;
    }

    if (
      securityFilter.value.size &&
      !securityFilter.value.has(String(transaction.securityId))
    ) {
      return false;
    }

    if (
      typeFilter.value.size &&
      !typeFilter.value.has(transaction.type)
    ) {
      return false;
    }

    if (
      currencyFilter.value.size &&
      !currenciesOf(transaction).some(code => currencyFilter.value.has(code))
    ) {
      return false;
    }

    if (
      yearFilter.value &&
      !transaction.date.startsWith(yearFilter.value)
    ) {
      return false;
    }

    if (dateFrom.value && transaction.date < dateFrom.value) {
      return false;
    }

    if (dateTo.value && transaction.date > dateTo.value) {
      return false;
    }

    if (minAmount.value !== null || maxAmount.value !== null) {
      const min =
        minAmount.value ?? -Infinity;

      const max =
        maxAmount.value ?? Infinity;

      if (!amountsOf(transaction).some(amount => amount >= min && amount <= max)) {
        return false;
      }
    }

    return true;
  }

  function resetFilters() {
    partyFilter.value = new Set();
    securityFilter.value = new Set();
    typeFilter.value = new Set();
    currencyFilter.value = new Set();
    yearFilter.value = null;
    dateFrom.value = "";
    dateTo.value = "";
    minAmount.value = null;
    maxAmount.value = null;

    removeSessionItem(SESSION_KEY);
  }

  /* =========================
     Session
  ========================= */

  function snapshot(): Record<string, unknown> {
    return {
      party: Array.from(partyFilter.value),
      security: Array.from(securityFilter.value),
      type: Array.from(typeFilter.value),
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
      getSessionItem(SESSION_KEY);

    if (!raw) {
      return;
    }

    try {
      const saved =
        JSON.parse(raw);

      partyFilter.value = new Set(saved.party ?? []);
      securityFilter.value = new Set(saved.security ?? []);
      typeFilter.value = new Set(saved.type ?? []);
      currencyFilter.value = new Set(saved.currency ?? []);
      yearFilter.value = saved.year ?? null;
      dateFrom.value = saved.dateFrom ?? "";
      dateTo.value = saved.dateTo ?? "";
      minAmount.value = saved.minAmount ?? null;
      maxAmount.value = saved.maxAmount ?? null;
      filtersOpen.value = saved.filtersOpen ?? false;

    } catch {
      // Ignore corrupted session storage.
    }
  }

  restore();

  watch(
    snapshot,

    value =>
      setSessionItem(
        SESSION_KEY,
        JSON.stringify(value)
      ),

    {
      deep: true,
    }
  );

  return {
    filtersOpen,
    partyItems,
    partyModel,
    securityItems,
    securityModel,
    typeItems,
    typeModel,
    currencyItems,
    currencyModel,
    yearItems,
    yearFilter,
    dateFrom,
    dateTo,
    minAmount,
    maxAmount,
    resetFilters,
    active,
    matches,
  };
}
