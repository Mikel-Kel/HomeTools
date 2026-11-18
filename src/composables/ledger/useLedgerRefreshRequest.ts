import { computed } from "vue";

import { useEventRequest } from "@/composables/useEventRequest";

import {
  LEDGER_EVENT_TRIGRAM,
  LEDGER_REFRESH_VERSION,
  accountEventSuffix,
} from "@/contracts/ledger";

import { deviceName } from "@/services/environment/environmentState";

import {
  pendingMessage,
  processingMessage,
  REJECTED_BY_SERVER,
} from "@/services/events/requestMessages";

/* =========================
   Rafraîchissement du ledger d'un compte

   Contrat : ../Backend/docs/ledger-contract.md, § 7.
   LEDGER_REFRESH_REQUESTED, suivi jusqu'au statut du Mac,
   écrit après la republication des fichiers du compte et de
   l'index. Demande gardée en localStorage (persistKey) : le
   statut survit à un changement de page.
========================= */

const NO_ANSWER_DELAY_MS =
  2 * 60 * 1000;

const TIMEOUT_MS =
  15 * 60 * 1000;

export function useLedgerRefreshRequest() {
  const tracker =
    useEventRequest({
      trigram: LEDGER_EVENT_TRIGRAM,
      noAnswerDelayMs: NO_ANSWER_DELAY_MS,
      timeoutMs: TIMEOUT_MS,
      persistKey: "ledgerRefreshEvent",
    });

  function send(
    accountId: number
  ): Promise<void> {
    return tracker.send(
      {
        eventType: "LEDGER_REFRESH_REQUESTED",
        version: LEDGER_REFRESH_VERSION,
        timestamp: new Date().toISOString(),
        payload: {
          accountId,
          source: deviceName(),
        },
      },
      accountEventSuffix(accountId)
    );
  }

  const message =
    computed(() => {
      const current =
        tracker.request.value;

      switch (current?.phase) {
        case "requested":
          return pendingMessage("Ledger refresh", tracker.noAnswerYet.value);

        case "started":
          return processingMessage("Refreshing the ledger");

        case "completed":
          return current.message || "Ledger refreshed.";

        case "error":
          return current.message || REJECTED_BY_SERVER;

        default:
          return "";
      }
    });

  const tone =
    computed(() =>
      tracker.request.value?.phase ?? ""
    );

  return {
    send,
    inProgress: tracker.inProgress,
    message,
    tone,
  };
}
