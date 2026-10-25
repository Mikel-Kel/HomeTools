<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";

import PillButton from "@/components/ui/PillButton.vue";
import SegmentedControl from "@/components/ui/SegmentedControl.vue";
import StatusPill from "@/components/ui/StatusPill.vue";

import { useEventRequest } from "@/composables/useEventRequest";

import type { BudgetLine } from "@/contracts/budget";

import { formatInteger } from "@/utils/amountFormat";
import { detectDevice } from "@/utils/deviceDetection";

/* =========================
   Fiche budget d'une sous-catégorie

   12 montants, statut et mémo d'une année. L'enregistrement
   envoie au Mac :
     events/PWA-BUD_<AAAAMMJJHHMMSS>_<SubCategoryID>.json
     { "eventType": "BUDGET_UPDATED",
       "payload": { "year", "subCategoryId",
                    "months": [12 entiers ≥ 0],
                    "open", "memo", "source" } }
   puis se ferme une fois la demande traitée (budget.json
   republié).

   readonly : consultation seule (iPad, iPhone) ; la
   saisie est réservée au Mac.
========================= */

const props = defineProps<{
  year: number;
  line: BudgetLine;
  label: string;
  categoryLabel: string;
  natureLabel: string;
  readonly?: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const NO_ANSWER_DELAY_MS =
  2 * 60 * 1000;

type LineStatus =
  | "open"
  | "confirmed";

const statusOptions: {
  value: LineStatus;
  label: string;
}[] = [
  { value: "open", label: "Open (to confirm)" },
  { value: "confirmed", label: "Confirmed" },
];

/* =========================
   Saisie

   Valeurs d'origine figées à l'ouverture : une
   republication de budget.json pendant la saisie ne
   l'écrase pas.
========================= */

const original = {
  months: [...props.line.months],
  open: props.line.open,
  memo: props.line.memo ?? "",
};

function parseAmount(
  text: string
): number {
  const digits =
    text.replace(/\D/g, "");

  return digits
    ? Number(digits)
    : 0;
}

function formatInput(
  value: number
): string {
  return value === 0
    ? ""
    : formatInteger(value);
}

const monthInputs =
  ref<string[]>(
    original.months.map(formatInput)
  );

const status =
  ref<LineStatus>(
    original.open
      ? "open"
      : "confirmed"
  );

const memo =
  ref(original.memo);

const months =
  computed(() =>
    monthInputs.value.map(parseAmount)
  );

const total =
  computed(() =>
    months.value.reduce(
      (sum, value) => sum + value,
      0
    )
  );

const changed =
  computed(() =>
    months.value.some(
      (value, index) =>
        value !== original.months[index]
    ) ||
    (status.value === "open") !== original.open ||
    memo.value.trim() !== original.memo.trim()
  );

function normalizeMonth(
  index: number
) {
  monthInputs.value[index] =
    formatInput(
      months.value[index]
    );
}

function copyJanuary() {
  const january =
    formatInput(months.value[0]);

  monthInputs.value =
    Array(12).fill(january);
}

/* =========================
   Enregistrement
========================= */

const updateRequest =
  useEventRequest({
    trigram: "BUD",
    noAnswerDelayMs: NO_ANSWER_DELAY_MS,
  });

/*
  Mise à jour de cette ligne déjà en attente dans events/
  (autre onglet, ou envoyée avant un rechargement).
*/
const waitingElsewhere =
  computed(() =>
    updateRequest.request.value === null &&
    updateRequest.waitingFiles.value.some(
      name =>
        name.endsWith(
          `_${props.line.subCategoryId}.json`
        )
    )
  );

const canSave =
  computed(() =>
    !props.readonly &&
    changed.value &&
    !updateRequest.inProgress.value &&
    !waitingElsewhere.value
  );

async function save() {
  if (!canSave.value) {
    return;
  }

  await updateRequest.send(
    {
      eventType: "BUDGET_UPDATED",
      version: 1,
      timestamp: new Date().toISOString(),
      payload: {
        year: props.year,
        subCategoryId: props.line.subCategoryId,
        months: months.value,
        open: status.value === "open",
        memo: memo.value.trim() || null,
        source: detectDevice(),
      },
    },
    String(props.line.subCategoryId)
  );
}

watch(
  () => updateRequest.request.value?.phase,

  phase => {
    if (phase === "completed") {
      emit("close");
    }
  }
);

const requestMessage =
  computed(() => {
    if (waitingElsewhere.value) {
      return "An update of this line is waiting for the Mac.";
    }

    const current =
      updateRequest.request.value;

    switch (current?.phase) {
      case "requested":
        return updateRequest.noAnswerYet.value
          ? "Sent — no answer from the Mac yet. Check that it is on and reachable."
          : "Sent — waiting for the Mac…";

      case "started":
        return "Saving on the Mac…";

      case "error":
        return `Rejected: ${current.message ?? "unknown error"}`;

      default:
        return "";
    }
  });

/* =========================
   Fermeture
========================= */

function close() {
  if (
    !props.readonly &&
    changed.value &&
    !updateRequest.inProgress.value &&
    !confirm("Discard the changes of this line?")
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
    :aria-label="`Budget ${year} – ${label}`"
  >
    <!-- Header -->

    <header class="sheet-header">
      <div>
        <h2>{{ label }}</h2>

        <div class="sheet-subtitle">
          {{ categoryLabel }} · {{ natureLabel }} · {{ year }}
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

    <!-- Months -->

    <div class="months-header">
      <h3>Monthly amounts</h3>

      <PillButton
        v-if="!readonly"
        :disabled="updateRequest.inProgress.value"
        @click="copyJanuary"
      >
        Copy January to all months
      </PillButton>
    </div>

    <div class="months-grid">
      <label
        v-for="(month, index) in MONTH_LABELS"
        :key="month"
        class="month-field"
      >
        <span>{{ month }}</span>

        <input
          v-model="monthInputs[index]"
          type="text"
          inputmode="numeric"
          placeholder="0"
          :readonly="readonly"
          :disabled="updateRequest.inProgress.value"
          @blur="normalizeMonth(index)"
        />
      </label>
    </div>

    <div class="total-line">
      Total <strong>{{ formatInteger(total) }}</strong>
    </div>

    <!-- Status -->

    <div class="field-row">
      <h3>Status</h3>

      <StatusPill
        v-if="readonly"
        :tone="status === 'open' ? 'warning' : 'positive'"
      >
        {{ status === "open" ? "Open (to confirm)" : "Confirmed" }}
      </StatusPill>

      <SegmentedControl
        v-else
        v-model="status"
        :options="statusOptions"
      />
    </div>

    <!-- Memo -->

    <label class="memo-field">
      <h3>Memo {{ year }}</h3>

      <pre
        v-if="readonly"
        class="memo-text"
      >{{ memo || "No memo." }}</pre>

      <textarea
        v-else
        v-model="memo"
        rows="8"
        :disabled="updateRequest.inProgress.value"
      ></textarea>
    </label>

    <!-- Actions -->

    <footer
      v-if="readonly"
      class="sheet-footer"
    >
      <span class="request-message">
        Read-only on this device — edit on the Mac.
      </span>

      <PillButton @click="close">
        Close
      </PillButton>
    </footer>

    <footer
      v-else
      class="sheet-footer"
    >
      <span
        class="request-message"
        :class="updateRequest.request.value?.phase"
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

  width: 640px;
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

h3 {
  margin: 0;

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
   Months
========================= */

.months-header,
.field-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.months-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
}

.month-field {
  display: flex;
  flex-direction: column;
  gap: 4px;

  color: var(--text-soft);
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.month-field input {
  width: 100%;
  box-sizing: border-box;

  padding: 6px 8px;

  border: 1px solid var(--input-border);
  border-radius: 8px;

  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.total-line {
  color: var(--text-soft);
  font-size: var(--font-size-sm);
  text-align: right;
}

.total-line strong {
  margin-left: 0.5rem;

  color: var(--text);
  font-variant-numeric: tabular-nums;
}

/* =========================
   Memo
========================= */

.memo-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/*
  Police à chasse fixe : les mémos alignent des montants
  avec des espaces.
*/
.memo-text,
.memo-field textarea {
  box-sizing: border-box;
  width: 100%;

  padding: 8px 10px;

  border: 1px solid var(--input-border);
  border-radius: 8px;

  font-family: ui-monospace, Menlo, monospace;
  font-size: var(--font-size-sm);
  line-height: 1.4;

  resize: vertical;
}

.memo-text {
  margin: 0;

  background: var(--surface-soft);
  color: var(--text);

  white-space: pre-wrap;
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
