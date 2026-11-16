import { computed } from "vue";

import { useEventRequest } from "@/composables/useEventRequest";

import {
  type AllocationRuleSave,
  type RuleFromAllocation,
  RULE_EVENT_TRIGRAM,
  RULE_EVENT_VERSION,
} from "@/contracts/allocationRules";

import { deviceName } from "@/services/environment/environmentState";

import {
  pendingMessage,
  processingMessage,
  REJECTED_BY_SERVER,
} from "@/services/events/requestMessages";

/* =========================
   « Remember » d'une allocation (règle d'allocation)

   Contrat : ../Backend/docs/allocation-rules-contract.md,
   § 18.1 et § 20. La page Allocation envoie RULE_SAVED avec
   fromAllocation, puis revient à la liste : la demande est
   gardée en localStorage (persistKey) et la page Spending
   la reprend pour afficher le statut du Mac (« Rule 312
   created: Music {M-1} ») ou son refus.
========================= */

const NO_ANSWER_DELAY_MS =
  2 * 60 * 1000;

const TIMEOUT_MS =
  15 * 60 * 1000;

export function useRememberRequest() {
  const tracker =
    useEventRequest({
      trigram: RULE_EVENT_TRIGRAM,
      noAnswerDelayMs: NO_ANSWER_DELAY_MS,
      timeoutMs: TIMEOUT_MS,
      persistKey: "rememberRuleEvent",
    });

  /* Création : commentTemplate et refMonthOffset calculés par le Mac. */
  function send(
    rule: AllocationRuleSave,
    fromAllocation: RuleFromAllocation
  ): Promise<void> {
    return tracker.send(
      {
        eventType: "RULE_SAVED",
        version: RULE_EVENT_VERSION,
        timestamp: new Date().toISOString(),
        payload: {
          rule,
          fromAllocation,
          source: deviceName(),
        },
      }
    );
  }

  const message =
    computed(() => {
      const current =
        tracker.request.value;

      switch (current?.phase) {
        case "requested":
          return pendingMessage("Remember", tracker.noAnswerYet.value);

        case "started":
          return processingMessage("Remembering");

        case "completed":
          return current.message || "Rule saved.";

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
    message,
    tone,
  };
}
