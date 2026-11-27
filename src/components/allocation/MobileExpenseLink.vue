<script setup lang="ts">
import {
  computed,
  watch,
} from "vue";

import PillButton from "@/components/ui/PillButton.vue";

import { useEventRequest } from "@/composables/useEventRequest";
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
========================= */

const props =
  withDefaults(
    defineProps<{
      expenseId: string;
      disabled?: boolean;
    }>(),
    {
      disabled: false,
    }
  );

const emit = defineEmits<{
  unlinked: [];
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
        v-if="message"
        class="link-message"
        :class="{ error: messageIsError }"
      >
        {{ message }}
      </span>
    </p>

    <PillButton
      :disabled="disabled || unlinkRequest.inProgress.value"
      @click="unlink"
    >
      Not this expense
    </PillButton>
  </div>
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
