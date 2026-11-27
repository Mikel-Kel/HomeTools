<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from "vue";

import PartySheet from "@/components/masterData/PartySheet.vue";
import PillButton from "@/components/ui/PillButton.vue";

import { useEventRequest } from "@/composables/useEventRequest";
import { useParties } from "@/composables/useParties";
import { useRemoteJson } from "@/composables/useRemoteJson";

import {
  MOBILE_EXPENSE_EVENT_TRIGRAM,
  MOBILE_EXPENSE_EVENT_VERSION,
} from "@/contracts/bankingCards";

import {
  MOBILE_FILE,
  MOBILE_FOLDER,
  readMobileEntries,
  unlinkEventSuffix,
} from "@/contracts/mobileExpense";

import {
  PARTIES_FILE,
  PARTIES_FOLDER,
  readParties,
} from "@/contracts/parties";

import { confirmDialog } from "@/services/dialog/appDialog";

import { deviceName } from "@/services/environment/environmentState";

import {
  pendingMessage,
  processingMessage,
  REJECTED_BY_SERVER,
} from "@/services/events/requestMessages";

import { formatAmount } from "@/utils/amountFormat";
import { formatDate } from "@/utils/dateFormat";

/* =========================
   Mouvement lié à une saisie de l'iPhone

   Candidat mobile de spending.json
   (../Backend/docs/mobile-expense-contract.md, § 7) : bandeau
   « Entered on the iPhone », affiché tant que le mouvement
   est lié, avec les détails de la saisie lus dans
   mobile/mobile.json (heure du paiement, montant et devise
   saisis, carte, propriétaire ; rien si la saisie n'y figure
   plus).

   « Not this expense » : après confirmation,
   MOBILE_EXPENSE_UNLINKED ; la saisie redevient ouverte et ce
   mouvement ne lui est plus proposé. Le Mac republie
   spending.json avant son statut : la vue le relit sur
   l'événement unlinked. Refus affichés tels quels.

   Commerçant tapé sur l'iPhone sans partie correspondante
   (partyName, contrat 0.9, § 7.3) : « Create party » ouvre la
   fiche de création (PARTY_SAVED, nom prérempli, aucun
   alias). Une fois parties.json republié, la nouvelle partie
   (identifiant absent à l'ouverture de la fiche) est
   transmise par partyCreated et devient celle de
   l'allocation. Le candidat garde son commerçant jusqu'à la
   republication suivante de spending.json.
========================= */

const props =
  withDefaults(
    defineProps<{
      expenseId: string;
      partyName?: string | null;
      disabled?: boolean;
    }>(),
    {
      partyName: null,
      disabled: false,
    }
  );

const emit = defineEmits<{
  unlinked: [];
  partyCreated: [partyId: number];
}>();

const NO_ANSWER_DELAY_MS =
  2 * 60 * 1000;

const mobileFile =
  useRemoteJson({
    folder: MOBILE_FOLDER,
    file: MOBILE_FILE,
    read: readMobileEntries,
    optional: true,
    watchRemote: false,
  });

const entry =
  computed(() =>
    mobileFile.data.value?.get(props.expenseId) ?? null
  );

/* « 20 Nov 2026 12:41 · 23.40 EUR · Card EUR · alex » */
const details =
  computed(() => {
    const current =
      entry.value;

    if (!current) {
      return "";
    }

    return [
      [
        formatDate(current.paidAt),
        current.paidAt.slice(11, 16),
      ]
        .filter(Boolean)
        .join(" "),
      `${formatAmount(current.amount)} ${current.currency}`,
      current.cardLabel ?? "",
      current.owner ?? "",
    ]
      .filter(Boolean)
      .join(" · ");
  });

const unlinkRequest =
  useEventRequest({
    trigram: MOBILE_EXPENSE_EVENT_TRIGRAM,
    noAnswerDelayMs: NO_ANSWER_DELAY_MS,
  });

async function unlink() {
  if (props.disabled || unlinkRequest.inProgress.value) {
    return;
  }

  const confirmed =
    await confirmDialog({
      title: "Not this expense?",
      message:
        "The iPhone entry becomes open again and will never be proposed for this movement again.",
      confirmLabel: "Unlink",
      destructive: true,
    });

  if (!confirmed) {
    return;
  }

  await unlinkRequest.send(
    {
      eventType: "MOBILE_EXPENSE_UNLINKED",
      version: MOBILE_EXPENSE_EVENT_VERSION,
      timestamp: new Date().toISOString(),
      payload: {
        id: props.expenseId,
        source: deviceName(),
      },
    },
    unlinkEventSuffix(props.expenseId)
  );
}

watch(
  () => unlinkRequest.request.value?.phase,

  phase => {
    if (phase === "completed") {
      emit("unlinked");
    }
  }
);

const message =
  computed(() => {
    const current =
      unlinkRequest.request.value;

    switch (current?.phase) {
      case "requested":
        return pendingMessage("Sent", unlinkRequest.noAnswerYet.value);

      case "started":
        return processingMessage("Unlinking");

      case "completed":
        return current.message || "Expense unlinked";

      case "error":
        return current.message || REJECTED_BY_SERVER;

      default:
        return "";
    }
  });

const messageIsError =
  computed(() =>
    unlinkRequest.request.value?.phase === "error"
  );

/* =========================
   Création de la partie du commerçant
========================= */

/* parties.json lu au premier « Create party » seulement. */
const partiesNeeded =
  ref(false);

const partiesFile =
  useRemoteJson({
    folder: PARTIES_FOLDER,
    file: () => (partiesNeeded.value ? PARTIES_FILE : null),
    read: readParties,
  });

const partiesStore =
  useParties();

const sheetOpen =
  ref(false);

/* Identifiants des parties à l'ouverture de la fiche (null : pas encore lus). */
let knownPartyIds: Set<number> | null =
  null;

function rememberKnownParties() {
  const data =
    partiesFile.data.value;

  if (sheetOpen.value && data && knownPartyIds === null) {
    knownPartyIds =
      new Set(data.parties.map(party => party.id));
  }
}

/* Nom de la partie créée ici, une fois adoptée. */
const createdLabel =
  ref<string | null>(null);

const partyError =
  ref("");

function openPartySheet() {
  if (props.disabled) {
    return;
  }

  partyError.value = "";
  knownPartyIds = null;
  partiesNeeded.value = true;
  sheetOpen.value = true;
  rememberKnownParties();
}

watch(
  () => partiesFile.data.value,
  rememberKnownParties
);

async function onPartySaved() {
  await partiesFile.reload();

  const data =
    partiesFile.data.value;

  const known =
    knownPartyIds;

  const created =
    data?.parties
      .filter(party => known !== null && !known.has(party.id))
      .sort((a, b) => b.id - a.id)[0];

  if (!data || !created) {
    partyError.value =
      "Party saved, but not found yet: choose it from a suggestion.";
    return;
  }

  partiesStore.set(data.parties);
  createdLabel.value = created.label;
  emit("partyCreated", created.id);
}
</script>

<template>
  <div class="mobile-link">
    <p class="link-text">
      <span class="link-title">Entered on the iPhone</span>

      <span
        v-if="details"
        class="link-details"
      >
        {{ details }}
      </span>

      <span
        v-if="createdLabel"
        class="link-details"
      >
        Party {{ createdLabel }} created, used for this allocation
      </span>

      <span
        v-else-if="partyName"
        class="link-details"
      >
        Merchant: {{ partyName }} — not a party yet
      </span>

      <span
        v-if="partyError"
        class="link-message error"
      >
        {{ partyError }}
      </span>

      <span
        v-if="message"
        class="link-message"
        :class="{ error: messageIsError }"
      >
        {{ message }}
      </span>
    </p>

    <span class="link-actions">
      <PillButton
        v-if="partyName && !createdLabel"
        :disabled="disabled"
        @click="openPartySheet"
      >
        Create party
      </PillButton>

      <PillButton
        :disabled="disabled || unlinkRequest.inProgress.value"
        @click="unlink"
      >
        Not this expense
      </PillButton>
    </span>
  </div>

  <PartySheet
    v-if="sheetOpen && partiesFile.data.value && partyName"
    :party="null"
    :data="partiesFile.data.value"
    :initial-label="partyName"
    @saved="onPartySaved"
    @close="sheetOpen = false"
  />
</template>

<style scoped>
.mobile-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;

  width: 100%;
  max-width: 640px;
  box-sizing: border-box;

  padding: 6px 10px;

  border: 1px solid var(--border);
  border-radius: 8px;

  background: var(--primary-soft);
}

.link-text {
  display: flex;
  flex-direction: column;

  min-width: 0;
  margin: 0;
}

.link-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.link-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.link-details,
.link-message {
  color: var(--text-soft);
  font-size: var(--font-size-xs);
  overflow-wrap: anywhere;
}

.link-message.error {
  color: var(--negative);
}
</style>
