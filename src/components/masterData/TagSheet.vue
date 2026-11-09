<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from "vue";

import EditSheet from "@/components/masterData/EditSheet.vue";

import { useEventRequest } from "@/composables/useEventRequest";

import { DOC_TAG_TYPE } from "@/contracts/documentTags";

import { confirmDialog } from "@/services/dialog/appDialog";

import { deviceName } from "@/services/environment/environmentState";

import type {
  TagItem,
  TagType,
} from "@/components/masterData/tagItems";

import {
  CREATED_ON_SERVER,
  waitingElsewhereMessage,
} from "@/services/events/requestMessages";

/* =========================
   Fiche tag (mouvements ou documents)

   Création (tag null), renommage, numéro d'ordre, couleur
   (tags Doc) ou suppression d'un tag inutilisé et non
   réservé. Envoi au Mac (../Backend/docs/tags-contract.md),
   suffixe T pour les tags Acc, D pour les tags Doc :
     events/PWA-TAG_<AAAAMMJJHHMMSS>_<T|D><TagID|NEW>.json
       { "eventType": "TAG_SAVED",
         "payload": { "tagType", "tagId" | null, "label",
                      "seq", "color" (Doc), "source" } }
     events/PWA-TAG_<AAAAMMJJHHMMSS>_<T|D><TagID>_DEL.json
       { "eventType": "TAG_DELETED",
         "payload": { "tagType", "tagId", "source" } }
   Le Mac refuse aussi la suppression d'un tag Acc présent
   dans un draft d'allocation.
========================= */

const props = defineProps<{
  tagType: TagType;
  tag: TagItem | null;

  /* Tous les tags du type, pour le contrôle des doublons et l'ordre par défaut. */
  tags: TagItem[];
}>();

const emit = defineEmits<{
  close: [];
}>();

const NO_ANSWER_DELAY_MS =
  2 * 60 * 1000;

const LABEL_MAX_LENGTH = 50;

const SEQ_MAX = 999;

const DEFAULT_COLOR = "#808080";

const isDoc =
  props.tagType === DOC_TAG_TYPE;

const isNew =
  props.tag === null;

const originalLabel =
  props.tag?.label ?? "";

/* Nouveau tag : après le dernier. */
const originalSeq =
  props.tag?.seq ??
  Math.min(
    SEQ_MAX,
    Math.max(0, ...props.tags.map(tag => tag.seq)) + 1
  );

const originalColor =
  props.tag?.color ?? DEFAULT_COLOR;

const label =
  ref(originalLabel);

const seq =
  ref<number | string>(originalSeq);

const color =
  ref(originalColor);

const trimmedLabel =
  computed(() =>
    label.value.trim().replace(/\s+/g, " ")
  );

/* Saisie vide ou invalide : NaN. */
const seqValue =
  computed(() =>
    seq.value === ""
      ? NaN
      : Number(seq.value)
  );

const changed =
  computed(() =>
    trimmedLabel.value !== originalLabel ||
    seqValue.value !== originalSeq ||
    (isDoc && color.value.toLowerCase() !== originalColor)
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
      props.tags.some(
        other =>
          other.id !== props.tag?.id &&
          other.label.trim().toLowerCase() === key
      )
    ) {
      return "Already used by another tag.";
    }

    if (
      !Number.isInteger(seqValue.value) ||
      seqValue.value < 0 ||
      seqValue.value > SEQ_MAX
    ) {
      return `The order is a whole number from 0 to ${SEQ_MAX}.`;
    }

    return "";
  });

const saveRequest =
  useEventRequest({
    trigram: "TAG",
    noAnswerDelayMs: NO_ANSWER_DELAY_MS,
  });

const fileSuffix =
  `${isDoc ? "D" : "T"}${props.tag?.id ?? "NEW"}`;

const waitingElsewhere =
  computed(() =>
    !isNew &&
    saveRequest.request.value === null &&
    saveRequest.waitingFiles.value.some(
      name =>
        name.endsWith(`_${fileSuffix}.json`) ||
        name.endsWith(`_${fileSuffix}_DEL.json`)
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
      eventType: "TAG_SAVED",
      version: 1,
      timestamp: new Date().toISOString(),
      payload: {
        tagType: props.tagType,
        tagId: props.tag?.id ?? null,
        label: trimmedLabel.value,
        seq: seqValue.value,
        ...(isDoc ? { color: color.value.toLowerCase() } : {}),
        source: deviceName(),
      },
    },
    fileSuffix
  );
}

/* =========================
   Suppression (tag inutilisé, non réservé)
========================= */

const canDelete =
  !isNew &&
  !props.tag!.reserved &&
  props.tag!.used === false;

async function remove() {
  if (
    !canDelete ||
    saveRequest.inProgress.value ||
    !(await confirmDialog({
      title: `Delete the tag "${props.tag!.label}"?`,
      confirmLabel: "Delete",
      destructive: true,
    }))
  ) {
    return;
  }

  await saveRequest.send(
    {
      eventType: "TAG_DELETED",
      version: 1,
      timestamp: new Date().toISOString(),
      payload: {
        tagType: props.tagType,
        tagId: props.tag!.id,
        source: deviceName(),
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
      ? waitingElsewhereMessage("A change of this tag")
      : changed.value
        ? formError.value
        : ""
  );

const subtitle =
  isNew
    ? CREATED_ON_SERVER
    : `Tag ${props.tag!.id} · ${props.tag!.usage}`;
</script>

<template>
  <EditSheet
    :title="isNew ? (isDoc ? 'New document tag' : 'New tag') : tag!.label"
    :subtitle="subtitle"
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

    <div class="field-row">
      <label class="field">
        <h3>Order</h3>

        <input
          v-model="seq"
          type="number"
          inputmode="numeric"
          min="0"
          :max="SEQ_MAX"
          step="1"
          class="seq-input"
          :disabled="saveRequest.inProgress.value"
          @keydown.enter="save"
        />
      </label>

      <label
        v-if="isDoc"
        class="field"
      >
        <h3>Color</h3>

        <input
          v-model="color"
          type="color"
          class="color-input"
          :disabled="saveRequest.inProgress.value"
        />
      </label>
    </div>

    <p
      v-if="tag?.reserved"
      class="note"
    >
      Reserved tag: it can be renamed and moved, never deleted.
    </p>

    <p
      v-else-if="tag?.used"
      class="note"
    >
      {{ isDoc ? "Used by documents" : "Used by allocations or rules" }}: it cannot be deleted.
    </p>

    <p
      v-else-if="tag && tag.used === null"
      class="note"
    >
      Usage not published yet: it cannot be deleted.
    </p>
  </EditSheet>
</template>

<style scoped>
.seq-input {
  width: 8rem;
}

.color-input {
  width: 4rem;
  height: 38px;
  padding: 2px 4px;

  cursor: pointer;
}
</style>
