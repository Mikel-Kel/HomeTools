<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from "vue";

import EditSheet from "@/components/masterData/EditSheet.vue";
import PillButton from "@/components/ui/PillButton.vue";

import { useEventRequest } from "@/composables/useEventRequest";

import {
  cardEventSuffix,
  MOBILE_EXPENSE_EVENT_TRIGRAM,
  MOBILE_EXPENSE_EVENT_VERSION,
  MOBILE_LABEL_MAX,
  normalizeColor,
  type BankingAccount,
  type BankingCard,
  type BankingCardSave,
} from "@/contracts/bankingCards";

import { deviceName } from "@/services/environment/environmentState";

import { waitingElsewhereMessage } from "@/services/events/requestMessages";

/* =========================
   Fiche carte bancaire (Master data › Cards)

   Compte, devise, libellé mobile, propriétaire et couleur
   d'une carte existante, par MOBILE_CARD_SAVED (../Backend/docs/mobile-expense-contract.md,
   § 3.4). Porteur et numéro servent à l'import : non
   modifiables. Le Mac reste juge : son refus est affiché tel
   quel.

   - Compte : seuls les comptes actifs se choisissent ; celui
     d'une ancienne carte reste affiché.
   - Devise : vide = devise du compte.
   - Libellé mobile : 30 caractères au plus, unique parmi les
     cartes du propriétaire choisi (les cartes sans
     propriétaire entre elles), sans tenir compte de la casse ;
     renseigné, il propose la carte sur l'iPhone et exige un
     compte ; vide, il la retire.
   - Propriétaire : « None » ou l'un des owners publiés ; la
     carte n'est proposée qu'aux iPhone de ce propriétaire.
     Un propriétaire retiré d'owners reste affiché et choisi
     tant qu'on ne le change pas (le Mac l'accepte inchangé) ;
     il n'est jamais proposé pour une autre carte.
   - Couleur : #RRGGBB ou « None » (null).
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

/* Valeur du sélecteur tant qu'aucune couleur n'est choisie. */
const PICKER_DEFAULT =
  "#808080";

const original = {
  accountId: props.card.accountId,
  currency: props.card.currency,
  mobileLabel: props.card.mobileLabel ?? "",
  mobileOwner: props.card.mobileOwner,
  mobileColor: props.card.mobileColor,
};

const accountId =
  ref<number | null>(original.accountId);

const currency =
  ref<string | null>(original.currency);

const mobileLabel =
  ref(original.mobileLabel);

const mobileOwner =
  ref<string | null>(original.mobileOwner);

const mobileColor =
  ref<string | null>(original.mobileColor);

/* Le sélecteur natif rend des minuscules : rangé en majuscules. */
function pickColor(
  event: Event
) {
  mobileColor.value =
    normalizeColor((event.target as HTMLInputElement).value);
}

/* Propriétaire actuel retiré d'owners : gardé dans la liste, marqué. */
const removedOwner =
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
    mobileOwner.value !== original.mobileOwner ||
    mobileColor.value !== original.mobileColor
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
          other.mobileOwner === mobileOwner.value &&
          other.mobileLabel?.toLowerCase() === key
      )
    ) {
      return mobileOwner.value
        ? `Already used by another card of ${mobileOwner.value}.`
        : "Already used by another card without owner.";
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
    mobileColor: mobileColor.value,
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

    <div class="columns">
      <label class="field">
        <h3>Owner</h3>

        <select
          v-model="mobileOwner"
          :disabled="saveRequest.inProgress.value"
        >
          <option :value="null">None</option>

          <option
            v-if="removedOwner"
            :value="removedOwner"
          >
            {{ removedOwner }} (removed)
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

      <div class="field">
        <h3>Color</h3>

        <div class="color-row">
          <input
            type="color"
            class="color-input"
            :class="{ unset: mobileColor === null }"
            :value="(mobileColor ?? PICKER_DEFAULT).toLowerCase()"
            aria-label="Card color"
            :disabled="saveRequest.inProgress.value"
            @input="pickColor"
          />

          <PillButton
            :active="mobileColor === null"
            :disabled="saveRequest.inProgress.value"
            @click="mobileColor = null"
          >
            None
          </PillButton>
        </div>
      </div>
    </div>

    <p class="note">
      A label offers the card on the iPhone; an empty label removes it (entries already made are kept).
      The card is offered only on the iPhones of its owner, in its color.
    </p>
  </EditSheet>
</template>

<style scoped>
.columns {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.75rem;
}

.columns select {
  width: 100%;
  min-width: 0;
}

.color-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.color-input {
  width: 4rem;
  height: 38px;
  padding: 2px 4px;

  cursor: pointer;
}

.color-input.unset {
  opacity: 0.35;
}
</style>
