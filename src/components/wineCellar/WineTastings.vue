<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from "vue";

import PillButton from "@/components/ui/PillButton.vue";

import {
  TASTING_NOTE_MAX_LENGTH,
  type Wine,
  type WineTasting,
} from "@/contracts/wineCellar";

import type { WineEvents } from "@/composables/wineCellar/useWineEvents";

import { confirmDialog } from "@/services/dialog/appDialog";

/* =========================
   Dégustations d'un vin (fiche)

   Contrat : ../Backend/docs/wine-cellar-contract.md, § 3
   (WINE_TASTING_SAVED, WINE_TASTING_DELETED). Liste dans
   l'ordre du fichier (la plus récente en premier), dates
   partielles telles quelles.

   - « Add tasting » : date (aujourd'hui par défaut), note ;
     vin en stock : la bouteille est ouverte (bottleOpened),
     le Mac retire une bouteille ; à 0 bouteille, rien n'est
     retiré ;
   - « Edit » : date et note ; une date partielle importée
     reste inchangée tant qu'aucune date n'est choisie ;
   - « Delete » : après confirmation.
   Une saisie à la fois ; actions désactivées tant que le vin
   attend. Le parent est prévenu d'une saisie non envoyée
   (dirty) pour confirmer avant de fermer la fiche.
========================= */

const props = defineProps<{
  wine: Wine;
  events: WineEvents;
  pending: boolean;
}>();

const emit = defineEmits<{
  dirty: [value: boolean];
}>();

const FULL_DATE =
  /^\d{4}-\d{2}-\d{2}$/;

function today(): string {
  const date =
    new Date();

  const pad = (value: number) =>
    String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/* AAAA-MM-JJ d'un jour qui existe. */
function isValidDate(
  text: string
): boolean {
  if (!FULL_DATE.test(text)) {
    return false;
  }

  const [year, month, day] =
    text.split("-").map(Number);

  const date =
    new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/* =========================
   Saisie

   null : aucune ; tasting null : ajout.
========================= */

const editor =
  ref<{ tasting: WineTasting | null } | null>(null);

const dateText =
  ref("");

const noteText =
  ref("");

/* Date partielle importée, gardée si aucune date n'est choisie. */
const keptPartialDate =
  computed(() => {
    const original =
      editor.value?.tasting?.date ?? "";

    return original && !FULL_DATE.test(original)
      ? original
      : null;
  });

function openEditor(
  tasting: WineTasting | null
) {
  editor.value = { tasting };

  if (tasting) {
    dateText.value =
      FULL_DATE.test(tasting.date) ? tasting.date : "";

    noteText.value = tasting.note;
  } else {
    dateText.value = today();
    noteText.value = "";
  }
}

function closeEditor() {
  editor.value = null;
}

const sentDate =
  computed(() =>
    dateText.value.trim() || keptPartialDate.value || ""
  );

const dateError =
  computed(() => {
    const text =
      dateText.value.trim();

    if (!text) {
      return keptPartialDate.value ? "" : "Enter a date.";
    }

    if (!isValidDate(text)) {
      return "Enter a valid date (YYYY-MM-DD).";
    }

    return text > today()
      ? "The date cannot be in the future."
      : "";
  });

const noteError =
  computed(() => {
    const note =
      noteText.value.trim();

    if (!note) {
      return "Enter a note.";
    }

    return note.length > TASTING_NOTE_MAX_LENGTH
      ? `At most ${TASTING_NOTE_MAX_LENGTH} characters.`
      : "";
  });

const changed =
  computed(() => {
    const tasting =
      editor.value?.tasting;

    if (!editor.value) {
      return false;
    }

    if (!tasting) {
      return noteText.value.trim() !== "";
    }

    return (
      sentDate.value !== tasting.date ||
      noteText.value.trim() !== tasting.note
    );
  });

watch(
  changed,

  value => emit("dirty", value),

  {
    immediate: true,
  }
);

const canSave =
  computed(() =>
    !!editor.value &&
    changed.value &&
    !dateError.value &&
    !noteError.value &&
    !props.pending
  );

function save() {
  if (!editor.value || !canSave.value) {
    return;
  }

  const tasting =
    editor.value.tasting;

  props.events.saveTasting({
    wineId: props.wine.id,
    tastingId: tasting?.id ?? null,
    date: sentDate.value,
    note: noteText.value.trim(),
    bottleOpened: !tasting && props.wine.quantity > 0,
  });

  closeEditor();
}

async function remove(
  tasting: WineTasting
) {
  if (
    !(await confirmDialog({
      title: "Delete this tasting?",
      message: `${tasting.date || "Undated"}: ${tasting.note}`,
      confirmLabel: "Delete",
      destructive: true,
    }))
  ) {
    return;
  }

  props.events.deleteTasting(
    props.wine.id,
    tasting.id
  );

  if (editor.value?.tasting?.id === tasting.id) {
    closeEditor();
  }
}
</script>

<template>
  <div class="block">
    <div class="block-header">
      <h3>Tastings</h3>

      <PillButton
        v-if="!editor"
        :disabled="pending"
        @click="openEditor(null)"
      >
        Add tasting
      </PillButton>
    </div>

    <form
      v-if="editor"
      class="editor"
      @submit.prevent="save"
    >
      <div class="editor-line">
        <label class="field">
          <span class="field-label">Date</span>

          <input
            v-model="dateText"
            class="date-input"
            type="date"
            :max="today()"
          />
        </label>

        <span
          v-if="!editor.tasting && wine.quantity > 0"
          class="note"
        >
          One bottle will be taken from the stock.
        </span>
      </div>

      <p
        v-if="keptPartialDate && !dateText.trim()"
        class="note"
      >
        Imported date “{{ keptPartialDate }}” is kept unless you pick a new date.
      </p>

      <label class="field">
        <span class="field-label">
          Note
          <span class="counter">{{ noteText.trim().length }} / {{ TASTING_NOTE_MAX_LENGTH }}</span>
        </span>

        <textarea
          v-model="noteText"
          class="note-input"
          rows="3"
          placeholder="Impression, with whom"
        ></textarea>
      </label>

      <p
        v-if="changed && (dateError || noteError)"
        class="error"
      >
        {{ dateError || noteError }}
      </p>

      <div class="editor-actions">
        <PillButton @click="closeEditor">
          Cancel
        </PillButton>

        <PillButton
          variant="primary"
          :disabled="!canSave"
          @click="save"
        >
          {{ editor.tasting ? "Save" : "Add" }}
        </PillButton>
      </div>
    </form>

    <p
      v-if="!wine.tastings.length"
      class="note"
    >
      No tasting yet.
    </p>

    <ul
      v-else
      class="tastings"
    >
      <li
        v-for="tasting in wine.tastings"
        :key="tasting.id"
        :class="{ editing: editor?.tasting?.id === tasting.id }"
      >
        <span class="tasting-date">{{ tasting.date || "—" }}</span>
        <span class="tasting-note">{{ tasting.note }}</span>

        <span class="tasting-actions">
          <PillButton
            class="small-button"
            :disabled="pending || !!editor"
            @click="openEditor(tasting)"
          >
            Edit
          </PillButton>

          <PillButton
            class="small-button"
            variant="danger"
            :disabled="pending || !!editor"
            @click="remove(tasting)"
          >
            Delete
          </PillButton>
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.block-header h3 {
  margin: 0;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
  font-weight: 700;
}

.note {
  margin: 0;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

.error {
  margin: 0;

  color: var(--negative);
  font-size: var(--font-size-sm);
}

/* =========================
   Editor
========================= */

.editor {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;

  padding: 12px;

  border: 1px solid var(--border);
  border-radius: 10px;

  background: var(--bg-soft);
}

.editor-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem 1.25rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  display: flex;
  justify-content: space-between;
  gap: 1rem;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

.counter {
  font-variant-numeric: tabular-nums;
}

.date-input,
.note-input {
  box-sizing: border-box;

  padding: 6px 10px;

  border: 1px solid var(--input-border);
  border-radius: 8px;

  background: var(--surface);
  color: var(--text);

  font: inherit;
  font-size: var(--font-size-sm);
}

.note-input {
  width: 100%;
  resize: vertical;
}

.editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

/* =========================
   List
========================= */

.tastings {
  display: flex;
  flex-direction: column;
  gap: 6px;

  margin: 0;
  padding: 0;

  list-style: none;
}

.tastings li {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.tastings li.editing {
  color: var(--text-muted);
}

.tasting-date {
  flex-shrink: 0;
  min-width: 5.5rem;

  color: var(--text-soft);
  font-variant-numeric: tabular-nums;
}

.tasting-note {
  flex: 1;

  white-space: pre-line;
  overflow-wrap: anywhere;
}

.tasting-actions {
  display: inline-flex;
  flex-shrink: 0;
  gap: 4px;
}

.small-button {
  padding: 2px 10px;

  font-size: var(--font-size-xs);
}
</style>
