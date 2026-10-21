<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
} from "vue";

import {
  listFiles,
  loadJSONFromFolder,
  saveJSONToFolder,
} from "@/services/driveAdapter";

import {
  useDriveWatcher,
} from "@/composables/useDriveWatcher";

import {
  detectDevice,
} from "@/utils/deviceDetection";

/* =========================
   Data contract

   settings/housekeepingSteps.json, exported by every
   housekeeping run from the backend step catalogue:
     {
       "generatedAt": "2026-10-21T08:49:56Z",
       "steps": [
         { "key": "exportSpending", "label": "Export spending",
           "group": "Exports", "manual": true, "nightly": true },
         { "key": "archiveReconcile", ..., "forces": ["exportArchiveToc"] },
         ...
       ]
     }

   Manual run request, events/PWA-HKP_<AAAAMMJJHHMMSS>.json:
     {
       "eventType": "HOUSEKEEPING_REQUESTED",
       "payload": {
         "steps": ["exportSpending", ...],
         "source": "iPad"
       }
     }

   The backend accepts only "manual" steps, and also runs the
   steps they force. A manual reconciliation is always
   applied. The nightly configuration (AppParameters.json) is
   never modified.
========================= */

const SETTINGS_FOLDER = "settings";
const STEPS_FILE = "housekeepingSteps.json";

const EVENTS_FOLDER = "events";
const STATUS_FOLDER = "events/status";

const DIAGNOSTICS_FOLDER = "diagnostics";
const LOG_INDEX_FILE = "housekeepingLogIndex.json";

const HKP_EVENT_FILE_PATTERN =
  /^(?:PWA-)?HKP_\d{14}\.json$/;

/*
  Sans réponse du Mac au-delà de ce délai, un message
  l’indique (Mac éteint, proxy injoignable, etc.).
*/
const NO_ANSWER_DELAY_MS =
  2 * 60 * 1000;

/* =========================
   Types
========================= */

interface HousekeepingStep {
  key: string;
  label: string;
  group: string;
  manual: boolean;
  nightly: boolean;
  forces: string[];
}

interface StepGroup {
  name: string;
  steps: HousekeepingStep[];
}

/*
  Suivi d’une demande :
  - requested : l’événement attend dans events/ ;
  - started   : le Mac l’a pris en charge ;
  - completed : le housekeeping a publié son journal ;
  - error     : le Mac a refusé la demande.
*/
type RequestPhase =
  | "requested"
  | "started"
  | "completed"
  | "error";

interface RequestState {
  fileName: string;
  requestedAt: number;
  phase: RequestPhase;
  message: string | null;
}

/* =========================
   State
========================= */

const steps =
  ref<HousekeepingStep[]>([]);

const selectedKeys =
  ref<Set<string>>(new Set());

const loading =
  ref(false);

const loadError =
  ref<string | null>(null);

const request =
  ref<RequestState | null>(null);

/*
  Demande trouvée dans events/ à l’ouverture de la page
  (envoyée depuis un autre appareil ou avant un
  rechargement).
*/
const waitingRequestFound =
  ref(false);

const now =
  ref(Date.now());

let clockTimer:
  number | null = null;

/* =========================
   Computed
========================= */

const groups =
  computed<StepGroup[]>(() => {
    const result: StepGroup[] = [];

    for (const step of steps.value) {
      let group =
        result.find(
          item =>
            item.name ===
            step.group
        );

      if (!group) {
        group = {
          name: step.group,
          steps: [],
        };

        result.push(group);
      }

      group.steps.push(step);
    }

    return result;
  });

const manualSteps =
  computed(() =>
    steps.value.filter(
      step => step.manual
    )
  );

/*
  Étapes imposées par une étape choisie (catalogue
  « forces »), avec le libellé de l’étape qui les impose.
*/
const forcedBy =
  computed(() => {
    const result =
      new Map<string, string>();

    for (const step of manualSteps.value) {
      if (!selectedKeys.value.has(step.key)) {
        continue;
      }

      for (const forced of step.forces) {
        if (!result.has(forced)) {
          result.set(
            forced,
            step.label
          );
        }
      }
    }

    return result;
  });

function isForced(
  step: HousekeepingStep
): boolean {
  return forcedBy.value.has(
    step.key
  );
}

const selectedSteps =
  computed(() =>
    manualSteps.value.filter(
      step =>
        selectedKeys.value.has(
          step.key
        ) ||
        isForced(step)
    )
  );

const requestInProgress =
  computed(() =>
    request.value?.phase === "requested" ||
    request.value?.phase === "started" ||
    waitingRequestFound.value
  );

const canRun =
  computed(() =>
    selectedSteps.value.length > 0 &&
    !requestInProgress.value &&
    !loading.value
  );

const noAnswerYet =
  computed(() =>
    request.value?.phase === "requested" &&
    now.value - request.value.requestedAt >
      NO_ANSWER_DELAY_MS
  );

/* =========================
   Selection
========================= */

function isSelected(
  step: HousekeepingStep
): boolean {
  return (
    selectedKeys.value.has(
      step.key
    ) ||
    isForced(step)
  );
}

function toggleStep(
  step: HousekeepingStep
) {
  if (
    !step.manual ||
    isForced(step) ||
    requestInProgress.value
  ) {
    return;
  }

  const next =
    new Set(selectedKeys.value);

  if (next.has(step.key)) {
    next.delete(step.key);
  } else {
    next.add(step.key);
  }

  selectedKeys.value = next;
}

function selectNightly() {
  selectedKeys.value =
    new Set(
      manualSteps.value
        .filter(
          step => step.nightly
        )
        .map(
          step => step.key
        )
    );
}

function selectAll() {
  selectedKeys.value =
    new Set(
      manualSteps.value.map(
        step => step.key
      )
    );
}

function selectNone() {
  selectedKeys.value =
    new Set();
}

/* =========================
   Loading
========================= */

async function loadSteps() {
  loading.value = true;
  loadError.value = null;

  try {
    const data =
      await loadJSONFromFolder<{
        steps?: HousekeepingStep[];
      }>(
        SETTINGS_FOLDER,
        STEPS_FILE
      );

    if (!data?.steps?.length) {
      throw new Error(
        `${STEPS_FILE} not found: it is created by the next housekeeping run`
      );
    }

    steps.value =
      data.steps.map(
        step => ({
          key: String(step.key),
          label: String(step.label ?? step.key),
          group: String(step.group ?? "Other"),
          manual: step.manual === true,
          nightly: step.nightly === true,
          forces:
            Array.isArray(step.forces)
              ? step.forces.map(String)
              : [],
        })
      );

    selectNightly();

  } catch (err) {
    loadError.value =
      err instanceof Error
        ? err.message
        : String(err);

  } finally {
    loading.value = false;
  }
}

/* =========================
   Request
========================= */

function buildEventFileName(): string {
  const date =
    new Date();

  const pad = (value: number) =>
    String(value).padStart(2, "0");

  const stamp =
    `${date.getFullYear()}` +
    `${pad(date.getMonth() + 1)}` +
    `${pad(date.getDate())}` +
    `${pad(date.getHours())}` +
    `${pad(date.getMinutes())}` +
    `${pad(date.getSeconds())}`;

  /*
    Toujours préfixé « PWA- », Local Drive compris : le Mac
    n’écrit un statut dans events/status/ que pour les
    événements ainsi nommés, et la page en a besoin pour
    afficher un refus.
  */
  return `PWA-HKP_${stamp}.json`;
}

async function runHousekeeping() {
  if (!canRun.value) {
    return;
  }

  const labels =
    selectedSteps.value
      .map(
        step => `• ${step.label}`
      )
      .join("\n");

  const confirmed =
    confirm(
      `Run housekeeping now?\n\n${labels}`
    );

  if (!confirmed) {
    return;
  }

  const fileName =
    buildEventFileName();

  const event = {
    eventType:
      "HOUSEKEEPING_REQUESTED",

    version:
      1,

    timestamp:
      new Date().toISOString(),

    payload: {
      steps:
        selectedSteps.value.map(
          step => step.key
        ),

      source:
        detectDevice(),
    },
  };

  try {
    await saveJSONToFolder(
      EVENTS_FOLDER,
      fileName,
      event
    );

    request.value = {
      fileName,
      requestedAt: Date.now(),
      phase: "requested",
      message: null,
    };

  } catch (err) {
    request.value = {
      fileName,
      requestedAt: Date.now(),
      phase: "error",
      message:
        err instanceof Error
          ? err.message
          : String(err),
    };
  }
}

/* =========================
   Tracking
========================= */

/*
  Relit events/ : une demande qui en sort a été prise en
  charge par le Mac, ou refusée (statut « error » dans
  events/status/ pour une demande envoyée par la PWA).
*/
async function checkEvents() {
  const files =
    await listFiles(
      EVENTS_FOLDER
    );

  const names =
    new Set(
      files.map(
        file => file.name
      )
    );

  waitingRequestFound.value =
    request.value === null &&
    files.some(
      file =>
        HKP_EVENT_FILE_PATTERN.test(
          file.name
        )
    );

  const current =
    request.value;

  if (
    !current ||
    current.phase !== "requested"
  ) {
    return;
  }

  const status =
    await loadJSONFromFolder<{
      status?: string;
      message?: string;
    }>(
      STATUS_FOLDER,
      current.fileName
    ).catch(() => null);

  if (status?.status === "error") {
    request.value = {
      ...current,
      phase: "error",
      message:
        status.message ||
        "Request rejected by the Mac",
    };

    return;
  }

  if (!names.has(current.fileName)) {
    request.value = {
      ...current,
      phase: "started",
    };
  }
}

const eventsRemoteState =
  ref<string | null>(null);

useDriveWatcher({
  folderId:
    EVENTS_FOLDER,

  lastKnownState:
    eventsRemoteState,

  onChanged:
    checkEvents,
});

/*
  L’index des journaux est réécrit à la fin de chaque
  housekeeping : son changement marque la fin de la
  demande en cours.
*/
const logIndexRemoteState =
  ref<string | null>(null);

let logIndexStateKnown =
  false;

useDriveWatcher({
  folderId:
    DIAGNOSTICS_FOLDER,

  fileName:
    LOG_INDEX_FILE,

  lastKnownState:
    logIndexRemoteState,

  onChanged:
    async () => {
      if (!logIndexStateKnown) {
        logIndexStateKnown =
          true;

        return;
      }

      const current =
        request.value;

      if (
        current &&
        (
          current.phase === "requested" ||
          current.phase === "started"
        )
      ) {
        request.value = {
          ...current,
          phase: "completed",
        };
      }

      waitingRequestFound.value =
        false;
    },
});

/* =========================
   Lifecycle
========================= */

onMounted(async () => {
  clockTimer =
    window.setInterval(
      () => {
        now.value =
          Date.now();
      },
      10_000
    );

  await loadSteps();

  await checkEvents().catch(
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

/* =========================
   Display helpers
========================= */

const requestMessage =
  computed(() => {
    if (waitingRequestFound.value) {
      return "A housekeeping request is waiting for the Mac.";
    }

    switch (request.value?.phase) {
      case "requested":
        return noAnswerYet.value
          ? "Requested — no answer from the Mac yet. Check that it is on and reachable."
          : "Requested — waiting for the Mac…";

      case "started":
        return "Running on the Mac…";

      case "completed":
        return "Completed — see the Logs tab.";

      case "error":
        return `Rejected: ${request.value.message ?? "unknown error"}`;

      default:
        return "";
    }
  });
</script>

<template>
  <div class="housekeeping-run">
    <div
      v-if="loading"
      class="state-message"
    >
      Loading steps…
    </div>

    <div
      v-else-if="loadError"
      class="state-message error"
    >
      {{ loadError }}
    </div>

    <template v-else>
      <!-- Presets -->

      <div class="presets">
        <button
          type="button"
          class="preset-btn"
          :disabled="requestInProgress"
          @click="selectNightly"
        >
          As nightly
        </button>

        <button
          type="button"
          class="preset-btn"
          :disabled="requestInProgress"
          @click="selectAll"
        >
          All
        </button>

        <button
          type="button"
          class="preset-btn"
          :disabled="requestInProgress"
          @click="selectNone"
        >
          None
        </button>
      </div>

      <!-- Steps -->

      <section
        v-for="group in groups"
        :key="group.name"
        class="step-group"
      >
        <h3 class="group-title">
          {{ group.name }}
        </h3>

        <label
          v-for="step in group.steps"
          :key="step.key"
          class="step-row"
          :class="{
            unavailable: !step.manual,
            disabled: requestInProgress
          }"
        >
          <input
            type="checkbox"
            :checked="
              step.manual &&
              isSelected(step)
            "
            :disabled="
              !step.manual ||
              isForced(step) ||
              requestInProgress
            "
            @change="toggleStep(step)"
          />

          <span class="step-label">
            {{ step.label }}
          </span>

          <span
            v-if="!step.manual"
            class="step-badge"
          >
            Nightly only
          </span>

          <span
            v-else-if="isForced(step)"
            class="step-badge"
          >
            Required by {{ forcedBy.get(step.key) }}
          </span>

          <span
            v-else-if="!step.nightly"
            class="step-badge muted"
          >
            Off at night
          </span>
        </label>
      </section>

      <!-- Run -->

      <div class="run-bar">
        <button
          type="button"
          class="run-btn"
          :disabled="!canRun"
          @click="runHousekeeping"
        >
          Run housekeeping
          <span v-if="selectedSteps.length">
            ({{ selectedSteps.length }})
          </span>
        </button>

        <span
          v-if="requestMessage"
          class="request-message"
          :class="request?.phase"
        >
          {{ requestMessage }}
        </span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.housekeeping-run {
  color: var(--text);
}

.state-message {
  padding: 0.75rem 1rem;

  border: 1px solid var(--border);
  border-radius: 8px;

  background: var(--surface);
  color: var(--text-soft);
}

.state-message.error {
  color: var(--negative);
}

/* =========================================================
   Presets
========================================================= */

.presets {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.preset-btn {
  padding: 4px 14px;

  border-radius: 999px;
  border: 1px solid var(--border);

  background: var(--surface-soft);
  color: var(--text-soft);

  font-size: var(--font-size-xs);
  font-weight: 600;

  cursor: pointer;
}

.preset-btn:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
}

.preset-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

/* =========================================================
   Steps
========================================================= */

.step-group {
  margin-bottom: 1rem;
}

.group-title {
  margin: 0 0 0.35rem;

  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--text-soft);
}

.step-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;

  padding: 4px 0;

  font-size: var(--font-size-sm);
  cursor: pointer;
}

.step-row.unavailable {
  color: var(--text-muted);
  cursor: default;
}

.step-row.disabled {
  cursor: default;
}

.step-badge {
  padding: 1px 8px;

  border-radius: 999px;
  border: 1px solid var(--border);

  font-size: var(--font-size-xs);
  color: var(--text-muted);
}

.step-badge.muted {
  border-style: dashed;
}

/* =========================================================
   Run bar
========================================================= */

.run-bar {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;

  margin-top: 1.25rem;
}

.run-btn {
  padding: 8px 20px;

  border-radius: 999px;
  border: 1px solid var(--primary);

  background: var(--primary-soft);
  color: var(--primary);

  font-size: var(--font-size-sm);
  font-weight: 700;

  cursor: pointer;
}

.run-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.request-message {
  font-size: var(--font-size-sm);
  color: var(--text-soft);
}

.request-message.completed {
  color: var(--positive);
}

.request-message.error {
  color: var(--negative);
}
</style>
