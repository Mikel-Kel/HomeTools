import { computed } from "vue";

import { useRemoteJson } from "@/composables/useRemoteJson";

import {
  HOME_MESSAGES_FILE,
  HOME_MESSAGES_FOLDER,
  readHomeMessages,
} from "@/contracts/home";

/* =========================
   État du housekeeping (pastille de navigation)

   Messages du jour (diagnostics/homeMessages.json) :
   réinitialisés par le housekeeping de la nuit, puis
   complétés par chaque avertissement ou erreur de la
   journée (événements, exécutions manuelles). Leur niveau
   le plus grave donne la couleur de la pastille ; aucun
   message = pas de pastille. Un problème de lecture est
   sans effet sur la page.
========================= */

export type HousekeepingHealth =
  | "ok"
  | "warning"
  | "error";

export function useHousekeepingHealth() {
  const messages =
    useRemoteJson({
      folder: HOME_MESSAGES_FOLDER,
      file: HOME_MESSAGES_FILE,
      read: readHomeMessages,
      optional: true,
    });

  const list =
    computed(() =>
      messages.data.value ?? []
    );

  const health =
    computed<HousekeepingHealth | null>(() => {
      const levels =
        list.value.map(
          message => message.level
        );

      if (!levels.length) {
        return null;
      }

      if (levels.includes("error")) {
        return "error";
      }

      return levels.includes("warning")
        ? "warning"
        : "ok";
    });

  const title =
    computed(() => {
      const errors =
        list.value.filter(
          message => message.level === "error"
        ).length;

      const warnings =
        list.value.filter(
          message => message.level === "warning"
        ).length;

      if (!errors && !warnings) {
        return "No problem since the nightly run";
      }

      return [
        errors
          ? `${errors} error${errors > 1 ? "s" : ""}`
          : "",

        warnings
          ? `${warnings} warning${warnings > 1 ? "s" : ""}`
          : "",
      ]
        .filter(Boolean)
        .join(", ") +
        " since the nightly run";
    });

  return {
    health,
    title,
  };
}
