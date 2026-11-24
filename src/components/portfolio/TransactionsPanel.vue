<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from "vue";

import TransactionSheet from "@/components/portfolio/TransactionSheet.vue";
import PillButton from "@/components/ui/PillButton.vue";
import StatusPill from "@/components/ui/StatusPill.vue";

import { useEventRequest } from "@/composables/useEventRequest";
import { useParties } from "@/composables/useParties";
import { usePersistentRef } from "@/composables/usePersistentRef";
import { useRemoteJson } from "@/composables/useRemoteJson";
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
  TRANSACTION_TYPES,
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
   (§ 4.1), filtré par titre et par type. Création,
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

/* Filtre sans sélection. */
const ALL = "";

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

const securityFilter =
  usePersistentRef<string>("portfolio.journal.security", ALL);

const typeFilter =
  usePersistentRef<string>("portfolio.journal.type", ALL);

const securityOptions =
  computed(() =>
    [...props.securities]
      .sort((a, b) => a.label.localeCompare(b.label))
  );

/* Titre retrouvé de la session mais disparu : aucun filtre. */
watch(
  () => props.securities,
  securities => {
    if (
      securityFilter.value !== ALL &&
      !securities.some(
        security => String(security.securityId) === securityFilter.value
      )
    ) {
      securityFilter.value = ALL;
    }
  },
  { immediate: true }
);

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
    [...replayed.value].reverse().filter(transaction =>
      (
        securityFilter.value === ALL ||
        String(transaction.securityId) === securityFilter.value
      ) &&
      (
        typeFilter.value === ALL ||
        transaction.type === typeFilter.value
      )
    )
  );

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

const hasFilters =
  computed(() =>
    securityFilter.value !== ALL ||
    typeFilter.value !== ALL
  );

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

      <div class="filters">
        <select
          v-model="securityFilter"
          aria-label="Security"
        >
          <option :value="ALL">All securities</option>

          <option
            v-for="security in securityOptions"
            :key="security.securityId"
            :value="String(security.securityId)"
          >
            {{ security.label }}
          </option>
        </select>

        <select
          v-model="typeFilter"
          aria-label="Type"
        >
          <option :value="ALL">All types</option>

          <option
            v-for="type in TRANSACTION_TYPES"
            :key="type.value"
            :value="type.value"
          >
            {{ type.label }}
          </option>
        </select>

        <PillButton
          v-if="hasFilters"
          @click="securityFilter = ALL; typeFilter = ALL"
        >
          Reset
        </PillButton>

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

        <tbody
          v-for="transaction in visibleTransactions"
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

.filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.filters select {
  padding: 5px 8px;

  border: 1px solid var(--input-border);
  border-radius: 8px;

  font-size: var(--font-size-sm);
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
