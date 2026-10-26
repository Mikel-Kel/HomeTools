<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";

import { useRouter } from "vue-router";

import PillButton from "@/components/ui/PillButton.vue";

import { useEventRequest } from "@/composables/useEventRequest";

import {
  isCarriedForward,
  type IndicatorItem,
  type IndicatorValue,
  type VehicleService,
} from "@/contracts/indicators";

import {
  formatInteger,
  formatMeasure,
} from "@/utils/amountFormat";

import { formatDate } from "@/utils/dateFormat";
import { detectDevice } from "@/utils/deviceDetection";

/* =========================
   Fiche d'un indicateur pour une fin de mois

   Envoie au Mac (events/PWA-IND_<AAAAMMJJHHMMSS>_<famille>-<indicateur>.json) :
   - INDICATOR_VALUE_SAVED   : valeur, commentaire, valeur initiale ;
   - INDICATOR_VALUE_DELETED : suppression de la valeur du mois ;
   - INDICATOR_SERVICE_UPDATED (véhicules) : dernier service,
     prochain service, SAN.
   Se ferme une fois les demandes traitées (exports
   republiés). Contrat : ../Backend/docs/indicators-contract.md.
========================= */

const props = defineProps<{
  familyId: number;
  date: string;
  monthLabel: string;
  item: IndicatorItem;
  current: IndicatorValue | null;

  /* Valeurs de l'indicateur, de la plus ancienne à la plus récente. */
  history: IndicatorValue[];
}>();

const emit = defineEmits<{
  close: [];
}>();

const NO_ANSWER_DELAY_MS =
  2 * 60 * 1000;

const HISTORY_SIZE = 6;

const router =
  useRouter();

function openHistory() {
  router.push({
    name: "indicatorHistory",
    query: {
      family: String(props.familyId),
      item: String(props.item.itemId),
    },
  });
}

/* =========================
   Saisie

   Valeurs d'origine figées à l'ouverture. Le commentaire
   « <- last known value » n'est pas repris : un relevé
   saisi le remplace.
========================= */

function parseNumber(
  text: string
): number | null {
  const normalized =
    text
      .trim()
      .replace(/['’\s]/g, "")
      .replace(",", ".");

  if (normalized === "") {
    return null;
  }

  const number =
    Number(normalized);

  return Number.isFinite(number)
    ? number
    : Number.NaN;
}

function formatInput(
  value: number | null | undefined
): string {
  return value == null
    ? ""
    : formatMeasure(value);
}

const originalComment =
  props.current &&
  !isCarriedForward(props.current.comment)
    ? props.current.comment ?? ""
    : "";

const valueInput =
  ref(formatInput(props.current?.value));

const commentInput =
  ref(originalComment);

const initialValueInput =
  ref(formatInput(props.current?.initialValue));

const showInitialValue =
  ref(props.current?.initialValue != null);

const value =
  computed(() =>
    parseNumber(valueInput.value)
  );

const initialValue =
  computed(() =>
    parseNumber(initialValueInput.value)
  );

const valueError =
  computed(() => {
    if (Number.isNaN(value.value)) {
      return "Not a number";
    }

    if (Number.isNaN(initialValue.value)) {
      return "Initial value is not a number";
    }

    return null;
  });

const valueChanged =
  computed(() =>
    value.value !== null &&
    (
      !props.current ||
      isCarriedForward(props.current.comment) ||
      value.value !== props.current.value ||
      commentInput.value.trim() !== originalComment.trim() ||
      initialValue.value !== (props.current.initialValue ?? null)
    )
  );

/* =========================
   Entretien (véhicules)
========================= */

const service =
  props.item.service;

const lastServiceDate =
  ref(service?.lastServiceDate ?? "");

const lastServiceKmInput =
  ref(formatInput(service?.lastServiceKm));

const nextServiceKmInput =
  ref(formatInput(service?.nextServiceKm));

const lastSanVisit =
  ref(service?.lastSanVisit ?? "");

const editedService =
  computed<VehicleService | null>(() => {
    if (!service) {
      return null;
    }

    return {
      ...service,
      lastServiceDate: lastServiceDate.value || null,
      lastServiceKm: parseNumber(lastServiceKmInput.value),
      nextServiceKm: parseNumber(nextServiceKmInput.value),
      lastSanVisit: lastSanVisit.value || null,
    };
  });

const serviceError =
  computed(() =>
    editedService.value &&
    (
      Number.isNaN(editedService.value.lastServiceKm) ||
      Number.isNaN(editedService.value.nextServiceKm)
    )
      ? "Service kilometres must be numbers"
      : null
  );

const serviceChanged =
  computed(() =>
    !!service &&
    !!editedService.value &&
    (
      editedService.value.lastServiceDate !== service.lastServiceDate ||
      editedService.value.lastServiceKm !== service.lastServiceKm ||
      editedService.value.nextServiceKm !== service.nextServiceKm ||
      editedService.value.lastSanVisit !== service.lastSanVisit
    )
  );

/*
  Aide : prochain service = kilométrage du dernier service
  plus l'intervalle.
*/
const suggestedNextServiceKm =
  computed(() => {
    const lastKm =
      editedService.value?.lastServiceKm;

    const interval =
      service?.intervalKm;

    return lastKm != null &&
      !Number.isNaN(lastKm) &&
      interval
      ? lastKm + interval
      : null;
  });

function applySuggestedNextService() {
  if (suggestedNextServiceKm.value !== null) {
    nextServiceKmInput.value =
      formatInput(suggestedNextServiceKm.value);
  }
}

/* =========================
   Historique
========================= */

const recentValues =
  computed(() =>
    props.history
      .filter(item => item.date !== props.date)
      .slice(-HISTORY_SIZE)
      .reverse()
  );

/* =========================
   Envoi
========================= */

const valueRequest =
  useEventRequest({
    trigram: "IND",
    noAnswerDelayMs: NO_ANSWER_DELAY_MS,
  });

const serviceRequest =
  useEventRequest({
    trigram: "IND",
    noAnswerDelayMs: NO_ANSWER_DELAY_MS,
  });

const requests = [
  valueRequest,
  serviceRequest,
];

const sentRequests =
  computed(() =>
    requests.filter(
      request => request.request.value !== null
    )
  );

const inProgress =
  computed(() =>
    requests.some(
      request => request.inProgress.value
    )
  );

const canSave =
  computed(() =>
    !inProgress.value &&
    !valueError.value &&
    !serviceError.value &&
    (valueChanged.value || serviceChanged.value)
  );

const eventSuffix =
  `${props.familyId}-${props.item.itemId}`;

async function save() {
  if (!canSave.value) {
    return;
  }

  const base = {
    familyId: props.familyId,
    itemId: props.item.itemId,
    source: detectDevice(),
  };

  if (valueChanged.value) {
    await valueRequest.send(
      {
        eventType: "INDICATOR_VALUE_SAVED",
        version: 1,
        timestamp: new Date().toISOString(),
        payload: {
          ...base,
          date: props.date,
          value: value.value,
          comment: commentInput.value.trim() || null,
          initialValue: showInitialValue.value
            ? initialValue.value
            : null,
        },
      },
      eventSuffix
    );
  }

  if (serviceChanged.value && editedService.value) {
    await serviceRequest.send(
      {
        eventType: "INDICATOR_SERVICE_UPDATED",
        version: 1,
        timestamp: new Date().toISOString(),
        payload: {
          ...base,
          lastServiceDate: editedService.value.lastServiceDate,
          lastServiceKm: editedService.value.lastServiceKm,
          nextServiceKm: editedService.value.nextServiceKm,
          lastSanVisit: editedService.value.lastSanVisit,
        },
      },
      eventSuffix
    );
  }
}

async function deleteValue() {
  if (
    !props.current ||
    inProgress.value ||
    !confirm(`Delete the ${props.monthLabel} value of ${props.item.label}?`)
  ) {
    return;
  }

  await valueRequest.send(
    {
      eventType: "INDICATOR_VALUE_DELETED",
      version: 1,
      timestamp: new Date().toISOString(),
      payload: {
        familyId: props.familyId,
        itemId: props.item.itemId,
        date: props.date,
        source: detectDevice(),
      },
    },
    eventSuffix
  );
}

/*
  Fermeture quand toutes les demandes envoyées sont
  traitées ; une erreur garde la fiche ouverte.
*/
watch(
  () =>
    sentRequests.value.map(
      request => request.request.value?.phase
    ),

  phases => {
    if (
      phases.length &&
      phases.every(phase => phase === "completed")
    ) {
      emit("close");
    }
  }
);

const requestMessage =
  computed(() => {
    const failed =
      sentRequests.value.find(
        request =>
          request.request.value?.phase === "error"
      );

    if (failed) {
      return `Rejected: ${failed.request.value?.message ?? "unknown error"}`;
    }

    if (!inProgress.value) {
      return "";
    }

    return sentRequests.value.some(
      request => request.noAnswerYet.value
    )
      ? "Sent — no answer from the Mac yet. Check that it is on and reachable."
      : "Sent — waiting for the Mac…";
  });

const hasError =
  computed(() =>
    sentRequests.value.some(
      request =>
        request.request.value?.phase === "error"
    )
  );

/* =========================
   Fermeture
========================= */

function close() {
  if (
    (valueChanged.value || serviceChanged.value) &&
    !inProgress.value &&
    sentRequests.value.length === 0 &&
    !confirm("Discard the changes of this indicator?")
  ) {
    return;
  }

  emit("close");
}

function onKeydown(
  event: KeyboardEvent
) {
  if (event.key === "Escape") {
    close();
  }
}

onMounted(() => {
  window.addEventListener(
    "keydown",
    onKeydown
  );
});

onBeforeUnmount(() => {
  window.removeEventListener(
    "keydown",
    onKeydown
  );
});
</script>

<template>
  <div
    class="overlay"
    @click="close"
  ></div>

  <section
    class="sheet"
    role="dialog"
    :aria-label="`${item.label} – ${monthLabel}`"
  >
    <!-- Header -->

    <header class="sheet-header">
      <div>
        <h2>{{ item.label }}</h2>

        <div class="sheet-subtitle">
          {{ item.description }} · {{ monthLabel }}
        </div>

        <div
          v-if="item.objectId || item.groupTag"
          class="item-details"
        >
          <span v-if="item.objectId">
            <span class="detail-label">Object ID</span>
            {{ item.objectId }}
          </span>

          <span v-if="item.groupTag">
            <span class="detail-label">Group</span>
            {{ item.groupTag }}
          </span>
        </div>
      </div>

      <button
        type="button"
        class="close-btn"
        aria-label="Close"
        @click="close"
      >
        ✕
      </button>
    </header>

    <!-- Value -->

    <div class="fields">
      <label class="field">
        <span>Value {{ formatDate(date, "short") }}</span>

        <input
          v-model="valueInput"
          type="text"
          inputmode="decimal"
          :disabled="inProgress"
          autofocus
        />
      </label>

      <label class="field wide">
        <span>Comment</span>

        <input
          v-model="commentInput"
          type="text"
          :disabled="inProgress"
        />
      </label>
    </div>

    <div
      v-if="item.cumulative"
      class="initial-value"
    >
      <label
        v-if="showInitialValue"
        class="field"
      >
        <span>Initial value (meter start or change)</span>

        <input
          v-model="initialValueInput"
          type="text"
          inputmode="decimal"
          :disabled="inProgress"
        />
      </label>

      <PillButton
        v-else
        :disabled="inProgress"
        @click="showInitialValue = true"
      >
        Set an initial value…
      </PillButton>
    </div>

    <p
      v-if="valueError"
      class="field-error"
    >
      {{ valueError }}
    </p>

    <!-- Service (vehicles) -->

    <section
      v-if="service"
      class="service"
    >
      <h3>Service</h3>

      <div class="fields">
        <label class="field">
          <span>Last service</span>

          <input
            v-model="lastServiceDate"
            type="date"
            :disabled="inProgress"
          />
        </label>

        <label class="field">
          <span>at km</span>

          <input
            v-model="lastServiceKmInput"
            type="text"
            inputmode="numeric"
            :disabled="inProgress"
          />
        </label>

        <label class="field">
          <span>Next service at km</span>

          <input
            v-model="nextServiceKmInput"
            type="text"
            inputmode="numeric"
            :disabled="inProgress"
          />
        </label>

        <label class="field">
          <span>Last SAN visit</span>

          <input
            v-model="lastSanVisit"
            type="date"
            :disabled="inProgress"
          />
        </label>
      </div>

      <PillButton
        v-if="
          suggestedNextServiceKm !== null &&
          suggestedNextServiceKm !== editedService?.nextServiceKm
        "
        :disabled="inProgress"
        @click="applySuggestedNextService"
      >
        Next service = {{ formatInteger(suggestedNextServiceKm) }}
        (every {{ formatInteger(service.intervalKm) }} km)
      </PillButton>

      <p
        v-if="serviceError"
        class="field-error"
      >
        {{ serviceError }}
      </p>
    </section>

    <!-- History -->

    <section
      v-if="recentValues.length"
      class="history"
    >
      <div class="history-header">
        <h3>Previous readings</h3>

        <PillButton @click="openHistory">
          History charts
        </PillButton>
      </div>

      <table>
        <tbody>
          <tr
            v-for="reading in recentValues"
            :key="reading.date"
          >
            <td>{{ formatDate(reading.date, "short") }}</td>
            <td class="number">{{ formatMeasure(reading.value) }}</td>
            <td class="comment">{{ reading.comment }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Actions -->

    <footer class="sheet-footer">
      <PillButton
        v-if="current"
        :disabled="inProgress"
        @click="deleteValue"
      >
        Delete value
      </PillButton>

      <span
        class="request-message"
        :class="{ error: hasError }"
      >
        {{ requestMessage }}
      </span>

      <PillButton @click="close">
        Cancel
      </PillButton>

      <PillButton
        variant="primary"
        :disabled="!canSave"
        @click="save"
      >
        Save
      </PillButton>
    </footer>
  </section>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 999;

  background: var(--overlay);
}

.sheet {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 1000;

  display: flex;
  flex-direction: column;
  gap: 1rem;

  width: 600px;
  max-width: 92vw;
  max-height: 92vh;
  overflow-y: auto;

  padding: 22px;

  border-radius: 14px;

  background: var(--surface);
  box-shadow: var(--shadow-lg);

  transform: translate(-50%, -50%);
}

.sheet-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;

  padding-bottom: 10px;

  border-bottom: 1px solid var(--border);
}

.sheet-header h2 {
  margin: 0;

  font-size: var(--font-size-lg);
}

.sheet-subtitle {
  margin-top: 4px;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

.item-details {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 14px;

  margin-top: 6px;

  color: var(--text);
  font-size: var(--font-size-xs);
  font-variant-numeric: tabular-nums;
}

.detail-label {
  margin-right: 4px;

  color: var(--text-muted);
}

h3 {
  margin: 0 0 0.5rem;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
  font-weight: 700;
}

.close-btn {
  padding: 2px 6px;

  border: none;
  border-radius: 6px;

  background: transparent;
  color: var(--text);

  font-size: 18px;
  line-height: 1;

  cursor: pointer;
}

.close-btn:hover {
  background: var(--primary-soft);
}

/* =========================
   Fields
========================= */

.fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 10px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;

  color: var(--text-soft);
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.field.wide {
  grid-column: span 2;
}

.field input {
  box-sizing: border-box;
  width: 100%;

  padding: 6px 8px;

  border: 1px solid var(--input-border);
  border-radius: 8px;

  font-size: var(--font-size-sm);
}

.field input[inputmode] {
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.initial-value {
  display: flex;
  align-items: flex-end;
}

.field-error {
  margin: 0;

  color: var(--negative);
  font-size: var(--font-size-sm);
}

.service {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;

  padding-top: 10px;

  border-top: 1px solid var(--border);
}

.service .fields {
  width: 100%;
}

/* =========================
   History
========================= */

.history {
  padding-top: 10px;

  border-top: 1px solid var(--border);
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.history-header h3 {
  margin: 0;
}

.history table {
  width: 100%;
  border-collapse: collapse;

  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
}

.history td {
  padding: 3px 8px 3px 0;

  color: var(--text-soft);
}

.history .number {
  text-align: right;
}

.history .comment {
  width: 100%;
  padding-left: 1rem;
}

/* =========================
   Footer
========================= */

.sheet-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.5rem;

  padding-top: 10px;

  border-top: 1px solid var(--border);
}

.request-message {
  flex: 1;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

.request-message.error {
  color: var(--negative);
}
</style>
