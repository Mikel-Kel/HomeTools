<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from "vue";

import EditSheet from "@/components/masterData/EditSheet.vue";

import { useEventRequest } from "@/composables/useEventRequest";

import {
  ACC_TAG_TYPE,
  isTagUsed,
  type AllocationTag,
} from "@/contracts/allocationTags";

import { confirmDialog } from "@/services/dialog/appDialog";

import { formatInteger } from "@/utils/amountFormat";
import { detectDevice } from "@/utils/deviceDetection";

/* =========================
   Fiche tag des mouvements

   Création (tag null), renommage, numéro d'ordre ou
   suppression d'un tag inutilisé et non réservé. Envoi au
   Mac (../Backend/docs/tags-contract.md) :
     events/PWA-TAG_<AAAAMMJJHHMMSS>_T<TagID|NEW>.json
       { "eventType": "TAG_SAVED",
         "payload": { "tagType": "Acc", "tagId" | null,
                      "label", "seq", "source" } }
     events/PWA-TAG_<AAAAMMJJHHMMSS>_T<TagID>_DEL.json
       { "eventType": "TAG_DELETED",
         "payload": { "tagType": "Acc", "tagId", "source" } }
   Le Mac refuse aussi la suppression d'un tag présent dans
   un draft d'allocation.
========================= */

const props = defineProps<{
  tag: AllocationTag | null;

  /* Tous les tags, pour le contrôle des doublons et l'ordre par défaut. */
  tags: AllocationTag[];
}>();

const emit = defineEmits<{
  close: [];
}>();

const NO_ANSWER_DELAY_MS =
  2 * 60 * 1000;

const LABEL_MAX_LENGTH = 50;

const SEQ_MAX = 999;

const isNew =
  props.tag === null;

const originalLabel =
  props.tag?.tagName ?? "";

/* Nouveau tag : après le dernier. */
const originalSeq =
  props.tag?.seqNb ??
  Math.min(
    SEQ_MAX,
    Math.max(0, ...props.tags.map(tag => tag.seqNb)) + 1
  );

const label =
  ref(originalLabel);

const seq =
  ref<number | string>(originalSeq);

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
    seqValue.value !== originalSeq
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
          other.tagName.trim().toLowerCase() === key
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
  `T${props.tag?.id ?? "NEW"}`;

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
        tagType: ACC_TAG_TYPE,
        tagId: props.tag?.id ?? null,
        label: trimmedLabel.value,
        seq: seqValue.value,
        source: detectDevice(),
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
  !isTagUsed(props.tag!);

async function remove() {
  if (
    !canDelete ||
    saveRequest.inProgress.value ||
    !(await confirmDialog({
      title: `Delete the tag "${props.tag!.tagName}"?`,
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
        tagType: ACC_TAG_TYPE,
        tagId: props.tag!.id,
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
      ? "A change of this tag is waiting for the Mac."
      : changed.value
        ? formError.value
        : ""
  );

const subtitle =
  computed(() => {
    if (isNew) {
      return "Created on the Mac";
    }

    const usage =
      props.tag!.usage;

    return (
      `Tag ${props.tag!.id} · ` +
      `${formatInteger(usage.allocations)} allocations · ` +
      `${formatInteger(usage.rules)} rules`
    );
  });
</script>

<template>
  <EditSheet
    :title="isNew ? 'New tag' : tag!.tagName"
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

    <p
      v-if="tag?.reserved"
      class="note"
    >
      Reserved tag: it can be renamed and moved, never deleted.
    </p>

    <p
      v-else-if="tag && isTagUsed(tag)"
      class="note"
    >
      Used by allocations or rules: it cannot be deleted.
    </p>
  </EditSheet>
</template>

<style scoped>
.seq-input {
  width: 8rem;
}
</style>
