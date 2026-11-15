<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
} from "vue";

import PillButton from "@/components/ui/PillButton.vue";
import StatusPill from "@/components/ui/StatusPill.vue";

import {
  LOCATION_LEVEL_MAX_LENGTH,
  LOCATION_SHELF_MAX_LENGTH,
  locationLabel,
  type WineCellarData,
  type WineLocation,
} from "@/contracts/wineCellar";

import type { WineEvents } from "@/composables/wineCellar/useWineEvents";

import { confirmDialog } from "@/services/dialog/appDialog";

/* =========================
   Emplacements de la cave

   Contrat : ../Backend/docs/wine-cellar-contract.md, § 1
   (winelocation) et § 3 (WINE_LOCATION_SAVED,
   WINE_LOCATION_DELETED). Liste dans l'ordre du fichier
   (étagère puis étage), avec le nombre de vins en stock et
   de vins bus de chaque emplacement.

   - « New location » / « Edit » : étagère et étage
     facultatif (un seul), aperçu du libellé calculé par le
     backend ; couple (étagère, étage) unique, casse, accents
     et espaces de fin ignorés ;
   - « Delete » : désactivé tant qu'un vin s'y trouve (le Mac
     refuse aussi), après confirmation.
   Une saisie à la fois ; emplacement en attente marqué
   « Pending », message de la dernière demande en pied.
========================= */

const props = defineProps<{
  cellar: WineCellarData;
  events: WineEvents;
}>();

const emit = defineEmits<{
  close: [];
}>();

/* Comparaison MySQL utf8mb4_unicode_ci : casse, accents et espaces de fin ignorés. */
function fold(
  value: string
): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trimEnd();
}

/* =========================
   Liste
========================= */

interface LocationRow {
  location: WineLocation;
  inStock: number;
  drunk: number;
}

const rows =
  computed<LocationRow[]>(() =>
    props.cellar.locations.map(location => {
      const wines =
        props.cellar.wines.filter(wine => wine.locationId === location.id);

      const inStock =
        wines.filter(wine => wine.quantity > 0).length;

      return {
        location,
        inStock,
        drunk: wines.length - inStock,
      };
    })
  );

/* Vins en stock sans emplacement (rappel sous la liste). */
const withoutLocation =
  computed(() =>
    props.cellar.wines.filter(
      wine => wine.locationId === null && wine.quantity > 0
    ).length
  );

/* =========================
   Saisie

   undefined : aucune ; location null : création.
========================= */

const editor =
  ref<{ location: WineLocation | null } | undefined>(undefined);

const shelf =
  ref("");

const level =
  ref("");

function openEditor(
  location: WineLocation | null
) {
  editor.value = { location };
  shelf.value = location?.shelf ?? "";
  level.value = location?.level ?? "";
}

function closeEditor() {
  editor.value = undefined;
}

const trimmedShelf =
  computed(() => shelf.value.trim());

const trimmedLevel =
  computed(() => level.value.trim() || null);

const preview =
  computed(() =>
    trimmedShelf.value
      ? locationLabel(trimmedShelf.value, trimmedLevel.value)
      : ""
  );

const changed =
  computed(() => {
    if (!editor.value) {
      return false;
    }

    const location =
      editor.value.location;

    return location
      ? trimmedShelf.value !== location.shelf || trimmedLevel.value !== location.level
      : trimmedShelf.value !== "" || trimmedLevel.value !== null;
  });

const duplicate =
  computed(() =>
    props.cellar.locations.find(
      location =>
        location.id !== editor.value?.location?.id &&
        fold(location.shelf) === fold(trimmedShelf.value) &&
        fold(location.level ?? "") === fold(trimmedLevel.value ?? "")
    ) ?? null
  );

const formError =
  computed(() => {
    if (!trimmedShelf.value) {
      return "Enter a shelf.";
    }

    if (trimmedShelf.value.length > LOCATION_SHELF_MAX_LENGTH) {
      return `Shelf: at most ${LOCATION_SHELF_MAX_LENGTH} characters.`;
    }

    if ((trimmedLevel.value ?? "").length > LOCATION_LEVEL_MAX_LENGTH) {
      return `Level: at most ${LOCATION_LEVEL_MAX_LENGTH} characters.`;
    }

    return duplicate.value
      ? `${duplicate.value.label} already exists.`
      : "";
  });

/* Emplacement modifié encore en attente (ici ou sur un autre appareil). */
const editorPending =
  computed(() => {
    const location =
      editor.value?.location;

    return !!location && props.events.isLocationPending(location.id);
  });

const canSave =
  computed(() =>
    changed.value &&
    !formError.value &&
    !editorPending.value
  );

function save() {
  if (!editor.value || !canSave.value) {
    return;
  }

  props.events.saveLocation({
    locationId: editor.value.location?.id ?? null,
    shelf: trimmedShelf.value,
    level: trimmedLevel.value,
  });

  closeEditor();
}

async function remove(
  row: LocationRow
) {
  if (
    row.inStock + row.drunk > 0 ||
    !(await confirmDialog({
      title: `Delete ${row.location.label}?`,
      confirmLabel: "Delete",
      destructive: true,
    }))
  ) {
    return;
  }

  props.events.deleteLocation(row.location.id);
}

function deleteTitle(
  row: LocationRow
): string | undefined {
  return row.inStock + row.drunk > 0
    ? "Move its wines first (drunk wines included)"
    : undefined;
}

/* =========================
   Fermeture
========================= */

const message =
  computed(() =>
    props.events.concernsLocations.value
      ? props.events.message.value
      : ""
  );

async function close() {
  if (
    changed.value &&
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
    aria-label="Locations"
  >
    <header class="sheet-header">
      <div>
        <h2>Locations</h2>

        <div class="sheet-subtitle">
          {{ rows.length }} location{{ rows.length === 1 ? "" : "s" }}
        </div>
      </div>

      <div class="header-actions">
        <PillButton
          :disabled="!!editor"
          @click="openEditor(null)"
        >
          New location
        </PillButton>

        <button
          type="button"
          class="close-btn"
          aria-label="Close"
          @click="close"
        >
          ✕
        </button>
      </div>
    </header>

    <form
      v-if="editor"
      class="editor"
      @submit.prevent="save"
    >
      <div class="editor-line">
        <label class="field">
          <span class="field-label">Shelf</span>

          <input
            v-model="shelf"
            type="text"
            :maxlength="LOCATION_SHELF_MAX_LENGTH"
            autocomplete="off"
            placeholder="EC, Caisse…"
          />
        </label>

        <label class="field level">
          <span class="field-label">Level (optional)</span>

          <input
            v-model="level"
            type="text"
            :maxlength="LOCATION_LEVEL_MAX_LENGTH"
            autocomplete="off"
            placeholder="6, bas…"
          />
        </label>

        <span
          v-if="preview"
          class="preview"
        >
          Label: <strong>{{ preview }}</strong>
        </span>
      </div>

      <p
        v-if="changed && formError"
        class="error"
      >
        {{ formError }}
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
          {{ editor.location ? "Save" : "Create" }}
        </PillButton>
      </div>
    </form>

    <p
      v-if="!rows.length"
      class="note"
    >
      No location yet.
    </p>

    <div
      v-else
      class="table-wrapper"
    >
      <table class="locations-table">
        <thead>
          <tr>
            <th>Label</th>
            <th>Shelf</th>
            <th>Level</th>
            <th class="col-number">In stock</th>
            <th class="col-number">Drunk</th>
            <th class="col-actions"></th>
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="row in rows"
            :key="row.location.id"
            :class="{ editing: editor?.location?.id === row.location.id }"
          >
            <td class="col-label">
              {{ row.location.label }}

              <StatusPill
                v-if="events.isLocationPending(row.location.id)"
                class="pending-pill"
                tone="warning"
              >
                Pending
              </StatusPill>
            </td>

            <td class="soft">{{ row.location.shelf }}</td>
            <td class="soft">{{ row.location.level ?? "" }}</td>
            <td class="col-number">{{ row.inStock || "" }}</td>
            <td class="col-number soft">{{ row.drunk || "" }}</td>

            <td class="col-actions">
              <PillButton
                class="small-button"
                :disabled="!!editor || events.isLocationPending(row.location.id)"
                @click="openEditor(row.location)"
              >
                Edit
              </PillButton>

              <PillButton
                class="small-button"
                variant="danger"
                :title="deleteTitle(row)"
                :disabled="
                  !!editor ||
                  row.inStock + row.drunk > 0 ||
                  events.isLocationPending(row.location.id)
                "
                @click="remove(row)"
              >
                Delete
              </PillButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p
      v-if="withoutLocation"
      class="note"
    >
      {{ withoutLocation }} wine{{ withoutLocation === 1 ? "" : "s" }} in stock without location.
    </p>

    <footer
      v-if="message"
      class="sheet-footer"
    >
      <span
        class="request-message"
        :class="events.messageTone.value"
      >
        {{ message }}
      </span>
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
  box-sizing: border-box;

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

.header-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 0.5rem;
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
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

.field input {
  box-sizing: border-box;
  width: 12rem;

  padding: 6px 10px;

  border: 1px solid var(--input-border);
  border-radius: 8px;

  background: var(--surface);
  color: var(--text);

  font: inherit;
  font-size: var(--font-size-sm);
}

.field.level input {
  width: 8rem;
}

.preview {
  padding-bottom: 7px;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

.preview strong {
  color: var(--text);
}

.editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

/* =========================
   Table
========================= */

.table-wrapper {
  max-height: 55vh;
  overflow: auto;
}

.locations-table {
  width: 100%;

  border-collapse: collapse;

  font-size: var(--font-size-sm);
}

.locations-table th {
  position: sticky;
  top: 0;
  z-index: 1;

  padding: 6px 8px;

  border-bottom: 1px solid var(--border);

  background: var(--surface);
  color: var(--text-soft);
  font-weight: 700;
  text-align: left;
  white-space: nowrap;
}

.locations-table td {
  padding: 5px 8px;

  border-bottom: 1px solid var(--border);

  vertical-align: middle;
}

.locations-table tr.editing td {
  background: var(--primary-soft);
}

.col-label {
  font-weight: 600;
}

.col-number {
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}

.locations-table th.col-number {
  text-align: right;
}

.col-actions {
  width: 1%;
  white-space: nowrap;
}

.col-actions > * + * {
  margin-left: 4px;
}

.soft {
  color: var(--text-soft);
}

.small-button {
  padding: 2px 10px;

  font-size: var(--font-size-xs);
}

.pending-pill {
  margin-left: 0.5rem;

  vertical-align: middle;
}

/* =========================
   Footer
========================= */

.sheet-footer {
  padding-top: 10px;

  border-top: 1px solid var(--border);

  font-size: var(--font-size-sm);
}

.request-message {
  color: var(--text-soft);
}

.request-message.completed {
  color: var(--positive);
}

.request-message.error {
  color: var(--negative);
}
</style>
