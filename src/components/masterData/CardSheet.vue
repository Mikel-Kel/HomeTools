<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from "vue";

import EditSheet from "@/components/masterData/EditSheet.vue";

import { useEventRequest } from "@/composables/useEventRequest";

import {
  cardEventSuffix,
  MOBILE_EXPENSE_EVENT_TRIGRAM,
  MOBILE_EXPENSE_EVENT_VERSION,
  MOBILE_LABEL_MAX,
  type BankingAccount,
  type BankingCard,
  type BankingCardSave,
} from "@/contracts/bankingCards";

import { deviceName } from "@/services/environment/environmentState";

import { waitingElsewhereMessage } from "@/services/events/requestMessages";

/* =========================
   Fiche carte bancaire (Master data › Cards)

   Compte, devise et libellé mobile d'une carte existante,
   par MOBILE_CARD_SAVED (../Backend/docs/mobile-expense-contract.md,
   § 3.4). Porteur et numéro servent à l'import : non
   modifiables. Le Mac reste juge : son refus est affiché tel
   quel.

   - Compte : seuls les comptes actifs se choisissent ; celui
     d'une ancienne carte reste affiché.
   - Devise : vide = devise du compte.
   - Libellé mobile : 30 caractères au plus, unique sans tenir
     compte de la casse ; renseigné, il propose la carte sur
     l'iPhone et exige un compte ; vide, il la retire.
   - Propriétaire : « None » ou l'un des owners publiés ; la
     carte n'est proposée qu'aux iPhone de ce propriétaire.
     Un propriétaire absent d'owners reste affiché et choisi
     tant qu'on ne le change pas (le Mac l'accepte inchangé).
========================= */

const props = defineProps<{
  card: BankingCard;

  /* Toutes les cartes, pour le contrôle des doublons. */
  cards: BankingCard[];

  accounts: BankingAccount[];

  /* Propriétaires des appareils de l'environnement. */
  owners: string[];

  /* Devises acceptées par le Mac. */
  currencies: string[];
}>();

const emit = defineEmits<{
  close: [];
}>();

const NO_ANSWER_DELAY_MS =
  2 * 60 * 1000;

const original = {
  accountId: props.card.accountId,
  currency: props.card.currency,
  mobileLabel: props.card.mobileLabel ?? "",
  mobileOwner: props.card.mobileOwner,
};

const accountId =
  ref<number | null>(original.accountId);

const currency =
  ref<string | null>(original.currency);

const mobileLabel =
  ref(original.mobileLabel);

const mobileOwner =
  ref<string | null>(original.mobileOwner);

/* Propriétaire actuel absent d'owners : gardé dans la liste, marqué. */
const unknownOwner =
  original.mobileOwner && !props.owners.includes(original.mobileOwner)
    ? original.mobileOwner
    : null;

const trimmedLabel =
  computed(() =>
    mobileLabel.value.trim().replace(/\s+/g, " ")
  );

/* Comptes actifs, plus le compte actuel s'il ne l'est plus. */
const accountOptions =
  computed(() =>
    props.accounts.filter(
      account =>
        account.active ||
        account.accountId === original.accountId
    )
  );

const selectedAccount =
  computed(() =>
    props.accounts.find(account => account.accountId === accountId.value) ?? null
  );

/* Devises proposées, plus la devise actuelle si le Mac ne la publie plus. */
const currencyOptions =
  computed(() =>
    original.currency && !props.currencies.includes(original.currency)
      ? [...props.currencies, original.currency]
      : props.currencies
  );

const changed =
  computed(() =>
    accountId.value !== original.accountId ||
    currency.value !== original.currency ||
    trimmedLabel.value !== original.mobileLabel ||
    mobileOwner.value !== original.mobileOwner
  );

const formError =
  computed(() => {
    if (
      selectedAccount.value &&
      !selectedAccount.value.active &&
      accountId.value !== original.accountId
    ) {
      return "Only an active account can be chosen.";
    }

    if (!trimmedLabel.value) {
      return "";
    }

    if (trimmedLabel.value.length > MOBILE_LABEL_MAX) {
      return `At most ${MOBILE_LABEL_MAX} characters.`;
    }

    const key =
      trimmedLabel.value.toLowerCase();

    if (
      props.cards.some(
        other =>
          other.cardId !== props.card.cardId &&
          other.mobileLabel?.toLowerCase() === key
      )
    ) {
      return "Already used by another card.";
    }

    if (accountId.value === null) {
      return "An iPhone label requires an account.";
    }

    return "";
  });

const payload =
  computed<BankingCardSave>(() => ({
    cardId: props.card.cardId,
    accountId: accountId.value,
    currency: currency.value,
    mobileLabel: trimmedLabel.value || null,
    mobileOwner: mobileOwner.value,
  }));

const saveRequest =
  useEventRequest({
    trigram: MOBILE_EXPENSE_EVENT_TRIGRAM,
    noAnswerDelayMs: NO_ANSWER_DELAY_MS,
  });

const fileSuffix =
  cardEventSuffix(props.card.cardId);

const waitingElsewhere =
  computed(() =>
    saveRequest.request.value === null &&
    saveRequest.waitingFiles.value.some(
      name => name.endsWith(`_${fileSuffix}.json`)
    )
  );

const canSave =
  computed(() =>
    changed.value &&
    !formError.value &&
    !saveRequest.inProgress.value &&
    !waitingElsewhere.value
  );

async function save() {
  if (!canSave.value) {
    return;
  }

  await saveRequest.send(
    {
      eventType: "MOBILE_CARD_SAVED",
      version: MOBILE_EXPENSE_EVENT_VERSION,
      timestamp: new Date().toISOString(),
      payload: {
        ...payload.value,
        source: deviceName(),
      },
    },
    fileSuffix
  );
}

watch(
  () => saveRequest.request.value?.phase,

  phase => {
    if (phase === "completed") {
      emit("close");
    }
  }
);

const hint =
  computed(() =>
    waitingElsewhere.value
      ? waitingElsewhereMessage("A change of this card")
      : changed.value
        ? formError.value
        : ""
  );

const title =
  `${props.card.holder || "Card"} · ${props.card.internalId}`;

const subtitle =
  `Card ${props.card.cardId} · holder and number come from the bank imports`;
</script>

<template>
  <EditSheet
    :title="title"
    :subtitle="subtitle"
    :request="saveRequest"
    :changed="changed"
    :can-save="canSave"
    save-label="Save"
    :hint="hint"
    :hint-is-error="!!hint && !waitingElsewhere"
    @save="save"
    @close="emit('close')"
  >
    <label class="field">
      <h3>Account</h3>

      <select
        v-model="accountId"
        :disabled="saveRequest.inProgress.value"
      >
        <option :value="null">None</option>

        <option
          v-for="account in accountOptions"
          :key="account.accountId"
          :value="account.accountId"
          :disabled="!account.active"
        >
          {{ account.label }} · {{ account.kind }} · {{ account.currency }}{{ account.active ? "" : " (inactive)" }}
        </option>
      </select>
    </label>

    <label class="field">
      <h3>Currency</h3>

      <select
        v-model="currency"
        :disabled="saveRequest.inProgress.value"
      >
        <option :value="null">
          Account currency{{ selectedAccount ? ` (${selectedAccount.currency})` : "" }}
        </option>

        <option
          v-for="code in currencyOptions"
          :key="code"
          :value="code"
        >
          {{ code }}
        </option>
      </select>
    </label>

    <div class="columns">
      <label class="field">
        <h3>iPhone label</h3>

        <input
          v-model="mobileLabel"
          type="text"
          :maxlength="MOBILE_LABEL_MAX + 10"
          placeholder="Not offered on iPhone"
          :disabled="saveRequest.inProgress.value"
          @keydown.enter="save"
        />
      </label>

      <label class="field">
        <h3>Owner</h3>

        <select
          v-model="mobileOwner"
          :disabled="saveRequest.inProgress.value"
        >
          <option :value="null">None</option>

          <option
            v-if="unknownOwner"
            :value="unknownOwner"
          >
            {{ unknownOwner }} (not a device owner)
          </option>

          <option
            v-for="owner in owners"
            :key="owner"
            :value="owner"
          >
            {{ owner }}
          </option>
        </select>
      </label>
    </div>

    <p class="note">
      A label offers the card on the iPhone; an empty label removes it (entries already made are kept).
      The card is offered only on the iPhones of its owner.
    </p>
  </EditSheet>
</template>

<style scoped>
.columns {
  display: grid;
  grid-template-columns: 3fr 2fr;
  gap: 0.75rem;
}

.columns input,
.columns select {
  width: 100%;
  min-width: 0;
}
</style>
