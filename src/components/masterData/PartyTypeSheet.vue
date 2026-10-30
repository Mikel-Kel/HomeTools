<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from "vue";

import EditSheet from "@/components/masterData/EditSheet.vue";

import { useEventRequest } from "@/composables/useEventRequest";

import {
  RESERVED_PARTY_TYPE_IDS,
  type PartyType,
} from "@/contracts/parties";

import { detectDevice } from "@/utils/deviceDetection";

/* =========================
   Fiche type de partie

   Création (type null), renommage ou suppression d'un type
   sans partie. Envoi au Mac
   (../Backend/docs/parties-contract.md) :
     events/PWA-PTY_<AAAAMMJJHHMMSS>_T<PartyTypeID|NEW>.json
       { "eventType": "PARTY_TYPE_SAVED",
         "payload": { "typeId" | null, "label", "source" } }
     events/PWA-PTY_<AAAAMMJJHHMMSS>_T<PartyTypeID>_DEL.json
       { "eventType": "PARTY_TYPE_DELETED",
         "payload": { "typeId", "source" } }
========================= */

const props = defineProps<{
  type: PartyType | null;

  /* Tous les types, pour le contrôle des doublons. */
  types: PartyType[];

  /* Nombre de parties de ce type. */
  partyCount: number;
}>();

const emit = defineEmits<{
  close: [];
}>();

const NO_ANSWER_DELAY_MS =
  2 * 60 * 1000;

const LABEL_MAX_LENGTH = 50;

const isNew =
  props.type === null;

const originalLabel =
  props.type?.label ?? "";

const label =
  ref(originalLabel);

const trimmedLabel =
  computed(() =>
    label.value.trim().replace(/\s+/g, " ")
  );

const changed =
  computed(() =>
    trimmedLabel.value !== originalLabel
  );

const formError =
  computed(() => {
    if (!trimmedLabel.value) {
      return "The label is required.";
    }

    if (trimmedLabel.value.length > LABEL_MAX_LENGTH) {
      return `At most ${LABEL_MAX_LENGTH} characters.`;
    }

    const key =
      trimmedLabel.value.toLowerCase();

    if (
      props.types.some(
        other =>
          other.id !== props.type?.id &&
          other.label.trim().toLowerCase() === key
      )
    ) {
      return "Already used by another type.";
    }

    return "";
  });

const saveRequest =
  useEventRequest({
    trigram: "PTY",
    noAnswerDelayMs: NO_ANSWER_DELAY_MS,
  });

const fileSuffix =
  `T${props.type?.id ?? "NEW"}`;

const waitingElsewhere =
  computed(() =>
    !isNew &&
    saveRequest.request.value === null &&
    saveRequest.waitingFiles.value.some(
      name => name.endsWith(`_${fileSuffix}.json`)
    )
  );

const canSave =
  computed(() =>
    changed.value &&
    !formError.value &&
    !saveRequest.inProgress.value &&
    !waitingElsewhere.value
  );

async function save() {
  if (!canSave.value) {
    return;
  }

  await saveRequest.send(
    {
      eventType: "PARTY_TYPE_SAVED",
      version: 1,
      timestamp: new Date().toISOString(),
      payload: {
        typeId: props.type?.id ?? null,
        label: trimmedLabel.value,
        source: detectDevice(),
      },
    },
    fileSuffix
  );
}

/* =========================
   Suppression (type sans partie)
========================= */

const canDelete =
  !isNew &&
  !RESERVED_PARTY_TYPE_IDS.includes(props.type!.id) &&
  props.partyCount === 0;

async function remove() {
  if (
    !canDelete ||
    saveRequest.inProgress.value ||
    !confirm(`Delete the party type "${props.type!.label}"?`)
  ) {
    return;
  }

  await saveRequest.send(
    {
      eventType: "PARTY_TYPE_DELETED",
      version: 1,
      timestamp: new Date().toISOString(),
      payload: {
        typeId: props.type!.id,
        source: detectDevice(),
      },
    },
    `${fileSuffix}_DEL`
  );
}

watch(
  () => saveRequest.request.value?.phase,

  phase => {
    if (phase === "completed") {
      emit("close");
    }
  }
);

const hint =
  computed(() =>
    waitingElsewhere.value
      ? "A change of this type is waiting for the Mac."
      : changed.value
        ? formError.value
        : ""
  );
</script>

<template>
  <EditSheet
    :title="isNew ? 'New party type' : type!.label"
    :subtitle="isNew ? 'Created on the Mac' : `Party type ${type!.id} · ${partyCount} parties`"
    :request="saveRequest"
    :changed="changed"
    :can-save="canSave"
    :save-label="isNew ? 'Create' : 'Save'"
    :hint="hint"
    :hint-is-error="!!hint && !waitingElsewhere"
    :can-delete="canDelete"
    @save="save"
    @delete="remove"
    @close="emit('close')"
  >
    <label class="field">
      <h3>Label</h3>

      <input
        v-model="label"
        type="text"
        :disabled="saveRequest.inProgress.value"
        @keydown.enter="save"
      />
    </label>
  </EditSheet>
</template>
