<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from "vue";

import PillButton from "@/components/ui/PillButton.vue";
import SegmentedControl from "@/components/ui/SegmentedControl.vue";
import StatusPill from "@/components/ui/StatusPill.vue";

import {
  BOTTLE_SIZE_FACTOR_MAX,
  BOTTLE_SIZE_SORT_ORDER_MAX,
  LOCATION_LEVEL_COUNT_MAX,
  REFERENCE_NAME_MAX_LENGTH,
  type WineCellarData,
  type WineCellarV2,
  type WineReferenceKind,
  type WineReferenceSave,
} from "@/contracts/wineCellar";

import { useWineEvents } from "@/composables/wineCellar/useWineEvents";
import { usePersistentRef } from "@/composables/usePersistentRef";

import { confirmDialog } from "@/services/dialog/appDialog";

import { formatInteger } from "@/utils/amountFormat";

/* =========================
   Section « Wine » de la page Master data

   Données de base de la cave (cellar.json version 2,
   ../Backend/docs/wine-cellar-contract.md, § 1 et § 3) :
   pays, régions (groupées par pays), producteurs,
   emplacements et tailles de bouteille, chacun avec son
   nombre de vins (calculé à partir de wines ; pour un pays,
   aussi ses régions).

   Actions (WINE_REFERENCE_SAVED, _DELETED) :
   - créer et renommer ; région : changer de pays ;
     emplacement : nombre d'étages ; taille : facteur et
     ordre ;
   - supprimer, désactivé tant que l'élément est utilisé.
   Pas de fusion : un doublon se corrige en changeant la
   référence des vins depuis leur fiche, puis en supprimant
   l'élément devenu inutilisé.
   Contrôles identiques aux refus du contrat ; le Mac reste
   juge et son message est affiché tel quel. Élément en
   attente marqué « Pending », ses actions désactivées.

   Version 1 du fichier (backend pas encore basculé) :
   « Waiting for backend update », aucune action.
========================= */

const props = defineProps<{
  cellar: WineCellarData;
}>();

const events =
  useWineEvents();

const kindOptions: { value: WineReferenceKind; label: string }[] = [
  { value: "country", label: "Countries" },
  { value: "region", label: "Regions" },
  { value: "winery", label: "Wineries" },
  { value: "location", label: "Locations" },
  { value: "bottleSize", label: "Bottle sizes" },
];

const KIND_NOUNS: Record<WineReferenceKind, string> = {
  country: "country",
  region: "region",
  winery: "winery",
  location: "location",
  bottleSize: "bottle size",
};

const kind =
  usePersistentRef<WineReferenceKind>("masterData.wine.kind", "country");

if (!kindOptions.some(option => option.value === kind.value)) {
  kind.value = "country";
}

const v2 =
  computed<WineCellarV2 | null>(() =>
    props.cellar.version === 2
      ? props.cellar
      : null
  );

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

function plural(
  count: number,
  word: string
): string {
  return `${formatInteger(count)} ${word}${count === 1 ? "" : "s"}`;
}

/* =========================
   Lignes
========================= */

interface ReferenceRow {
  id: number;
  name: string;
  wines: number;

  /* Pays : nombre de régions. */
  regions: number;

  /* Région : pays ; premier de son groupe : nom du pays à afficher. */
  countryId: number | null;
  groupLabel: string | null;

  /* Emplacement : étages, et plus haut étage utilisé par un vin. */
  levelCount: number | null;
  highestLevelUsed: number;

  /* Taille. */
  factor: number | null;
  sortOrder: number | null;
}

function count<K extends number | null>(
  keys: K[]
): Map<K, number> {
  const counts =
    new Map<K, number>();

  for (const key of keys) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

function emptyRow(
  id: number,
  name: string,
  wines: number
): ReferenceRow {
  return {
    id,
    name,
    wines,
    regions: 0,
    countryId: null,
    groupLabel: null,
    levelCount: null,
    highestLevelUsed: 0,
    factor: null,
    sortOrder: null,
  };
}

const countryNames =
  computed(() =>
    new Map((v2.value?.countries ?? []).map(country => [country.id, country.name]))
  );

const rows =
  computed<ReferenceRow[]>(() => {
    const data =
      v2.value;

    if (!data) {
      return [];
    }

    const wines =
      data.wines;

    switch (kind.value) {
      case "country": {
        const used =
          count(wines.map(wine => wine.countryId));

        const regions =
          count(data.regions.map(region => region.countryId));

        return data.countries.map(country => ({
          ...emptyRow(country.id, country.name, used.get(country.id) ?? 0),
          regions: regions.get(country.id) ?? 0,
        }));
      }

      case "region": {
        const used =
          count(wines.map(wine => wine.regionId));

        return data.regions.map((region, index) => ({
          ...emptyRow(region.id, region.name, used.get(region.id) ?? 0),
          countryId: region.countryId,
          groupLabel:
            index === 0 || data.regions[index - 1].countryId !== region.countryId
              ? (region.countryId === null
                  ? "No country"
                  : countryNames.value.get(region.countryId) ?? `Country ${region.countryId}`)
              : null,
        }));
      }

      case "winery": {
        const used =
          count(wines.map(wine => wine.wineryId));

        return data.wineries.map(winery =>
          emptyRow(winery.id, winery.name, used.get(winery.id) ?? 0)
        );
      }

      case "location": {
        const used =
          count(wines.map(wine => wine.locationId));

        return data.locations.map(location => ({
          ...emptyRow(location.id, location.name, used.get(location.id) ?? 0),
          levelCount: location.levelCount,
          highestLevelUsed: Math.max(
            0,
            ...wines
              .filter(wine => wine.locationId === location.id)
              .map(wine => wine.locationLevel ?? 0)
          ),
        }));
      }

      case "bottleSize": {
        const used =
          count(wines.map(wine => wine.bottleSizeId));

        return data.bottleSizes.map(size => ({
          ...emptyRow(size.id, size.name, used.get(size.id) ?? 0),
          factor: size.factor,
          sortOrder: size.sortOrder,
        }));
      }
    }
  });

function isUsed(
  row: ReferenceRow
): boolean {
  return row.wines > 0 || row.regions > 0;
}

function usageText(
  row: ReferenceRow
): string {
  return [
    row.wines ? plural(row.wines, "wine") : "",
    row.regions ? plural(row.regions, "region") : "",
  ]
    .filter(Boolean)
    .join(" and ");
}

function pending(
  row: ReferenceRow
): boolean {
  return events.isReferencePending(kind.value, row.id);
}

/* =========================
   Saisie (création, modification)

   undefined : aucune ; row null : création.
========================= */

const editor =
  ref<{ row: ReferenceRow | null } | undefined>(undefined);

const nameText = ref("");
const countryId = ref<number | null>(null);
const levelCountText = ref("");
const factorText = ref("");
const sortOrderText = ref("");

function text(
  value: number | null
): string {
  return value === null ? "" : String(value);
}

/* Ordre proposé pour une nouvelle taille : 10 après le dernier. */
function nextSortOrder(): number {
  return Math.min(
    BOTTLE_SIZE_SORT_ORDER_MAX,
    Math.max(0, ...rows.value.map(row => row.sortOrder ?? 0)) + 10
  );
}

function openEditor(
  row: ReferenceRow | null
) {
  editor.value = { row };
  nameText.value = row?.name ?? "";
  countryId.value = row?.countryId ?? v2.value?.countries[0]?.id ?? null;
  levelCountText.value = text(row?.levelCount ?? null);
  factorText.value = row ? text(row.factor) : "1";
  sortOrderText.value = row ? text(row.sortOrder) : String(nextSortOrder());
}

function closeEditor() {
  editor.value = undefined;
}

/* Autre type choisi : saisie abandonnée. */
watch(
  kind,

  () => {
    closeEditor();
  }
);

const INTEGER =
  /^\d+$/;

const DECIMAL =
  /^\d+(?:[.,]\d{1,2})?$/;

/* Nombre d'étages : null si vide, NaN si invalide. */
const levelCount =
  computed(() => {
    const value =
      levelCountText.value.trim();

    if (!value) {
      return null;
    }

    const number =
      INTEGER.test(value) ? Number(value) : NaN;

    return number >= 1 && number <= LOCATION_LEVEL_COUNT_MAX ? number : NaN;
  });

const factor =
  computed(() => {
    const value =
      factorText.value.trim();

    const number =
      DECIMAL.test(value) ? Number(value.replace(",", ".")) : NaN;

    return number > 0 && number <= BOTTLE_SIZE_FACTOR_MAX ? number : NaN;
  });

const sortOrder =
  computed(() => {
    const value =
      sortOrderText.value.trim();

    const number =
      INTEGER.test(value) ? Number(value) : NaN;

    return number <= BOTTLE_SIZE_SORT_ORDER_MAX ? number : NaN;
  });

const trimmedName =
  computed(() => nameText.value.trim());

/* Élément du même type qui porte déjà ce nom (région : dans le pays choisi). */
const duplicate =
  computed(() =>
    rows.value.find(
      row =>
        row.id !== editor.value?.row?.id &&
        fold(row.name) === fold(trimmedName.value) &&
        (kind.value !== "region" || row.countryId === countryId.value)
    ) ?? null
  );

const formError =
  computed(() => {
    const row =
      editor.value?.row ?? null;

    const max =
      REFERENCE_NAME_MAX_LENGTH[kind.value];

    if (!trimmedName.value) {
      return "Enter a name.";
    }

    if (trimmedName.value.length > max) {
      return `Name: at most ${max} characters.`;
    }

    if (kind.value === "region" && countryId.value === null) {
      return "Choose a country.";
    }

    if (duplicate.value) {
      return `"${duplicate.value.name}" already exists.`;
    }

    if (kind.value === "location") {
      if (Number.isNaN(levelCount.value)) {
        return `Levels: a whole number from 1 to ${LOCATION_LEVEL_COUNT_MAX}, or empty.`;
      }

      if (row && row.highestLevelUsed > (levelCount.value ?? 0)) {
        return `Level ${row.highestLevelUsed} is used by a wine: keep at least ${row.highestLevelUsed} levels.`;
      }
    }

    if (kind.value === "bottleSize") {
      if (Number.isNaN(factor.value)) {
        return "Factor: a positive number (up to 2 decimals), 1 = 75 cl.";
      }

      if (Number.isNaN(sortOrder.value)) {
        return `Order: a whole number from 0 to ${BOTTLE_SIZE_SORT_ORDER_MAX}.`;
      }
    }

    return "";
  });

const payload =
  computed<WineReferenceSave>(() => {
    const base =
      {
        kind: kind.value,
        id: editor.value?.row?.id ?? null,
        name: trimmedName.value,
      };

    switch (kind.value) {
      case "region":
        return { ...base, countryId: countryId.value ?? 0 };

      case "location":
        return { ...base, levelCount: levelCount.value };

      case "bottleSize":
        return { ...base, factor: factor.value, sortOrder: sortOrder.value };

      default:
        return base;
    }
  });

const changed =
  computed(() => {
    const row =
      editor.value?.row;

    if (!editor.value) {
      return false;
    }

    if (!row) {
      return trimmedName.value !== "";
    }

    return (
      trimmedName.value !== row.name ||
      (kind.value === "region" && countryId.value !== row.countryId) ||
      (kind.value === "location" && levelCount.value !== row.levelCount) ||
      (kind.value === "bottleSize" &&
        (factor.value !== row.factor || sortOrder.value !== row.sortOrder))
    );
  });

const editorPending =
  computed(() => {
    const row =
      editor.value?.row;

    return !!row && pending(row);
  });

const canSave =
  computed(() =>
    changed.value &&
    !formError.value &&
    !editorPending.value
  );

/* Région changée de pays : ses vins suivent. */
const moveNote =
  computed(() => {
    const row =
      editor.value?.row;

    return kind.value === "region" && row && row.countryId !== countryId.value && row.wines
      ? `Its ${plural(row.wines, "wine")} will move to this country.`
      : "";
  });

function save() {
  if (!canSave.value) {
    return;
  }

  events.saveReference(payload.value);

  closeEditor();
}

/* =========================
   Suppression
========================= */

async function remove(
  row: ReferenceRow
) {
  if (
    isUsed(row) ||
    !(await confirmDialog({
      title: `Delete ${row.name}?`,
      confirmLabel: "Delete",
      destructive: true,
    }))
  ) {
    return;
  }

  events.deleteReference(kind.value, row.id);
}

/* =========================
   Affichage
========================= */

const message =
  computed(() =>
    events.concernsReferences.value
      ? events.message.value
      : ""
  );

const noun =
  computed(() => KIND_NOUNS[kind.value]);

const columnCount =
  computed(() =>
    kind.value === "bottleSize"
      ? 5
      : kind.value === "country" || kind.value === "location"
        ? 4
        : 3
  );
</script>

<template>
  <section class="panel">
    <p
      v-if="!v2"
      class="empty"
    >
      Waiting for backend update.
    </p>

    <template v-else>
      <header class="panel-header">
        <SegmentedControl
          v-model="kind"
          :options="kindOptions"
        />

        <PillButton
          :disabled="!!editor"
          @click="openEditor(null)"
        >
          New {{ noun }}
        </PillButton>
      </header>

      <p
        v-if="message"
        class="request-message"
        :class="events.messageTone.value"
      >
        {{ message }}
      </p>

      <form
        v-if="editor"
        class="editor"
        @submit.prevent="save"
      >
        <div class="editor-line">
          <label class="field">
            <span class="field-label">Name</span>

            <input
              v-model="nameText"
              type="text"
              :maxlength="REFERENCE_NAME_MAX_LENGTH[kind]"
              autocomplete="off"
            />
          </label>

          <label
            v-if="kind === 'region'"
            class="field"
          >
            <span class="field-label">Country</span>

            <select v-model="countryId">
              <option
                v-for="country in v2.countries"
                :key="country.id"
                :value="country.id"
              >
                {{ country.name }}
              </option>
            </select>
          </label>

          <label
            v-if="kind === 'location'"
            class="field short"
          >
            <span class="field-label">Levels (optional)</span>

            <input
              v-model="levelCountText"
              type="text"
              inputmode="numeric"
              autocomplete="off"
              placeholder="None"
            />
          </label>

          <template v-if="kind === 'bottleSize'">
            <label class="field short">
              <span class="field-label">Factor (× 75 cl)</span>

              <input
                v-model="factorText"
                type="text"
                inputmode="decimal"
                autocomplete="off"
              />
            </label>

            <label class="field short">
              <span class="field-label">Order</span>

              <input
                v-model="sortOrderText"
                type="text"
                inputmode="numeric"
                autocomplete="off"
              />
            </label>
          </template>
        </div>

        <p
          v-if="kind === 'location'"
          class="note"
        >
          Level 1 is the top level. A wine's level is chosen on its sheet.
        </p>

        <p
          v-if="moveNote"
          class="note"
        >
          {{ moveNote }}
        </p>

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
            {{ editor.row ? "Save" : "Create" }}
          </PillButton>
        </div>
      </form>

      <p
        v-if="!rows.length"
        class="empty"
      >
        No {{ noun }} yet.
      </p>

      <div
        v-else
        class="table-wrapper"
      >
        <table class="references-table">
          <thead>
            <tr>
              <th>Name</th>
              <th
                v-if="kind === 'location'"
                class="col-number"
              >
                Levels
              </th>
              <template v-if="kind === 'bottleSize'">
                <th class="col-number">Factor</th>
                <th class="col-number">Order</th>
              </template>
              <th
                v-if="kind === 'country'"
                class="col-number"
              >
                Regions
              </th>
              <th class="col-number">Wines</th>
              <th class="col-actions"></th>
            </tr>
          </thead>

          <tbody>
            <template
              v-for="row in rows"
              :key="row.id"
            >
              <tr
                v-if="row.groupLabel"
                class="group-row"
              >
                <td :colspan="columnCount">{{ row.groupLabel }}</td>
              </tr>

              <tr
                :class="{
                  editing: editor?.row?.id === row.id,
                }"
              >
                <td class="col-name">
                  {{ row.name }}

                  <StatusPill
                    v-if="pending(row)"
                    class="pending-pill"
                    tone="warning"
                  >
                    Pending
                  </StatusPill>
                </td>

                <td
                  v-if="kind === 'location'"
                  class="col-number"
                >
                  {{ row.levelCount ?? "" }}
                </td>

                <template v-if="kind === 'bottleSize'">
                  <td class="col-number">× {{ row.factor ?? "?" }}</td>
                  <td class="col-number soft">{{ row.sortOrder ?? "" }}</td>
                </template>

                <td
                  v-if="kind === 'country'"
                  class="col-number"
                >
                  {{ row.regions || "" }}
                </td>

                <td class="col-number">{{ row.wines || "" }}</td>

                <td class="col-actions">
                  <PillButton
                    class="small-button"
                    :disabled="!!editor || pending(row)"
                    @click="openEditor(row)"
                  >
                    Edit
                  </PillButton>

                  <PillButton
                    class="small-button"
                    variant="danger"
                    :title="isUsed(row) ? `Used by ${usageText(row)}` : undefined"
                    :disabled="!!editor || isUsed(row) || pending(row)"
                    @click="remove(row)"
                  >
                    Delete
                  </PillButton>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 0;

  padding: 12px 14px;

  border: 1px solid var(--border);
  border-radius: 12px;

  background: var(--surface);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  min-width: 0;
}

.empty,
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

.request-message {
  margin: 0;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

.request-message.completed {
  color: var(--positive);
}

.request-message.error {
  color: var(--negative);
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

.field input,
.field select {
  box-sizing: border-box;
  width: 16rem;
  max-width: 100%;

  padding: 6px 10px;

  border: 1px solid var(--input-border);
  border-radius: 8px;

  background: var(--surface);
  color: var(--text);

  font: inherit;
  font-size: var(--font-size-sm);
}

.field.short input {
  width: 8rem;
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
  max-height: 65vh;
  overflow: auto;
}

.references-table {
  width: 100%;

  border-collapse: collapse;

  font-size: var(--font-size-sm);
}

.references-table th {
  position: sticky;
  top: 0;
  z-index: 1;

  padding: 6px 10px;

  border-bottom: 1px solid var(--border);

  background: var(--surface);
  color: var(--text-soft);
  font-weight: 700;
  text-align: left;
  white-space: nowrap;
}

.references-table td {
  padding: 5px 10px;

  border-bottom: 1px solid var(--border);

  vertical-align: middle;
}

.references-table tr.editing td {
  background: var(--primary-soft);
}

.group-row td {
  padding-top: 12px;

  background: var(--bg-soft);
  color: var(--text-soft);
  font-weight: 700;
}

.col-name {
  font-weight: 600;
  overflow-wrap: anywhere;
}

.col-number {
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}

.references-table th.col-number {
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
</style>
