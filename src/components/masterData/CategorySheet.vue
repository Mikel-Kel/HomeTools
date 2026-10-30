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

import { useEventRequest } from "@/composables/useEventRequest";

import type {
  Category,
  CategoryDisplayScope,
  CategoryNature,
  SubCategory,
  SubCategoryStatus,
} from "@/contracts/categories";

import { confirmDialog } from "@/services/dialog/appDialog";

import { detectDevice } from "@/utils/deviceDetection";

/* =========================
   Fiche catégorie ou sous-catégorie

   Création (item null) ou modification. L'enregistrement
   envoie au Mac (../Backend/docs/categories-contract.md) :
     events/PWA-CAT_<AAAAMMJJHHMMSS>_C<CategoryID|NEW>.json
       { "eventType": "CATEGORY_SAVED",
         "payload": { "categoryId" | null, "label",
                      "nature", "displayScope", "source" } }
     events/PWA-CAT_<AAAAMMJJHHMMSS>_S<SubCategoryID|NEW>.json
       { "eventType": "SUBCATEGORY_SAVED",
         "payload": { "subCategoryId" | null, "categoryId",
                      "label", "status", "source" } }
   puis se ferme une fois la demande traitée (categories.json
   republié).
========================= */

const props = defineProps<
  | {
      kind: "category";
      item: Category | null;
      siblings: Category[];
    }
  | {
      kind: "subcategory";
      item: SubCategory | null;
      category: Category;
    }
>();

const emit = defineEmits<{
  close: [];
}>();

const NO_ANSWER_DELAY_MS =
  2 * 60 * 1000;

const natureOptions: {
  value: CategoryNature;
  label: string;
}[] = [
  { value: "I", label: "Income" },
  { value: "E", label: "Expense" },
  { value: "-", label: "Neutral" },
];

const scopeOptions: {
  value: CategoryDisplayScope;
  label: string;
}[] = [
  { value: "P", label: "Shown" },
  { value: "X", label: "Hidden (technical)" },
];

const statusOptions: {
  value: SubCategoryStatus;
  label: string;
}[] = [
  { value: "A", label: "Active" },
  { value: "C", label: "Closed" },
];

const isCategory =
  props.kind === "category";

const isNew =
  props.item === null;

/* Longueurs des colonnes MySQL. */
const maxLength =
  isCategory ? 255 : 50;

const title =
  isNew
    ? isCategory
      ? "New category"
      : "New sub-category"
    : props.item!.label;

const subtitle =
  props.kind === "category"
    ? isNew
      ? "Added at the end of the list"
      : `Category ${props.item!.id}`
    : isNew
      ? `In ${props.category.label} · added at the end, active`
      : `${props.category.label} · sub-category ${props.item!.id}`;

/* =========================
   Saisie

   Valeurs d'origine figées à l'ouverture : une
   republication de categories.json pendant la saisie ne
   l'écrase pas.
========================= */

const original = {
  label: props.item?.label ?? "",

  nature:
    props.kind === "category" && props.item
      ? props.item.nature
      : "E" as CategoryNature,

  displayScope:
    props.kind === "category" && props.item
      ? props.item.displayScope
      : "P" as CategoryDisplayScope,

  status:
    props.kind === "subcategory" && props.item
      ? props.item.status
      : "A" as SubCategoryStatus,
};

const label =
  ref(original.label);

const nature =
  ref<CategoryNature>(original.nature);

const displayScope =
  ref<CategoryDisplayScope>(original.displayScope);

const status =
  ref<SubCategoryStatus>(original.status);

const trimmedLabel =
  computed(() =>
    label.value.trim().replace(/\s+/g, " ")
  );

const changed =
  computed(() =>
    trimmedLabel.value !== original.label ||
    nature.value !== original.nature ||
    displayScope.value !== original.displayScope ||
    status.value !== original.status
  );

/*
  Mêmes refus que le backend : libellé vide, trop long, ou
  déjà utilisé (parmi les catégories, ou dans la catégorie).
*/
const labelError =
  computed(() => {
    if (!trimmedLabel.value) {
      return "The label is required.";
    }

    if (trimmedLabel.value.length > maxLength) {
      return `At most ${maxLength} characters.`;
    }

    const others: { id: number; label: string }[] =
      props.kind === "category"
        ? props.siblings
        : props.category.subcategories;

    const used =
      others.some(
        other =>
          other.id !== props.item?.id &&
          other.label.trim().toLowerCase() ===
            trimmedLabel.value.toLowerCase()
      );

    if (used) {
      return isCategory
        ? "Already used by another category."
        : "Already used in this category.";
    }

    return "";
  });

/* =========================
   Enregistrement
========================= */

const saveRequest =
  useEventRequest({
    trigram: "CAT",
    noAnswerDelayMs: NO_ANSWER_DELAY_MS,
  });

const fileSuffix =
  `${isCategory ? "C" : "S"}${props.item?.id ?? "NEW"}`;

/*
  Modification de cet élément déjà en attente dans events/
  (autre appareil, ou envoyée avant un rechargement).
*/
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
    !labelError.value &&
    !saveRequest.inProgress.value &&
    !waitingElsewhere.value
  );

async function save() {
  if (!canSave.value) {
    return;
  }

  const payload =
    props.kind === "category"
      ? {
          eventType: "CATEGORY_SAVED",
          payload: {
            categoryId: props.item?.id ?? null,
            label: trimmedLabel.value,
            nature: nature.value,
            displayScope: displayScope.value,
            source: detectDevice(),
          },
        }
      : {
          eventType: "SUBCATEGORY_SAVED",
          payload: {
            subCategoryId: props.item?.id ?? null,
            categoryId: props.category.id,
            label: trimmedLabel.value,
            status: status.value,
            source: detectDevice(),
          },
        };

  await saveRequest.send(
    {
      eventType: payload.eventType,
      version: 1,
      timestamp: new Date().toISOString(),
      payload: payload.payload,
    },
    fileSuffix
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

const requestMessage =
  computed(() => {
    if (waitingElsewhere.value) {
      return "A change of this item is waiting for the Mac.";
    }

    const current =
      saveRequest.request.value;

    switch (current?.phase) {
      case "requested":
        return saveRequest.noAnswerYet.value
          ? "Sent — no answer from the Mac yet. Check that it is on and reachable."
          : "Sent — waiting for the Mac…";

      case "started":
        return "Saving on the Mac…";

      case "error":
        return `Rejected: ${current.message ?? "unknown error"}`;

      default:
        return changed.value
          ? labelError.value
          : "";
    }
  });

const messageClass =
  computed(() =>
    saveRequest.request.value?.phase ??
    (changed.value && labelError.value ? "error" : "")
  );

/* =========================
   Fermeture
========================= */

async function close() {
  if (
    changed.value &&
    !saveRequest.inProgress.value &&
    !(await confirmDialog({
      title: "Discard the changes?",
      confirmLabel: "Discard",
      destructive: true,
    }))
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
    :aria-label="title"
  >
    <!-- Header -->

    <header class="sheet-header">
      <div>
        <h2>{{ title }}</h2>

        <div class="sheet-subtitle">
          {{ subtitle }}
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

    <!-- Fields -->

    <label class="field">
      <h3>Label</h3>

      <input
        v-model="label"
        type="text"
        :maxlength="maxLength + 20"
        :disabled="saveRequest.inProgress.value"
        @keydown.enter="save"
      />
    </label>

    <template v-if="kind === 'category'">
      <div class="field-row">
        <h3>Nature</h3>

        <SegmentedControl
          v-model="nature"
          :options="natureOptions"
        />
      </div>

      <div class="field-row">
        <h3>Follow-up</h3>

        <SegmentedControl
          v-model="displayScope"
          :options="scopeOptions"
        />
      </div>

      <p
        v-if="
          !isNew &&
          (nature !== original.nature ||
            displayScope !== original.displayScope)
        "
        class="note"
      >
        The follow-up aggregates are rebuilt by the Mac after this change.
      </p>
    </template>

    <template v-else-if="!isNew">
      <div class="field-row">
        <h3>Status</h3>

        <SegmentedControl
          v-model="status"
          :options="statusOptions"
        />
      </div>

      <p class="note">
        A closed sub-category stays in the history but is no longer offered for allocation.
      </p>
    </template>

    <!-- Actions -->

    <footer class="sheet-footer">
      <span
        class="request-message"
        :class="messageClass"
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
        {{ isNew ? "Create" : "Save" }}
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

  width: 560px;
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
   Fields
========================= */

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field input {
  box-sizing: border-box;
  width: 100%;

  padding: 8px 10px;

  border: 1px solid var(--input-border);
  border-radius: 8px;

  font-size: var(--font-size-md);
}

.field-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
}

.note {
  margin: 0;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
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
