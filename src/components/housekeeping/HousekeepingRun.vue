<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from "vue";

import {
  getFileModifiedTime,
  listFiles,
} from "@/services/driveAdapter";

import {
  useDriveWatcher,
} from "@/composables/useDriveWatcher";

import {
  useEventRequest,
} from "@/composables/useEventRequest";

import {
  useRemoteJson,
} from "@/composables/useRemoteJson";

import {
  HOUSEKEEPING_LOG_INDEX_FILE,
  HOUSEKEEPING_LOGS_FOLDER,
  HOUSEKEEPING_STEPS_FILE,
  HOUSEKEEPING_STEPS_FOLDER,
  readHousekeepingSteps,
  type HousekeepingStep,
} from "@/contracts/housekeeping";

import {
  EVENT_PROCESSING_FOLDER,
  EVENT_STATUS_FOLDER,
  eventFilePattern,
  loadEventStatus,
} from "@/services/events/eventFiles";

import {
  deviceName,
} from "@/services/environment/environmentState";

import PillButton from "@/components/ui/PillButton.vue";
import StatusPill from "@/components/ui/StatusPill.vue";
import { confirmDialog } from "@/services/dialog/appDialog";

import {
  pendingMessage,
  processingMessage,
  runningElsewhereMessage,
  waitingElsewhereMessage,
} from "@/services/events/requestMessages";

/* =========================
   Data contract

   Step catalogue: src/contracts/housekeeping.ts.

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

/*
  Sans réponse du Mac au-delà de ce délai, un message
  l’indique (Mac éteint, proxy injoignable, etc.).
*/
const NO_ANSWER_DELAY_MS =
  2 * 60 * 1000;

/*
  Durée au-delà de laquelle un housekeeping pris en charge
  sans réécriture de l’index des journaux n’est plus
  considéré comme en cours (fin sans index, Mac arrêté…).
*/
const MAX_RUN_MS =
  60 * 60 * 1000;

const HKP_EVENT_PATTERN =
  eventFilePattern("HKP");

/* =========================
   Types
========================= */

interface StepGroup {
  name: string;
  steps: HousekeepingStep[];
}

/* =========================
   State
========================= */

/*
  Catalogue des étapes, publié par chaque housekeeping.
*/
const catalogue =
  useRemoteJson({
    folder:
      HOUSEKEEPING_STEPS_FOLDER,

    file:
      HOUSEKEEPING_STEPS_FILE,

    read:
      readHousekeepingSteps,
  });

const steps =
  computed<HousekeepingStep[]>(() =>
    catalogue.data.value ?? []
  );

const loading =
  catalogue.loading;

const loadError =
  catalogue.error;

const selectedKeys =
  ref<Set<string>>(new Set());

/*
  Demande en cours. Le statut « success » ne marque que la
  prise en charge : la fin est donnée par l’index des
  journaux (voir Tracking).
*/
const hkp =
  useEventRequest({
    trigram: "HKP",
    completeOnSuccess: false,
    noAnswerDelayMs: NO_ANSWER_DELAY_MS,
  });

const request =
  hkp.request;

/*
  Demande trouvée dans events/ (envoyée depuis un autre
  appareil ou avant un rechargement).
*/
const waitingRequestFound =
  computed(() =>
    request.value === null &&
    hkp.waitingFiles.value.length > 0
  );

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

/*
  Housekeeping en cours sur le Mac, déduit du stockage et
  non de l’appareil (demande envoyée depuis un autre
  appareil, page rechargée) :
  - demande HKP en traitement (events/processing/) ;
  - dernière demande prise en charge (statut « success »)
    plus récente que l’index des journaux, réécrit à la fin
    de chaque housekeeping, dans la limite de MAX_RUN_MS.
  Le Mac refuse toute demande pendant ce temps.
*/
const runningOnMac =
  ref(false);

function eventStamp(
  fileName: string
): string {
  return (
    fileName.match(/_(\d{14})/)?.[1] ??
    ""
  );
}

async function lastStartedRunTime():
  Promise<number | null> {

  const names =
    (await listFiles(EVENT_STATUS_FOLDER))
      .map(file => file.name)
      .filter(name => HKP_EVENT_PATTERN.test(name))
      .sort((a, b) =>
        eventStamp(b).localeCompare(eventStamp(a))
      );

  for (const name of names) {
    const status =
      await loadEventStatus(name);

    if (status?.status === "success") {
      const time =
        Date.parse(status.finishedAt);

      return Number.isNaN(time)
        ? null
        : time;
    }
  }

  return null;
}

async function refreshRunningOnMac() {
  const processing =
    await listFiles(EVENT_PROCESSING_FOLDER)
      .catch(() => []);

  if (
    processing.some(file =>
      HKP_EVENT_PATTERN.test(file.name)
    )
  ) {
    runningOnMac.value = true;

    return;
  }

  const startedAt =
    await lastStartedRunTime();

  if (
    startedAt === null ||
    Date.now() - startedAt > MAX_RUN_MS
  ) {
    runningOnMac.value = false;

    return;
  }

  const logIndexTime =
    Date.parse(
      await getFileModifiedTime(
        HOUSEKEEPING_LOGS_FOLDER,
        HOUSEKEEPING_LOG_INDEX_FILE
      ) ?? ""
    );

  runningOnMac.value =
    Number.isNaN(logIndexTime) ||
    logIndexTime < startedAt;
}

const requestInProgress =
  computed(() =>
    hkp.inProgress.value ||
    waitingRequestFound.value ||
    runningOnMac.value
  );

const canRun =
  computed(() =>
    selectedSteps.value.length > 0 &&
    !requestInProgress.value &&
    !loading.value
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

/*
  Sélection initiale : les étapes de la nuit, au premier
  chargement du catalogue seulement.
*/
watch(
  steps,

  (current, previous) => {
    if (
      current.length &&
      !previous?.length
    ) {
      selectNightly();
    }
  }
);

/* =========================
   Request
========================= */

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
    await confirmDialog({
      title: "Run housekeeping now?",
      message: labels,
      confirmLabel: "Run",
    });

  if (!confirmed) {
    return;
  }

  await hkp.send({
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
        deviceName(),
    },
  });
}

/* =========================
   Tracking
========================= */

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
    HOUSEKEEPING_LOGS_FOLDER,

  fileName:
    HOUSEKEEPING_LOG_INDEX_FILE,

  lastKnownState:
    logIndexRemoteState,

  onChanged:
    async () => {
      await refreshRunningOnMac();

      if (!logIndexStateKnown) {
        logIndexStateKnown =
          true;

        return;
      }

      hkp.complete();
    },
});

useDriveWatcher({
  folderId:
    EVENT_STATUS_FOLDER,

  lastKnownState:
    ref<string | null>(null),

  onChanged:
    refreshRunningOnMac,
});

useDriveWatcher({
  folderId:
    EVENT_PROCESSING_FOLDER,

  lastKnownState:
    ref<string | null>(null),

  onChanged:
    refreshRunningOnMac,
});

/* =========================
   Display helpers
========================= */

const requestMessage =
  computed(() => {
    if (waitingRequestFound.value) {
      return waitingElsewhereMessage("A housekeeping request");
    }

    if (
      runningOnMac.value &&
      !hkp.inProgress.value
    ) {
      return runningElsewhereMessage("A housekeeping");
    }

    switch (request.value?.phase) {
      case "requested":
        return pendingMessage("Requested", hkp.noAnswerYet.value);

      case "started":
        return processingMessage("Running");

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
        <PillButton
          :disabled="requestInProgress"
          @click="selectNightly"
        >
          As nightly
        </PillButton>

        <PillButton
          :disabled="requestInProgress"
          @click="selectAll"
        >
          All
        </PillButton>

        <PillButton
          :disabled="requestInProgress"
          @click="selectNone"
        >
          None
        </PillButton>
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

          <StatusPill v-if="!step.manual">
            Nightly only
          </StatusPill>

          <StatusPill v-else-if="isForced(step)">
            Required by {{ forcedBy.get(step.key) }}
          </StatusPill>

          <StatusPill
            v-else-if="!step.nightly"
            dashed
          >
            Off at night
          </StatusPill>
        </label>
      </section>

      <!-- Run -->

      <div class="run-bar">
        <PillButton
          variant="primary"
          :disabled="!canRun"
          @click="runHousekeeping"
        >
          Run housekeeping
          <span v-if="selectedSteps.length">
            ({{ selectedSteps.length }})
          </span>
        </PillButton>

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
