import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";

import {
  listFiles,
} from "@/services/driveAdapter";

import {
  useDriveWatcher,
} from "@/composables/useDriveWatcher";

import {
  emitEvent,
  EVENT_STATUS_FOLDER,
  EVENTS_FOLDER,
  eventFilePattern,
  loadEventStatus,
} from "@/services/events/eventFiles";

/* =========================
   Suivi d’une demande envoyée au Mac

   - requested : l’événement attend dans events/ ;
   - started   : le Mac l’a pris en charge ;
   - completed : traité avec succès (ou fin signalée
                 par la vue, voir completeOnSuccess) ;
   - error     : écriture impossible ou refus du Mac.
========================= */

export type EventRequestPhase =
  | "requested"
  | "started"
  | "completed"
  | "error";

export interface EventRequest {
  fileName: string;
  requestedAt: number;
  phase: EventRequestPhase;
  message: string | null;
}

interface EventRequestOptions {
  trigram: string;

  /*
    false : le statut « success » ne marque que la prise en
    charge, la vue signale la fin par complete() (ex. le
    housekeeping, qui tourne après le traitement de
    l’événement).
  */
  completeOnSuccess?: boolean;

  /*
    Sans réponse du Mac au-delà de ce délai, noAnswerYet
    passe à true (Mac éteint, proxy injoignable, etc.).
  */
  noAnswerDelayMs?: number;

  /*
    Au-delà de ce délai, la demande passe en erreur.
  */
  timeoutMs?: number;

  /*
    Clé localStorage : la demande en cours survit à un
    rechargement de la page (dans la limite de timeoutMs).
    Format : { "fileName": "…", "startedAt": <ms> }.
  */
  persistKey?: string;
}

export function useEventRequest({
  trigram,
  completeOnSuccess = true,
  noAnswerDelayMs,
  timeoutMs,
  persistKey,
}: EventRequestOptions) {
  const pattern =
    eventFilePattern(trigram);

  const request =
    ref<EventRequest | null>(null);

  /*
    Événements de ce type présents dans events/, quel que
    soit l’appareil qui les a envoyés.
  */
  const waitingFiles =
    ref<string[]>([]);

  const now =
    ref(Date.now());

  let clockTimer:
    number | null = null;

  const inProgress =
    computed(() =>
      request.value?.phase === "requested" ||
      request.value?.phase === "started"
    );

  const noAnswerYet =
    computed(() =>
      noAnswerDelayMs !== undefined &&
      request.value?.phase === "requested" &&
      now.value - request.value.requestedAt >
        noAnswerDelayMs
    );

  function update(
    phase: EventRequestPhase,
    message: string | null = null
  ) {
    if (request.value) {
      request.value = {
        ...request.value,
        phase,
        message,
      };
    }
  }

  async function send(
    event: object,
    suffix?: string
  ): Promise<void> {
    try {
      const fileName =
        await emitEvent(
          trigram,
          event,
          suffix
        );

      request.value = {
        fileName,
        requestedAt: Date.now(),
        phase: "requested",
        message: null,
      };

    } catch (err) {
      request.value = {
        fileName: "",
        requestedAt: Date.now(),
        phase: "error",
        message:
          err instanceof Error
            ? err.message
            : String(err),
      };
    }
  }

  function complete() {
    if (inProgress.value) {
      update("completed");
    }
  }

  function checkTimeout() {
    if (
      timeoutMs !== undefined &&
      inProgress.value &&
      request.value &&
      now.value - request.value.requestedAt >
        timeoutMs
    ) {
      update(
        "error",
        `No answer from the Mac after ${Math.round(timeoutMs / 60_000)} minutes`
      );
    }
  }

  /* =========================
     Persistance (persistKey)
  ========================= */

  function restore() {
    if (!persistKey) {
      return;
    }

    try {
      const saved =
        JSON.parse(
          localStorage.getItem(persistKey) ??
            "null"
        ) as {
          fileName?: unknown;
          startedAt?: unknown;
        } | null;

      if (
        typeof saved?.fileName !== "string" ||
        typeof saved.startedAt !== "number" ||
        (
          timeoutMs !== undefined &&
          Date.now() - saved.startedAt >= timeoutMs
        )
      ) {
        localStorage.removeItem(persistKey);

        return;
      }

      request.value = {
        fileName: saved.fileName,
        requestedAt: saved.startedAt,
        phase: "requested",
        message: null,
      };

    } catch {
      /* stockage local indisponible : rien à reprendre */
    }
  }

  if (persistKey) {
    watch(
      request,

      current => {
        try {
          if (
            current &&
            (
              current.phase === "requested" ||
              current.phase === "started"
            )
          ) {
            localStorage.setItem(
              persistKey,

              JSON.stringify({
                fileName: current.fileName,
                startedAt: current.requestedAt,
              })
            );
          } else {
            localStorage.removeItem(persistKey);
          }

        } catch {
          /* stockage local indisponible */
        }
      }
    );
  }

  /* =========================
     Suivi
  ========================= */

  async function check() {
    const files =
      await listFiles(
        EVENTS_FOLDER
      );

    const names =
      files.map(
        file => file.name
      );

    waitingFiles.value =
      names.filter(
        name => pattern.test(name)
      );

    const current =
      request.value;

    if (!current || !inProgress.value) {
      return;
    }

    const status =
      await loadEventStatus(
        current.fileName
      );

    if (status?.status === "error") {
      update(
        "error",
        status.message ||
          "Request rejected by the Mac"
      );

      return;
    }

    if (status?.status === "success") {
      update(
        completeOnSuccess
          ? "completed"
          : "started"
      );

      return;
    }

    if (
      current.phase === "requested" &&
      !names.includes(current.fileName)
    ) {
      update("started");
    }
  }

  /*
    Le statut peut être écrit après le déplacement de
    l’événement : les deux dossiers sont surveillés.
  */
  useDriveWatcher({
    folderId:
      EVENTS_FOLDER,

    lastKnownState:
      ref<string | null>(null),

    onChanged:
      check,
  });

  useDriveWatcher({
    folderId:
      EVENT_STATUS_FOLDER,

    lastKnownState:
      ref<string | null>(null),

    onChanged:
      check,
  });

  onMounted(async () => {
    restore();

    if (
      noAnswerDelayMs !== undefined ||
      timeoutMs !== undefined
    ) {
      clockTimer =
        window.setInterval(
          () => {
            now.value =
              Date.now();

            checkTimeout();
          },
          10_000
        );
    }

    await check().catch(
      err =>
        console.warn(
          "Unable to read events",
          err
        )
    );
  });

  onBeforeUnmount(() => {
    if (clockTimer !== null) {
      window.clearInterval(
        clockTimer
      );
    }
  });

  return {
    request,
    waitingFiles,
    inProgress,
    noAnswerYet,
    send,
    complete,
    check,
  };
}
