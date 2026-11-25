<script setup lang="ts">
import {
  computed,
  ref,
} from "vue";

import CardSheet from "@/components/masterData/CardSheet.vue";
import PillButton from "@/components/ui/PillButton.vue";
import StatusPill from "@/components/ui/StatusPill.vue";

import { useEventRequest } from "@/composables/useEventRequest";
import { usePersistentRef } from "@/composables/usePersistentRef";

import {
  cardEventSuffix,
  MOBILE_EXPENSE_EVENT_TRIGRAM,
  type BankingCard,
  type BankingCards,
} from "@/contracts/bankingCards";

import { eventFilePattern } from "@/services/events/eventFiles";

import { formatDate } from "@/utils/dateFormat";

/* =========================
   Section « Cards » de la page Master data

   Cartes bancaires (capacité mobileExpense) : compte, devise,
   libellé mobile, qui propose la carte sur l'iPhone, et
   propriétaire, dont seuls les iPhone la proposent ;
   saisie par CardSheet. Ordre publié par le Mac (dernier
   mouvement le plus récent d'abord) ; les cartes sans
   mouvement depuis 12 mois sont repliées sous « Older
   cards ».

   « Pending » est déduit des événements qui attendent dans
   events/, quel que soit l'appareil.
========================= */

const NO_ANSWER_DELAY_MS =
  2 * 60 * 1000;

const props = defineProps<{
  data: BankingCards;

  /* Devises acceptées par le Mac. */
  currencies: string[];
}>();

const showOlder =
  usePersistentRef("masterData.cards.showOlder", false);

const accountsById =
  computed(() =>
    new Map(
      props.data.accounts.map(account => [account.accountId, account])
    )
  );

const recentCards =
  computed(() =>
    props.data.cards.filter(card => card.movements12m > 0)
  );

const olderCards =
  computed(() =>
    props.data.cards.filter(card => card.movements12m === 0)
  );

const visibleCards =
  computed(() =>
    showOlder.value
      ? [...recentCards.value, ...olderCards.value]
      : recentCards.value
  );

const offeredCount =
  computed(() =>
    props.data.cards.filter(card => card.mobileLabel).length
  );

function accountLabel(
  card: BankingCard
): string {
  return card.accountId === null
    ? ""
    : accountsById.value.get(card.accountId)?.label ?? `Account ${card.accountId}`;
}

/* Devise de la carte, sinon celle du compte (par défaut). */
function currencyOf(
  card: BankingCard
): { code: string; byDefault: boolean } {
  return card.currency
    ? { code: card.currency, byDefault: false }
    : {
        code:
          card.accountId === null
            ? ""
            : accountsById.value.get(card.accountId)?.currency ?? "",
        byDefault: true,
      };
}

const events =
  useEventRequest({
    trigram: MOBILE_EXPENSE_EVENT_TRIGRAM,
    noAnswerDelayMs: NO_ANSWER_DELAY_MS,
  });

const eventPattern =
  eventFilePattern(MOBILE_EXPENSE_EVENT_TRIGRAM);

const waitingSuffixes =
  computed(() =>
    events.waitingFiles.value
      .map(name => eventPattern.exec(name)?.[1])
      .filter((suffix): suffix is string => !!suffix)
  );

function isPending(
  card: BankingCard
): boolean {
  return waitingSuffixes.value.includes(cardEventSuffix(card.cardId));
}

/* null : fiche fermée. */
const editing =
  ref<BankingCard | null>(null);

async function closeSheet() {
  editing.value = null;
  await events.check().catch(
    err =>
      console.warn(
        "Unable to read events",
        err
      )
  );
}
</script>

<template>
  <section class="panel">
    <div class="panel-header">
      <h2>Cards</h2>

      <div class="panel-actions">
        <span class="summary">
          {{ offeredCount }} offered on iPhone
        </span>

        <PillButton
          v-if="olderCards.length"
          :active="showOlder"
          @click="showOlder = !showOlder"
        >
          Older cards ({{ olderCards.length }})
        </PillButton>
      </div>
    </div>

    <p
      v-if="!visibleCards.length"
      class="empty"
    >
      No card with movements in the last 12 months.
    </p>

    <div
      v-else
      class="table-scroll"
    >
      <table>
        <thead>
          <tr>
            <th>Holder</th>
            <th>Card</th>
            <th>Account</th>
            <th>Currency</th>
            <th>iPhone label</th>
            <th>Owner</th>
            <th class="number">Movements (12 m)</th>
            <th>Last movement</th>
            <th />
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="card in visibleCards"
            :key="card.cardId"
            :class="{ older: card.movements12m === 0 }"
            @click="editing = card"
          >
            <td class="name">{{ card.holder }}</td>
            <td>{{ card.internalId }}</td>
            <td :class="{ missing: card.mobileLabel && card.accountId === null }">
              {{ accountLabel(card) || "None" }}
            </td>
            <td>
              {{ currencyOf(card).code }}
              <span
                v-if="currencyOf(card).byDefault && currencyOf(card).code"
                class="soft"
              >
                (default)
              </span>
            </td>
            <td>{{ card.mobileLabel ?? "" }}</td>
            <td :class="{ missing: card.mobileOwner && !data.owners.includes(card.mobileOwner) }">
              {{ card.mobileOwner ?? "" }}
            </td>
            <td class="number">{{ card.movements12m }}</td>
            <td>{{ formatDate(card.lastMovement) }}</td>
            <td class="status">
              <StatusPill
                v-if="isPending(card)"
                tone="warning"
              >
                Pending
              </StatusPill>

              <StatusPill
                v-else-if="card.mobileLabel"
                tone="primary"
              >
                iPhone
              </StatusPill>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <CardSheet
    v-if="editing"
    :card="editing"
    :cards="data.cards"
    :accounts="data.accounts"
    :owners="data.owners"
    :currencies="currencies"
    @close="closeSheet"
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

  font-size: var(--font-size-lg);
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.summary,
.soft {
  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

.empty {
  margin: 0;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
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
  white-space: nowrap;
}

th {
  color: var(--text-soft);
  font-weight: 600;
}

th.number,
td.number {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

tbody tr {
  cursor: pointer;
}

tbody tr:hover {
  background: var(--primary-soft);
}

tr.older td {
  color: var(--text-muted);
}

.name {
  font-weight: 600;
}

td.missing {
  color: var(--warning);
}

.status {
  text-align: right;
}
</style>
