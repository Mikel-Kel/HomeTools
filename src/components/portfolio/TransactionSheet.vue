<script setup lang="ts">
import {
  computed,
  reactive,
  ref,
  watch,
} from "vue";

import DateChip from "@/components/DateChip.vue";
import EditSheet from "@/components/masterData/EditSheet.vue";
import PillButton from "@/components/ui/PillButton.vue";
import SuggestInput from "@/components/ui/SuggestInput.vue";

import { useEventRequest } from "@/composables/useEventRequest";
import { usePersistentRef } from "@/composables/usePersistentRef";

import type { Party } from "@/contracts/parties";

import {
  PORTFOLIO_EVENT_TRIGRAM,
  PORTFOLIO_EVENT_VERSION,
  TRANSACTION_TYPES,
  transactionEventSuffix,
  transactionTypeLabel,
  type PortfolioSecurity,
  type PortfolioTransaction,
  type PortfolioTransactionType,
} from "@/contracts/portfolio";

import {
  CREATED_ON_SERVER,
  waitingElsewhereMessage,
} from "@/services/events/requestMessages";

import {
  checkTransactionForm,
  COMMENT_MAX_LENGTH,
  emptyTransactionForm,
  fxCurrencyOf,
  netAmountOf,
  parseDecimal,
  TRANSACTION_FORM_RULES,
  transactionToForm,
} from "@/services/portfolio/transactionForm";

import { formatAmount } from "@/utils/amountFormat";

/* =========================
   Fiche d'une transaction du portefeuille

   Création (transaction null) ou modification, par
   TRANSACTION_SAVED (../Backend/docs/portfolio-contract.md,
   § 3 et § 7). Les champs suivent le type
   (transactionForm.ts) ; le refus du Mac est affiché tel
   quel et la saisie reste ouverte pour la corriger.

   - Montant réglé : le net de l'avis est proposé tant que le
     règlement est dans la devise du titre et que le montant
     n'a pas été saisi à la main (« Use net » le reprend).
   - Nouvelle saisie : type, dépositaire et titre de la
     précédente sont repris, pour enchaîner un historique.
========================= */

const props = defineProps<{
  transaction: PortfolioTransaction | null;
  securities: PortfolioSecurity[];
  parties: Party[];

  /* Dépositaires déjà présents dans le journal : proposés en tête. */
  usedPartyIds: number[];
  currencies: string[];
}>();

const emit = defineEmits<{
  close: [];
}>();

const NO_ANSWER_DELAY_MS =
  2 * 60 * 1000;

const isNew =
  props.transaction === null;

interface LastEntry {
  type: PortfolioTransactionType;
  partyId: number | null;
  securityId: number | null;
}

const lastEntry =
  usePersistentRef<LastEntry | null>("portfolio.lastEntry", null);

function today(): string {
  const now =
    new Date();

  const month =
    String(now.getMonth() + 1).padStart(2, "0");

  const day =
    String(now.getDate()).padStart(2, "0");

  return `${now.getFullYear()}-${month}-${day}`;
}

function initialForm() {
  if (props.transaction) {
    return transactionToForm(props.transaction);
  }

  const form =
    emptyTransactionForm(today());

  const last =
    lastEntry.value;

  if (last && TRANSACTION_FORM_RULES[last.type]) {
    form.type = last.type;
    form.partyId =
      props.parties.some(party => party.id === last.partyId)
        ? last.partyId
        : null;
    form.securityId =
      props.securities.some(security => security.securityId === last.securityId)
        ? last.securityId
        : null;
  }

  const currency =
    props.securities.find(security => security.securityId === form.securityId)?.currency;

  if (currency) {
    form.cashCurrency = currency;
  }

  return form;
}

const form =
  reactive(initialForm());

const originalForm =
  JSON.stringify(form);

const rule =
  computed(() =>
    TRANSACTION_FORM_RULES[form.type]
  );

const typeOptions =
  computed(() =>
    TRANSACTION_TYPES.filter(
      type => type.value !== "OPENING" || form.type === "OPENING"
    )
  );

/* =========================
   Dépositaires
========================= */

function partyName(
  id: number | null
): string {
  return id === null
    ? ""
    : props.parties.find(party => party.id === id)?.label ?? "";
}

function partyIdOf(
  text: string
): number | null {
  const key =
    text.trim().toLowerCase();

  return (
    props.parties.find(party => party.label.toLowerCase() === key)?.id ??
    null
  );
}

const partyText =
  ref(partyName(form.partyId));

const toPartyText =
  ref(partyName(form.toPartyId));

watch(partyText, text => {
  form.partyId = partyIdOf(text);
});

watch(toPartyText, text => {
  form.toPartyId = partyIdOf(text);
});

const partySuggestions =
  computed(() => {
    const used =
      new Set(props.usedPartyIds);

    return [...props.parties]
      .sort((a, b) =>
        Number(used.has(b.id)) - Number(used.has(a.id)) ||
        a.label.localeCompare(b.label)
      )
      .map(party => party.label);
  });

/* =========================
   Titre et devises
========================= */

const security =
  computed(() =>
    props.securities.find(item => item.securityId === form.securityId)
  );

const securityOptions =
  computed(() =>
    props.securities
      .filter(item => item.active || item.securityId === form.securityId)
      .sort((a, b) => a.label.localeCompare(b.label))
  );

const currencyOptions =
  computed(() =>
    [
      ...new Set([
        ...props.currencies,
        form.cashCurrency,
        form.counterCurrency,
      ]),
    ]
  );

const fxCurrency =
  computed(() =>
    fxCurrencyOf(form, security.value)
  );

const showFx =
  computed(() =>
    !!fxCurrency.value && fxCurrency.value !== "CHF"
  );

const hasNet =
  computed(() =>
    form.type === "BUY" || form.type === "SELL" || form.type === "DIVIDEND"
  );

/* Devise de règlement suit le titre tant qu'elle n'a pas été choisie. */
const cashCurrencyChosen =
  ref(
    !isNew &&
    props.transaction!.cashCurrency !== null &&
    props.transaction!.cashCurrency !== security.value?.currency
  );

watch(
  () => security.value?.currency,
  currency => {
    if (currency && !cashCurrencyChosen.value) {
      form.cashCurrency = currency;
    }
  }
);

/* =========================
   Net proposé
========================= */

const net =
  computed(() =>
    hasNet.value && form.cashCurrency === security.value?.currency
      ? netAmountOf(form, security.value)
      : null
  );

/* Le montant suit le net tant qu'il n'a pas été saisi à la main. */
const cashFollowsNet =
  ref(
    isNew ||
    (net.value !== null && parseDecimal(form.cashAmount, 2) === net.value)
  );

watch(
  net,
  value => {
    if (cashFollowsNet.value) {
      form.cashAmount = value === null ? "" : value.toFixed(2);
    }
  }
);

function onCashInput() {
  cashFollowsNet.value = false;
}

function onCashCurrencyChange() {
  cashCurrencyChosen.value = true;

  if (hasNet.value && form.cashCurrency === security.value?.currency) {
    cashFollowsNet.value = true;

    if (net.value !== null) {
      form.cashAmount = net.value.toFixed(2);
    }
  } else if (cashFollowsNet.value) {
    cashFollowsNet.value = false;
    form.cashAmount = "";
  }
}

function useNet() {
  if (net.value !== null) {
    cashFollowsNet.value = true;
    form.cashAmount = net.value.toFixed(2);
  }
}

const showUseNet =
  computed(() =>
    net.value !== null &&
    parseDecimal(form.cashAmount, 2) !== net.value
  );

/* =========================
   Libellés
========================= */

const priceLabel =
  computed(() =>
    `${form.type === "OPENING" ? "Cost price" : "Price"} (${security.value?.currency ?? "—"})`
  );

const cashLabel =
  computed(() => {
    switch (form.type) {
      case "BUY":
        return "Amount debited";

      case "SELL":
      case "DIVIDEND":
        return "Net credited";

      case "FX_EXCHANGE":
        return "Amount sold";

      case "INTEREST":
        return "Amount (negative rate: −)";

      default:
        return "Amount";
    }
  });

/* =========================
   Envoi
========================= */

const check =
  computed(() =>
    checkTransactionForm(form, props.securities)
  );

const changed =
  computed(() =>
    JSON.stringify(form) !== originalForm
  );

const saveRequest =
  useEventRequest({
    trigram: PORTFOLIO_EVENT_TRIGRAM,
    noAnswerDelayMs: NO_ANSWER_DELAY_MS,
  });

const fileSuffix =
  transactionEventSuffix(form.txId);

const waitingElsewhere =
  computed(() =>
    !isNew &&
    saveRequest.request.value === null &&
    saveRequest.waitingFiles.value.some(
      name =>
        name.endsWith(`_${fileSuffix}.json`) ||
        name.endsWith(`_${fileSuffix}_DEL.json`)
    )
  );

const canSave =
  computed(() =>
    (isNew || changed.value) &&
    !check.value.error &&
    !saveRequest.inProgress.value &&
    !waitingElsewhere.value
  );

async function save() {
  const payload =
    check.value.payload;

  if (!canSave.value || !payload) {
    return;
  }

  await saveRequest.send(
    {
      version: PORTFOLIO_EVENT_VERSION,
      eventType: "TRANSACTION_SAVED",
      timestamp: new Date().toISOString(),
      payload,
    },
    fileSuffix
  );
}

watch(
  () => saveRequest.request.value?.phase,

  phase => {
    if (phase === "completed") {
      if (isNew) {
        lastEntry.value = {
          type: form.type,
          partyId: form.partyId,
          securityId: form.securityId,
        };
      }

      emit("close");
    }
  }
);

const hint =
  computed(() =>
    waitingElsewhere.value
      ? waitingElsewhereMessage("A change of this transaction")
      : changed.value
        ? check.value.error
        : ""
  );

const subtitle =
  isNew
    ? CREATED_ON_SERVER
    : `Transaction ${form.txId}`;

const isBusy =
  computed(() =>
    saveRequest.inProgress.value
  );
</script>

<template>
  <EditSheet
    :title="isNew ? 'New transaction' : transactionTypeLabel(form.type)"
    :subtitle="subtitle"
    :request="saveRequest"
    :changed="changed"
    :can-save="canSave"
    :save-label="isNew ? 'Create' : 'Save'"
    :hint="hint"
    :hint-is-error="!!hint && !waitingElsewhere"
    @save="save"
    @close="emit('close')"
  >
    <div class="grid">
      <label class="field">
        <h3>Type</h3>

        <select
          v-model="form.type"
          :disabled="isBusy"
        >
          <option
            v-for="type in typeOptions"
            :key="type.value"
            :value="type.value"
          >
            {{ type.label }}
          </option>
        </select>
      </label>

      <div class="field">
        <h3>Date</h3>

        <DateChip v-model="form.date" />
      </div>

      <div
        v-if="rule.party"
        class="field"
      >
        <h3>{{ rule.toParty ? "From custodian" : "Custodian" }}</h3>

        <SuggestInput
          v-model="partyText"
          :suggestions="partySuggestions"
          placeholder="Party"
        />
      </div>

      <div
        v-if="rule.toParty"
        class="field"
      >
        <h3>To custodian</h3>

        <SuggestInput
          v-model="toPartyText"
          :suggestions="partySuggestions"
          placeholder="Party"
        />
      </div>

      <label
        v-if="rule.security"
        class="field"
      >
        <h3>Security{{ rule.security === "optional" ? " (optional)" : "" }}</h3>

        <select
          v-model="form.securityId"
          :disabled="isBusy"
        >
          <option :value="null">—</option>

          <option
            v-for="item in securityOptions"
            :key="item.securityId"
            :value="item.securityId"
          >
            {{ item.label }} ({{ item.currency }})
          </option>
        </select>
      </label>

      <label
        v-if="rule.quantity"
        class="field"
      >
        <h3>Quantity</h3>

        <input
          v-model="form.quantity"
          type="text"
          inputmode="decimal"
          :disabled="isBusy"
        />
      </label>

      <label
        v-if="rule.price"
        class="field"
      >
        <h3>{{ priceLabel }}</h3>

        <input
          v-model="form.price"
          type="text"
          inputmode="decimal"
          :disabled="isBusy"
        />
      </label>

      <label
        v-if="rule.gross"
        class="field"
      >
        <h3>Gross amount ({{ security?.currency ?? "—" }})</h3>

        <input
          v-model="form.grossAmount"
          type="text"
          inputmode="decimal"
          :disabled="isBusy"
        />
      </label>

      <label
        v-if="rule.fees"
        class="field"
      >
        <h3>Fees ({{ security?.currency ?? "—" }})</h3>

        <input
          v-model="form.fees"
          type="text"
          inputmode="decimal"
          :disabled="isBusy"
        />
      </label>

      <label
        v-if="rule.taxes"
        class="field"
      >
        <h3>Taxes ({{ form.type === "INTEREST" ? form.cashCurrency : security?.currency ?? "—" }})</h3>

        <input
          v-model="form.taxes"
          type="text"
          inputmode="decimal"
          :disabled="isBusy"
        />
      </label>

      <label
        v-if="showFx"
        class="field"
      >
        <h3>{{ fxCurrency }}/CHF rate (trade advice)</h3>

        <input
          v-model="form.fxRate"
          type="text"
          inputmode="decimal"
          placeholder="CHF for 1 unit"
          :disabled="isBusy"
        />
      </label>

      <template v-if="rule.split">
        <label class="field">
          <h3>Old shares</h3>

          <input
            v-model="form.splitFrom"
            type="text"
            inputmode="numeric"
            :disabled="isBusy"
          />
        </label>

        <label class="field">
          <h3>New shares</h3>

          <input
            v-model="form.splitTo"
            type="text"
            inputmode="numeric"
            :disabled="isBusy"
          />
        </label>
      </template>

      <template v-if="rule.cash">
        <label class="field">
          <h3>{{ rule.counter ? "Currency sold" : "Cash currency" }}</h3>

          <select
            v-model="form.cashCurrency"
            :disabled="isBusy"
            @change="onCashCurrencyChange"
          >
            <option
              v-for="code in currencyOptions"
              :key="code"
              :value="code"
            >
              {{ code }}
            </option>
          </select>
        </label>

        <div class="field">
          <h3>{{ cashLabel }}</h3>

          <input
            v-model="form.cashAmount"
            type="text"
            inputmode="decimal"
            :disabled="isBusy"
            @input="onCashInput"
          />

          <PillButton
            v-if="showUseNet"
            class="use-net"
            @click="useNet"
          >
            Use net {{ formatAmount(net) }}
          </PillButton>
        </div>
      </template>

      <template v-if="rule.counter">
        <label class="field">
          <h3>Currency received</h3>

          <select
            v-model="form.counterCurrency"
            :disabled="isBusy"
          >
            <option
              v-for="code in currencyOptions"
              :key="code"
              :value="code"
            >
              {{ code }}
            </option>
          </select>
        </label>

        <label class="field">
          <h3>Amount received</h3>

          <input
            v-model="form.counterAmount"
            type="text"
            inputmode="decimal"
            :disabled="isBusy"
          />
        </label>
      </template>
    </div>

    <p
      v-if="form.type === 'SPLIT' && security?.seriesSplitAdjusted"
      class="note"
    >
      A new split also requires reloading this security's price history on the Mac.
    </p>

    <label class="field">
      <h3>Comment (optional)</h3>

      <input
        v-model="form.comment"
        type="text"
        :maxlength="COMMENT_MAX_LENGTH"
        :disabled="isBusy"
      />
    </label>
  </EditSheet>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem 1rem;
}

.grid input,
.grid select {
  width: 100%;
  min-width: 0;
}

.use-net {
  align-self: flex-start;
}
</style>
