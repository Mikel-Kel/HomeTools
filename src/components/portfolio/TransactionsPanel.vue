<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from "vue";

import TransactionFilters from "@/components/portfolio/TransactionFilters.vue";
import TransactionSheet from "@/components/portfolio/TransactionSheet.vue";
import PillButton from "@/components/ui/PillButton.vue";
import StatusPill from "@/components/ui/StatusPill.vue";

import { useEventRequest } from "@/composables/useEventRequest";
import { useParties } from "@/composables/useParties";
import { usePersistentRef } from "@/composables/usePersistentRef";
import { useRemoteJson } from "@/composables/useRemoteJson";
import { useTransactionFilters } from "@/composables/portfolio/useTransactionFilters";
import { useStorageAccess } from "@/composables/useStorageAccess";

import { isStandardParty } from "@/contracts/parties";

import {
  INDICATORS_FOLDER,
  MARKET_HISTORY_FILE,
} from "@/contracts/indicators";

import {
  compareReplayOrder,
  PORTFOLIO_EVENT_TRIGRAM,
  PORTFOLIO_FOLDER,
  PORTFOLIO_TRANSACTIONS_FILE,
  readPortfolioMarketChoices,
  readPortfolioTransactions,
  transactionDeleteSuffix,
  transactionEventSuffix,
  transactionTypeLabel,
  type PortfolioPosition,
  type PortfolioSecurity,
  type PortfolioTransaction,
} from "@/contracts/portfolio";

import { eventFilePattern } from "@/services/events/eventFiles";

import {
  formatAmount,
  formatQuantity,
  formatTradeValue,
} from "@/utils/amountFormat";

/* =========================
   Journal des transactions

   transactions.json, relu dès que le Mac le republie, du
   plus récent au plus ancien dans l'ordre inverse du rejeu
   (§ 4.1), filtré par TransactionFilters
   (useTransactionFilters), découpé par trimestre, comme
   Follow-up par mois (en-têtes repliables, trimestre le plus
   récent ouvert au départ, trimestres ouverts gardés en
   session). Création,
   modification et suppression par TransactionSheet (clic sur
   une ligne). Devises proposées : market-history.json, chargé
   à la première ouverture d'une fiche (fichier volumineux).

   Solde courant : liquidités du dépositaire dans la devise
   réglée après la transaction, cumulées depuis 0 sur tout le
   journal dans l'ordre du rejeu, comme le Mac ; les filtres
   ne le changent pas. Change : un solde par devise.

   « Pending » est déduit des événements qui attendent dans
   events/, quel que soit l'appareil.
========================= */

const NO_ANSWER_DELAY_MS =
  2 * 60 * 1000;

const props = defineProps<{
  securities: PortfolioSecurity[];

  /* Positions publiées : quantités proposées pour une vente ou un transfert. */
  positions: PortfolioPosition[];
}>();

const transactionsFile =
  useRemoteJson({
    folder: PORTFOLIO_FOLDER,
    file: PORTFOLIO_TRANSACTIONS_FILE,
    read: readPortfolioTransactions,
  });

const transactions =
  computed(() =>
    transactionsFile.data.value ?? []
  );

/* Noms des dépositaires. */
const partiesStore =
  useParties();

const { storageReady } =
  useStorageAccess();

watch(
  storageReady,
  ready => {
    if (ready) {
      partiesStore.load().catch(
        err =>
          console.warn(
            "Unable to load parties",
            err
          )
      );
    }
  },
  { immediate: true }
);

function partyLabel(
  partyId: number | null
): string {
  if (partyId === null) {
    return "";
  }

  return partiesStore.getParty(partyId)?.label ?? `Party ${partyId}`;
}

const securityById =
  computed(() =>
    new Map(
      props.securities.map(security => [security.securityId, security])
    )
  );

function securityLabel(
  securityId: number | null
): string {
  return securityId === null
    ? ""
    : securityById.value.get(securityId)?.label ?? `Security ${securityId}`;
}

function currencyOf(
  transaction: PortfolioTransaction
): string {
  return transaction.securityId === null
    ? ""
    : securityById.value.get(transaction.securityId)?.currency ?? "";
}

/* =========================
   Filtres
========================= */

const filters =
  useTransactionFilters({
    transactions,
    loaded: () => !!transactionsFile.data.value,
    partyLabel,
    securityLabel,
  });

/* Ordre du rejeu du Mac. */
const replayed =
  computed(() =>
    [...transactions.value].sort(compareReplayOrder)
  );

interface RunningBalance {
  currency: string;
  amount: number;
}

/* Solde par dépositaire et devise après chaque transaction, en centimes pour éviter les écarts d'arrondi. */
const balances =
  computed(() => {
    const cents =
      new Map<string, number>();

    const result =
      new Map<number, RunningBalance[]>();

    function add(
      partyId: number | null,
      currency: string | null,
      amount: number | null
    ): RunningBalance | null {
      if (amount === null || !currency) {
        return null;
      }

      const key =
        `${partyId}|${currency}`;

      const total =
        (cents.get(key) ?? 0) + Math.round(amount * 100);

      cents.set(key, total);

      return { currency, amount: total / 100 };
    }

    for (const transaction of replayed.value) {
      const lines = [
        add(transaction.partyId, transaction.cashCurrency, transaction.cashAmount),
        add(transaction.partyId, transaction.counterCurrency, transaction.counterAmount),
      ].filter((line): line is RunningBalance => line !== null);

      result.set(transaction.txId, lines);
    }

    return result;
  });

function balancesOf(
  transaction: PortfolioTransaction
): RunningBalance[] {
  return balances.value.get(transaction.txId) ?? [];
}

const visibleTransactions =
  computed(() =>
    [...replayed.value].reverse().filter(filters.matches)
  );

/* =========================
   Trimestres
========================= */

interface QuarterGroup {
  key: string;
  label: string;
  items: PortfolioTransaction[];
  totals: RunningBalance[];
  balances: RunningBalance[];
}

/* « 2026-11-24 » → « 2026-Q4 ». */
function quarterKey(
  date: string
): string {
  const month =
    Number(date.slice(5, 7));

  return `${date.slice(0, 4)}-Q${Math.ceil(month / 3)}`;
}

/* « 2026-Q4 » → « Q4 2026 ». */
function quarterLabel(
  key: string
): string {
  const [year, quarter] =
    key.split("-");

  return `${quarter} ${year}`;
}

/* Liquidités nettes d'un trimestre par devise (réglées et reçues d'un change), en centimes ; totaux nuls omis. */
function quarterTotals(
  items: readonly PortfolioTransaction[]
): RunningBalance[] {
  const cents =
    new Map<string, number>();

  function add(
    currency: string | null,
    amount: number | null
  ) {
    if (amount !== null && currency) {
      cents.set(currency, (cents.get(currency) ?? 0) + Math.round(amount * 100));
    }
  }

  for (const transaction of items) {
    add(transaction.cashCurrency, transaction.cashAmount);
    add(transaction.counterCurrency, transaction.counterAmount);
  }

  return centsToLines(cents);
}

/* Montants en centimes par devise → lignes triées par devise, montants nuls omis. */
function centsToLines(
  cents: ReadonlyMap<string, number>
): RunningBalance[] {
  return [...cents]
    .filter(([, total]) => total !== 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, total]) => ({ currency, amount: total / 100 }));
}

/* Soldes en fin de trimestre par devise, cumulés sur les dépositaires et devises retenus par les filtres
   (tous sinon), sur tout le journal ; soldes nuls omis. */
const quarterEndBalances =
  computed(() => {
    const parties =
      new Set(filters.partyModel.value);

    const currencies =
      new Set(filters.currencyModel.value);

    const kept = (partyId: number | null, currency: string) =>
      (!parties.size || parties.has(String(partyId))) &&
      (!currencies.size || currencies.has(currency));

    const cents =
      new Map<string, number>();

    const result =
      new Map<string, RunningBalance[]>();

    function add(
      partyId: number | null,
      currency: string | null,
      amount: number | null
    ) {
      if (amount !== null && currency && kept(partyId, currency)) {
        cents.set(currency, (cents.get(currency) ?? 0) + Math.round(amount * 100));
      }
    }

    for (const transaction of replayed.value) {
      add(transaction.partyId, transaction.cashCurrency, transaction.cashAmount);
      add(transaction.partyId, transaction.counterCurrency, transaction.counterAmount);

      result.set(quarterKey(transaction.date), centsToLines(cents));
    }

    return result;
  });

/* Transactions affichées, déjà du plus récent au plus ancien. */
const quarterGroups =
  computed<QuarterGroup[]>(() => {
    const groups: QuarterGroup[] = [];

    for (const transaction of visibleTransactions.value) {
      const key =
        quarterKey(transaction.date);

      const last =
        groups[groups.length - 1];

      if (last?.key === key) {
        last.items.push(transaction);
      } else {
        groups.push({ key, label: quarterLabel(key), items: [transaction], totals: [], balances: [] });
      }
    }

    for (const group of groups) {
      group.totals = quarterTotals(group.items);
      group.balances = quarterEndBalances.value.get(group.key) ?? [];
    }

    return groups;
  });

/* Trimestres ouverts ; null : pas encore choisis, le plus récent est ouvert. */
const openQuarters =
  usePersistentRef<string[] | null>("portfolio.journal.openQuarters", null);

function isOpen(
  key: string
): boolean {
  return openQuarters.value === null
    ? key === quarterGroups.value[0]?.key
    : openQuarters.value.includes(key);
}

function toggleQuarter(
  key: string
) {
  const open =
    quarterGroups.value
      .map(group => group.key)
      .filter(isOpen);

  openQuarters.value =
    open.includes(key)
      ? open.filter(item => item !== key)
      : [...open, key];
}

/* =========================
   Suivi des demandes
========================= */

const events =
  useEventRequest({
    trigram: PORTFOLIO_EVENT_TRIGRAM,
    noAnswerDelayMs: NO_ANSWER_DELAY_MS,
  });

const eventPattern =
  eventFilePattern(PORTFOLIO_EVENT_TRIGRAM);

const waitingSuffixes =
  computed(() =>
    new Set(
      events.waitingFiles.value
        .map(name => eventPattern.exec(name)?.[1])
        .filter((suffix): suffix is string => !!suffix)
    )
  );

const newWaiting =
  computed(() =>
    events.waitingFiles.value
      .filter(name =>
        eventPattern.exec(name)?.[1] === transactionEventSuffix(null)
      )
      .length
  );

function isPending(
  txId: number
): boolean {
  return (
    waitingSuffixes.value.has(transactionEventSuffix(txId)) ||
    waitingSuffixes.value.has(transactionDeleteSuffix(txId))
  );
}

/* =========================
   Affichage
========================= */

/* Quantité, ou ratio d'un split. */
function quantityText(
  transaction: PortfolioTransaction
): string {
  return transaction.type === "SPLIT"
    ? `${transaction.splitFrom} → ${transaction.splitTo}`
    : formatQuantity(transaction.quantity);
}

/* Prix de l'avis, ou brut d'un dividende. */
function priceText(
  transaction: PortfolioTransaction
): string {
  const amount =
    transaction.price ?? transaction.grossAmount;

  return amount === null
    ? ""
    : `${currencyOf(transaction)} ${formatTradeValue(amount)}`;
}

function costsText(
  transaction: PortfolioTransaction
): string {
  const total =
    transaction.fees + transaction.taxes;

  return total === 0
    ? ""
    : formatAmount(total);
}

function costsTitle(
  transaction: PortfolioTransaction
): string {
  return `Fees ${formatAmount(transaction.fees)} · Taxes ${formatAmount(transaction.taxes)}`;
}

function cashClass(
  amount: number | null
): string {
  if (amount === null || amount === 0) {
    return "";
  }

  return amount > 0 ? "gain" : "loss";
}

/* =========================
   Fiche
========================= */

/* undefined : fiche fermée ; null : nouvelle transaction. */
const editing =
  ref<PortfolioTransaction | null | undefined>(undefined);

/* Nouvelle transaction copiée d'une autre (Duplicate). */
const template =
  ref<PortfolioTransaction | null>(null);

/* Change à chaque ouverture : une copie remplace la fiche ouverte. */
const sheetKey =
  ref(0);

const marketNeeded =
  ref(false);

const marketFile =
  useRemoteJson({
    folder: INDICATORS_FOLDER,
    file: () => marketNeeded.value ? MARKET_HISTORY_FILE : null,
    read: readPortfolioMarketChoices,
    watchRemote: false,
  });

const currencies =
  computed(() =>
    [
      ...new Set([
        ...(marketFile.data.value?.currencies ?? ["CHF"]),
        ...props.securities.map(security => security.currency),
      ]),
    ]
  );

const custodians =
  computed(() =>
    partiesStore.parties.value.filter(isStandardParty)
  );

const usedPartyIds =
  computed(() => [
    ...new Set(
      transactions.value.flatMap(transaction =>
        [transaction.partyId, transaction.toPartyId]
          .filter((id): id is number => id !== null)
      )
    ),
  ]);

function openSheet(
  transaction: PortfolioTransaction | null
) {
  if (transaction && isPending(transaction.txId)) {
    return;
  }

  marketNeeded.value = true;
  template.value = null;
  editing.value = transaction;
  sheetKey.value++;
}

function duplicate(
  transaction: PortfolioTransaction
) {
  template.value = transaction;
  editing.value = null;
  sheetKey.value++;
}

async function closeSheet() {
  editing.value = undefined;
  template.value = null;

  await events.check().catch(
    err =>
      console.warn(
        "Unable to read events",
        err
      )
  );
}

const expandedComment =
  ref<number | null>(null);

function toggleComment(
  txId: number
) {
  expandedComment.value =
    expandedComment.value === txId ? null : txId;
}
</script>

<template>
  <section class="panel">
    <div class="panel-header">
      <h2>Transactions</h2>

      <div class="header-actions">
        <StatusPill
          v-if="newWaiting"
          tone="warning"
        >
          {{ newWaiting }} new pending
        </StatusPill>

        <PillButton
          variant="primary"
          @click="openSheet(null)"
        >
          New transaction
        </PillButton>
      </div>
    </div>

    <TransactionFilters
      v-if="transactionsFile.data.value"
      :filters="filters"
    />

    <p
      v-if="transactionsFile.error.value"
      class="message error"
    >
      {{ transactionsFile.error.value }}
    </p>

    <p
      v-else-if="!transactionsFile.data.value"
      class="message"
    >
      Loading the transactions…
    </p>

    <p
      v-else-if="!visibleTransactions.length"
      class="message"
    >
      {{ transactions.length ? "No transaction for these filters." : "No transaction yet." }}
    </p>

    <div
      v-else
      class="table-scroll"
    >
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Security</th>
            <th>Custodian</th>
            <th class="number">Quantity</th>
            <th class="number">Price / gross</th>
            <th class="number">FX rate</th>
            <th class="number">Fees + taxes</th>
            <th class="number">Cash</th>
            <th class="number">Balance</th>
            <th />
          </tr>
        </thead>

        <template
          v-for="group in quarterGroups"
          :key="group.key"
        >
          <tbody>
            <tr
              class="group-header"
              @click="toggleQuarter(group.key)"
            >
              <td colspan="8">
                <span class="group-toggle">{{ isOpen(group.key) ? "▼" : "►" }}</span>
                {{ group.label }}
                <span class="group-count">({{ group.items.length }})</span>
              </td>
              <td
                class="number group-amounts"
                title="Net cash of the quarter"
              >
                <span
                  v-for="line in group.totals"
                  :key="line.currency"
                  class="balance-line"
                  :class="{ loss: line.amount < 0 }"
                >
                  {{ line.currency }} {{ formatAmount(line.amount, { showPlus: true }) }}
                </span>
              </td>
              <td
                class="number group-amounts"
                title="Balance at the end of the quarter"
              >
                <span
                  v-for="line in group.balances"
                  :key="line.currency"
                  class="balance-line"
                  :class="{ loss: line.amount < 0 }"
                >
                  {{ line.currency }} {{ formatAmount(line.amount) }}
                </span>
              </td>
              <td />
            </tr>
          </tbody>

          <template v-if="isOpen(group.key)">
            <tbody
              v-for="transaction in group.items"
              :key="transaction.txId"
            >
              <tr
                class="transaction-row"
                @click="openSheet(transaction)"
              >
                <td>{{ transaction.date }}</td>
                <td>{{ transactionTypeLabel(transaction.type) }}</td>
                <td class="name">{{ securityLabel(transaction.securityId) }}</td>
                <td>
                  {{ partyLabel(transaction.partyId) }}
                  <template v-if="transaction.toPartyId !== null">
                    → {{ partyLabel(transaction.toPartyId) }}
                  </template>
                </td>
                <td class="number">{{ quantityText(transaction) }}</td>
                <td class="number">{{ priceText(transaction) }}</td>
                <td class="number">
                  {{ formatTradeValue(transaction.fxRate) }}
                </td>
                <td
                  class="number"
                  :title="costsText(transaction) ? costsTitle(transaction) : undefined"
                >
                  {{ costsText(transaction) }}
                </td>
                <td class="number">
                  <span
                    v-if="transaction.cashAmount !== null"
                    :class="cashClass(transaction.cashAmount)"
                  >
                    {{ transaction.cashCurrency }}
                    {{ formatAmount(transaction.cashAmount, { showPlus: true }) }}
                  </span>

                  <span
                    v-if="transaction.counterAmount !== null"
                    class="secondary gain"
                  >
                    {{ transaction.counterCurrency }}
                    {{ formatAmount(transaction.counterAmount, { showPlus: true }) }}
                  </span>
                </td>
                <td class="number">
                  <span
                    v-for="line in balancesOf(transaction)"
                    :key="line.currency"
                    class="balance-line"
                    :class="{ loss: line.amount < 0 }"
                  >
                    {{ line.currency }} {{ formatAmount(line.amount) }}
                  </span>
                </td>
                <td
                  class="actions"
                  @click.stop
                >
                  <button
                    v-if="transaction.comment"
                    type="button"
                    class="comment-button"
                    :title="transaction.comment"
                    aria-label="Show the comment"
                    @click="toggleComment(transaction.txId)"
                  >
                    ⓘ
                  </button>

                  <StatusPill
                    v-if="isPending(transaction.txId)"
                    tone="warning"
                  >
                    Pending
                  </StatusPill>
                </td>
              </tr>

              <tr
                v-if="expandedComment === transaction.txId"
                class="comment-row"
              >
                <td colspan="11">{{ transaction.comment }}</td>
              </tr>
            </tbody>
          </template>
        </template>
      </table>
    </div>
  </section>

  <TransactionSheet
    v-if="editing !== undefined"
    :key="sheetKey"
    :transaction="editing"
    :template="template"
    :securities="securities"
    :parties="custodians"
    :used-party-ids="usedPartyIds"
    :currencies="currencies"
    :history="transactions"
    :positions="positions"
    @close="closeSheet"
    @duplicate="duplicate"
  />
</template>

<style scoped>
.panel {
  min-width: 0;
  padding: 12px 14px;

  border: 1px solid var(--border);
  border-radius: 12px;

  background: var(--surface);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;

  margin-bottom: 8px;
}

.panel-header h2 {
  margin: 0;

  font-size: 1rem;
}

.header-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.message {
  margin: 0 0 8px;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

.message.error {
  color: var(--negative);
}

.table-scroll {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;

  font-size: var(--font-size-sm);
}

th,
td {
  padding: 6px 8px;

  border-bottom: 1px solid var(--border);

  text-align: left;
  vertical-align: top;
  white-space: nowrap;
}

th {
  color: var(--text-soft);
  font-weight: 600;
}

.group-header {
  cursor: pointer;
}

.group-header td {
  padding: 6px 8px;

  color: var(--text-soft);
  font-size: 0.8rem;
  font-style: italic;
  font-weight: 600;
}

.group-header:hover {
  background: var(--primary-soft);
}

.group-toggle {
  margin-right: 6px;
  font-style: normal;
}

.group-count {
  color: var(--text-muted);
  font-weight: 400;
}

.group-header td.group-amounts {
  font-style: normal;
  vertical-align: top;
}

.transaction-row {
  cursor: pointer;
}

.transaction-row:hover {
  background: var(--primary-soft);
}

.number {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.name {
  font-weight: 600;
}

.secondary {
  display: block;

  font-size: var(--font-size-xs);
}

.balance-line {
  display: block;
}

.actions {
  text-align: right;
}

.comment-button {
  margin-right: 6px;
  padding: 2px 4px;

  border: none;
  background: transparent;
  color: var(--text-soft);

  cursor: pointer;
}

.comment-row td {
  color: var(--text-soft);
  font-size: var(--font-size-xs);
  white-space: normal;
}

.gain {
  color: var(--positive);
}

.loss {
  color: var(--negative);
}
</style>
