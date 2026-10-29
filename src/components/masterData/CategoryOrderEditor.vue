<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from "vue";

import PillButton from "@/components/ui/PillButton.vue";
import StatusPill from "@/components/ui/StatusPill.vue";

import { useEventRequest } from "@/composables/useEventRequest";

import { detectDevice } from "@/utils/deviceDetection";

/* =========================
   Ordre d'affichage des catégories ou des sous-catégories
   d'une catégorie

   Remplace la liste du panneau le temps de la saisie (↑ ↓).
   L'enregistrement envoie au Mac :
     events/PWA-CAT_<AAAAMMJJHHMMSS>_ORDER.json
       { "eventType": "CATEGORY_ORDER_SAVED",
         "payload": { "categoryId" | null, "order": [ids],
                      "source" } }
   categoryId null : toutes les catégories ; sinon toutes les
   sous-catégories de la catégorie, clôturées comprises. Le
   Mac renumérote par pas de 10.
========================= */

const props = defineProps<{
  categoryId: number | null;
  items: {
    id: number;
    label: string;
    closed?: boolean;
  }[];
}>();

const emit = defineEmits<{
  close: [];
}>();

const NO_ANSWER_DELAY_MS =
  2 * 60 * 1000;

/* Ordre d'origine figé à l'ouverture. */
const originalOrder =
  props.items.map(item => item.id);

const order =
  ref<number[]>([...originalOrder]);

const labels =
  new Map(
    props.items.map(item => [item.id, item])
  );

const rows =
  computed(() =>
    order.value.map(id => labels.get(id)!)
  );

const changed =
  computed(() =>
    order.value.some(
      (id, index) => id !== originalOrder[index]
    )
  );

function move(
  index: number,
  delta: -1 | 1
) {
  const target =
    index + delta;

  if (target < 0 || target >= order.value.length) {
    return;
  }

  const next =
    [...order.value];

  [next[index], next[target]] =
    [next[target], next[index]];

  order.value =
    next;
}

/* =========================
   Enregistrement
========================= */

const orderRequest =
  useEventRequest({
    trigram: "CAT",
    noAnswerDelayMs: NO_ANSWER_DELAY_MS,
  });

/*
  Un ordre déjà en attente dans events/ (autre appareil) :
  le Mac le traiterait avant celui-ci.
*/
const waitingElsewhere =
  computed(() =>
    orderRequest.request.value === null &&
    orderRequest.waitingFiles.value.some(
      name => name.endsWith("_ORDER.json")
    )
  );

const canSave =
  computed(() =>
    changed.value &&
    !orderRequest.inProgress.value &&
    !waitingElsewhere.value
  );

async function save() {
  if (!canSave.value) {
    return;
  }

  await orderRequest.send(
    {
      eventType: "CATEGORY_ORDER_SAVED",
      version: 1,
      timestamp: new Date().toISOString(),
      payload: {
        categoryId: props.categoryId,
        order: order.value,
        source: detectDevice(),
      },
    },
    "ORDER"
  );
}

watch(
  () => orderRequest.request.value?.phase,

  phase => {
    if (phase === "completed") {
      emit("close");
    }
  }
);

const requestMessage =
  computed(() => {
    if (waitingElsewhere.value) {
      return "Another order change is waiting for the Mac.";
    }

    const current =
      orderRequest.request.value;

    switch (current?.phase) {
      case "requested":
        return orderRequest.noAnswerYet.value
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

function cancel() {
  if (!orderRequest.inProgress.value) {
    emit("close");
  }
}
</script>

<template>
  <div class="order-editor">
    <ol class="order-list">
      <li
        v-for="(row, index) in rows"
        :key="row.id"
        class="order-row"
        :class="{ closed: row.closed }"
      >
        <span class="order-label">{{ row.label }}</span>

        <StatusPill
          v-if="row.closed"
          dashed
        >
          Closed
        </StatusPill>

        <span class="order-buttons">
          <button
            type="button"
            class="move-btn"
            aria-label="Move up"
            :disabled="index === 0 || orderRequest.inProgress.value"
            @click="move(index, -1)"
          >
            ↑
          </button>

          <button
            type="button"
            class="move-btn"
            aria-label="Move down"
            :disabled="index === rows.length - 1 || orderRequest.inProgress.value"
            @click="move(index, 1)"
          >
            ↓
          </button>
        </span>
      </li>
    </ol>

    <footer class="order-footer">
      <span
        class="request-message"
        :class="orderRequest.request.value?.phase"
      >
        {{ requestMessage }}
      </span>

      <PillButton
        :disabled="orderRequest.inProgress.value"
        @click="cancel"
      >
        Cancel
      </PillButton>

      <PillButton
        variant="primary"
        :disabled="!canSave"
        @click="save"
      >
        Save order
      </PillButton>
    </footer>
  </div>
</template>

<style scoped>
.order-editor {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.order-list {
  margin: 0;
  padding: 0;

  list-style: none;
}

.order-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;

  min-height: 40px;
  padding: 4px 6px 4px 10px;

  border-radius: 8px;
}

.order-row:hover {
  background: var(--bg-soft);
}

.order-row.closed .order-label {
  color: var(--text-muted);
}

.order-label {
  flex: 1;
  min-width: 0;

  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-buttons {
  display: inline-flex;
  flex-shrink: 0;
  gap: 4px;
}

/* Cible tactile confortable sur iPad. */
.move-btn {
  width: 34px;
  height: 32px;

  border: 1px solid var(--border);
  border-radius: 8px;

  background: var(--surface);
  color: var(--text);
  font-size: var(--font-size-md);

  cursor: pointer;
}

.move-btn:hover:not(:disabled) {
  background: var(--primary-soft);
}

.move-btn:disabled {
  opacity: 0.35;

  cursor: default;
}

.order-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  flex-wrap: wrap;
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
