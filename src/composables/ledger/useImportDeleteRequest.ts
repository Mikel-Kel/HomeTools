import { computed } from "vue";

import { useEventRequest } from "@/composables/useEventRequest";

import {
  IMPORT_DELETED_VERSION,
  IMPORT_EVENT_TRIGRAM,
  importEventSuffix,
} from "@/contracts/ledger";

import { deviceName } from "@/services/environment/environmentState";

import {
  pendingMessage,
  processingMessage,
  REJECTED_BY_SERVER,
} from "@/services/events/requestMessages";

/* =========================
   Effacement du dernier import d'un compte

   Contrat : ../Backend/docs/ledger-contract.md, § 5.
   IMPORT_DELETED, suivi jusqu'au statut du Mac, écrit après
   la republication de ledger/ et de spending.json. Demande
   gardée en localStorage (persistKey) : le statut survit à
   un changement de page.
========================= */

const NO_ANSWER_DELAY_MS =
  2 * 60 * 1000;

const TIMEOUT_MS =
  15 * 60 * 1000;

export function useImportDeleteRequest() {
  const tracker =
    useEventRequest({
      trigram: IMPORT_EVENT_TRIGRAM,
      noAnswerDelayMs: NO_ANSWER_DELAY_MS,
      timeoutMs: TIMEOUT_MS,
      persistKey: "ledgerImportDeleteEvent",
    });

  function send(
    accountId: number,
    importDate: string
  ): Promise<void> {
    return tracker.send(
      {
        eventType: "IMPORT_DELETED",
        version: IMPORT_DELETED_VERSION,
        timestamp: new Date().toISOString(),
        payload: {
          accountId,
          importDate,
          source: deviceName(),
        },
      },
      importEventSuffix(accountId)
    );
  }

  const message =
    computed(() => {
      const current =
        tracker.request.value;

      switch (current?.phase) {
        case "requested":
          return pendingMessage("Import deletion", tracker.noAnswerYet.value);

        case "started":
          return processingMessage("Deleting the import");

        case "completed":
          return current.message || "Import deleted.";

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
