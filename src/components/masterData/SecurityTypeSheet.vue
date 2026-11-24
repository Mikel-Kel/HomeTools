<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from "vue";

import EditSheet from "@/components/masterData/EditSheet.vue";

import { useEventRequest } from "@/composables/useEventRequest";

import {
  PORTFOLIO_EVENT_TRIGRAM,
  PORTFOLIO_EVENT_VERSION,
  SECURITY_TYPE_LABEL_MAX,
  SECURITY_TYPE_SORT_MAX,
  securityTypeDeleteSuffix,
  securityTypeEventSuffix,
  type PortfolioSecurityType,
  type PortfolioSecurityTypeSave,
} from "@/contracts/portfolio";

import { confirmDialog } from "@/services/dialog/appDialog";

import {
  CREATED_ON_SERVER,
  waitingElsewhereMessage,
} from "@/services/events/requestMessages";

/* =========================
   Fiche type de titre du portefeuille

   Création (type null), modification ou suppression d'un type
   sans titre, par SECURITY_TYPE_SAVED / SECURITY_TYPE_DELETED
   (../Backend/docs/portfolio-contract.md, § 7). Le Mac reste
   juge : son refus est affiché tel quel.

   - Libellé : 50 caractères au plus, unique sans tenir compte
     de la casse ni des accents.
   - Ordre : 0 à 9999 ; vide à la création, le Mac prend le
     plus grand + 10.
========================= */

const props = defineProps<{
  type: PortfolioSecurityType | null;

  /* Tous les types, pour le contrôle des doublons. */
  types: PortfolioSecurityType[];
}>();

const emit = defineEmits<{
  close: [];
}>();

const NO_ANSWER_DELAY_MS =
  2 * 60 * 1000;

const isNew =
  props.type === null;

const originalLabel =
  props.type?.label ?? "";

const originalOrder =
  props.type ? String(props.type.sortOrder) : "";

const label =
  ref(originalLabel);

const sortOrder =
  ref(originalOrder);

const trimmedLabel =
  computed(() =>
    label.value.trim().replace(/\s+/g, " ")
  );

const trimmedOrder =
  computed(() =>
    String(sortOrder.value ?? "").trim()
  );

/* Clé de comparaison : sans casse ni accents. */
function labelKey(
  value: string
): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

const changed =
  computed(() =>
    trimmedLabel.value !== originalLabel ||
    trimmedOrder.value !== originalOrder
  );

const formError =
  computed(() => {
    if (!trimmedLabel.value) {
      return "The label is required.";
    }

    if (trimmedLabel.value.length > SECURITY_TYPE_LABEL_MAX) {
      return `At most ${SECURITY_TYPE_LABEL_MAX} characters.`;
    }

    const key =
      labelKey(trimmedLabel.value);

    if (
      props.types.some(
        other =>
          other.securityTypeId !== props.type?.securityTypeId &&
          labelKey(other.label) === key
      )
    ) {
      return "Already used by another type.";
    }

    if (!trimmedOrder.value) {
      return isNew ? "" : "The order is required.";
    }

    const order =
      Number(trimmedOrder.value);

    if (
      !Number.isInteger(order) ||
      order < 0 ||
      order > SECURITY_TYPE_SORT_MAX
    ) {
      return `The order is a whole number from 0 to ${SECURITY_TYPE_SORT_MAX}.`;
    }

    return "";
  });

const payload =
  computed<PortfolioSecurityTypeSave>(() => ({
    securityTypeId: props.type?.securityTypeId ?? null,
    label: trimmedLabel.value,
    ...(trimmedOrder.value ? { sortOrder: Number(trimmedOrder.value) } : {}),
  }));

const saveRequest =
  useEventRequest({
    trigram: PORTFOLIO_EVENT_TRIGRAM,
    noAnswerDelayMs: NO_ANSWER_DELAY_MS,
  });

const fileSuffix =
  securityTypeEventSuffix(props.type?.securityTypeId ?? null);

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
      version: PORTFOLIO_EVENT_VERSION,
      eventType: "SECURITY_TYPE_SAVED",
      timestamp: new Date().toISOString(),
      payload: payload.value,
    },
    fileSuffix
  );
}

/* =========================
   Suppression (type sans titre)
========================= */

const securityCount =
  props.type?.securityCount ?? 0;

const canDelete =
  computed(() =>
    !isNew &&
    securityCount === 0 &&
    !waitingElsewhere.value
  );

async function remove() {
  if (
    !canDelete.value ||
    saveRequest.inProgress.value ||
    !(await confirmDialog({
      title: `Delete the security type "${props.type!.label}"?`,
      confirmLabel: "Delete",
      destructive: true,
    }))
  ) {
    return;
  }

  await saveRequest.send(
    {
      version: PORTFOLIO_EVENT_VERSION,
      eventType: "SECURITY_TYPE_DELETED",
      timestamp: new Date().toISOString(),
      payload: {
        securityTypeId: props.type!.securityTypeId,
      },
    },
    securityTypeDeleteSuffix(props.type!.securityTypeId)
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
      ? waitingElsewhereMessage("A change of this type")
      : changed.value
        ? formError.value
        : ""
  );

const subtitle =
  isNew
    ? CREATED_ON_SERVER
    : `Security type ${props.type!.securityTypeId} · ${securityCount} ${securityCount === 1 ? "security" : "securities"}`;
</script>

<template>
  <EditSheet
    :title="isNew ? 'New security type' : type!.label"
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
    <div class="columns">
      <label class="field">
        <h3>Label</h3>

        <input
          v-model="label"
          type="text"
          :maxlength="SECURITY_TYPE_LABEL_MAX"
          :disabled="saveRequest.inProgress.value"
          @keydown.enter="save"
        />
      </label>

      <label class="field">
        <h3>Order</h3>

        <input
          v-model="sortOrder"
          type="number"
          min="0"
          :max="SECURITY_TYPE_SORT_MAX"
          step="10"
          :placeholder="isNew ? 'Last' : undefined"
          :disabled="saveRequest.inProgress.value"
          @keydown.enter="save"
        />
      </label>
    </div>

    <p
      v-if="!isNew && securityCount > 0"
      class="note"
    >
      Used by {{ securityCount }} {{ securityCount === 1 ? "security" : "securities" }}:
      change their type before deleting it.
    </p>
  </EditSheet>
</template>

<style scoped>
.columns {
  display: grid;
  grid-template-columns: 3fr 1fr;
  gap: 0.75rem;
}

.columns input {
  width: 100%;
  min-width: 0;
}

.note {
  margin: 0;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
}
</style>
