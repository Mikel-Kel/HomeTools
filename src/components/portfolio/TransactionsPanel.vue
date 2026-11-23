<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from "vue";

import PillButton from "@/components/ui/PillButton.vue";
import StatusPill from "@/components/ui/StatusPill.vue";

import { useEventRequest } from "@/composables/useEventRequest";
import { useParties } from "@/composables/useParties";
import { usePersistentRef } from "@/composables/usePersistentRef";
import { useRemoteJson } from "@/composables/useRemoteJson";
import { useStorageAccess } from "@/composables/useStorageAccess";

import {
  PORTFOLIO_EVENT_TRIGRAM,
  PORTFOLIO_EVENT_VERSION,
  PORTFOLIO_FOLDER,
  PORTFOLIO_TRANSACTIONS_FILE,
  readPortfolioTransactions,
  TRANSACTION_TYPES,
  transactionDeleteSuffix,
  transactionEventSuffix,
  transactionTypeLabel,
  type PortfolioSecurity,
  type PortfolioTransaction,
} from "@/contracts/portfolio";

import { confirmDialog } from "@/services/dialog/appDialog";
import { eventFilePattern } from "@/services/events/eventFiles";

import {
  pendingMessage,
  processingMessage,
} from "@/services/events/requestMessages";

import {
  formatAmount,
  formatQuantity,
  formatTradeValue,
} from "@/utils/amountFormat";

/* =========================
   Journal des transactions

   transactions.json, relu dès que le Mac le republie, du
   plus récent au plus ancien, filtré par titre et par type.
   Suppression par TRANSACTION_DELETED, après confirmation :
   le Mac rejoue le journal et peut refuser (quantité devenue
   négative), son message est affiché tel quel.

   « Pending » est déduit des événements qui attendent dans
   events/, quel que soit l'appareil.
========================= */

const NO_ANSWER_DELAY_MS =
  2 * 60 * 1000;

/* Filtre sans sélection. */
const ALL = "";

const props = defineProps<{
  securities: PortfolioSecurity[];
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

const visibleTransactions =
  computed(() =>
    transactions.value.filter(transaction =>
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
   Suppression et suivi
========================= */

const deleteRequest =
  useEventRequest({
    trigram: PORTFOLIO_EVENT_TRIGRAM,
    noAnswerDelayMs: NO_ANSWER_DELAY_MS,
  });

const eventPattern =
  eventFilePattern(PORTFOLIO_EVENT_TRIGRAM);

const waitingSuffixes =
  computed(() =>
    new Set(
      deleteRequest.waitingFiles.value
        .map(name => eventPattern.exec(name)?.[1])
        .filter((suffix): suffix is string => !!suffix)
    )
  );

function isPending(
  txId: number
): boolean {
  return (
    waitingSuffixes.value.has(transactionEventSuffix(txId)) ||
    waitingSuffixes.value.has(transactionDeleteSuffix(txId))
  );
}

const requestMessage =
  computed(() => {
    const current =
      deleteRequest.request.value;

    switch (current?.phase) {
      case "requested":
        return pendingMessage("Deletion sent", deleteRequest.noAnswerYet.value);

      case "started":
        return processingMessage("Deleting");

      case "completed":
        return current.message ?? "";

      case "error":
        return `Rejected: ${current.message ?? "unknown error"}`;

      default:
        return "";
    }
  });

async function remove(
  transaction: PortfolioTransaction
) {
  if (
    deleteRequest.inProgress.value ||
    isPending(transaction.txId)
  ) {
    return;
  }

  const subject =
    securityLabel(transaction.securityId) ||
    partyLabel(transaction.partyId);

  if (
    !(await confirmDialog({
      title: `Delete this ${transactionTypeLabel(transaction.type)}?`,
      message: `${transaction.date}${subject ? ` · ${subject}` : ""}`,
      confirmLabel: "Delete",
      destructive: true,
    }))
  ) {
    return;
  }

  await deleteRequest.send(
    {
      version: PORTFOLIO_EVENT_VERSION,
      eventType: "TRANSACTION_DELETED",
      timestamp: new Date().toISOString(),
      payload: {
        txId: transaction.txId,
      },
    },
    transactionDeleteSuffix(transaction.txId)
  );

  await deleteRequest.check().catch(
    err =>
      console.warn(
        "Unable to read events",
        err
      )
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
      </div>
    </div>

    <p
      v-if="requestMessage"
      class="request-message"
      :class="deleteRequest.request.value?.phase"
    >
      {{ requestMessage }}
    </p>

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
            <th />
          </tr>
        </thead>

        <tbody
          v-for="transaction in visibleTransactions"
          :key="transaction.txId"
        >
          <tr>
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
            <td class="actions">
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

              <PillButton
                v-else
                :disabled="deleteRequest.inProgress.value"
                @click="remove(transaction)"
              >
                Delete
              </PillButton>
            </td>
          </tr>

          <tr
            v-if="expandedComment === transaction.txId"
            class="comment-row"
          >
            <td colspan="10">{{ transaction.comment }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
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

.message,
.request-message {
  margin: 0 0 8px;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

.message.error,
.request-message.error {
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
