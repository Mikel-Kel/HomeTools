<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";

import PillButton from "@/components/ui/PillButton.vue";
import SuggestInput from "@/components/ui/SuggestInput.vue";
import WinePhoto from "@/components/wineCellar/WinePhoto.vue";

import {
  WINE_COLORS,
  WINE_COUNTRY_MAX_LENGTH,
  WINE_NAME_MAX_LENGTH,
  WINE_REGION_MAX_LENGTH,
  WINE_WINERY_MAX_LENGTH,
  WINE_YEAR_MAX,
  WINE_YEAR_MIN,
  type Wine,
  type WineCellarData,
  type WinePhotoSave,
  type WineReference,
  type WineSave,
  type WineSaveV2,
} from "@/contracts/wineCellar";

import type { WineEvents } from "@/composables/wineCellar/useWineEvents";
import { useWinePhotoDraft } from "@/composables/wineCellar/useWinePhotoDraft";

import { confirmDialog } from "@/services/dialog/appDialog";

import {
  CREATED_ON_SERVER,
  waitingElsewhereMessage,
} from "@/services/events/requestMessages";

/* =========================
   Création et modification d'un vin

   Contrat : ../Backend/docs/wine-cellar-contract.md, § 3
   (WINE_SAVED). Tous les champs de la fiche, commentaires
   compris ; pays, région et producteur en saisie libre avec
   les valeurs déjà présentes dans la cave en suggestion ;
   emplacement choisi dans locations.

   Contrôles identiques aux refus du contrat (le Mac reste
   juge). Création : quantité initiale, et un nom déjà
   présent dans la cave (vin bu ou non) reprend pays,
   région, couleur et producteur de son dernier millésime,
   dans les champs encore vides ; modification : le
   stock ne change que par +/- ou une correction (quantity
   envoyé tel quel, ignoré par le Mac).

   « Delete » (modification seulement) : WINE_DELETED après
   une confirmation qui chiffre les pertes ; un vin bu reste
   normalement dans l'historique, la suppression sert aux
   erreurs de saisie.

   Version 2 de cellar.json : WINE_SAVED version 2. Pays,
   région et producteur suggérés depuis les listes de
   référence (régions du pays saisi seulement) et envoyés
   comme références ({ id } si le nom existe, au sens de la
   collation ; { id: null, name } sinon) ; taille obligatoire
   (bouteille de 75 cl par défaut) ; étage parmi les
   levelCount étages de l'emplacement (1 en haut).
   Photo à la création (W7, § 3) : par défaut, celle du
   dernier millésime du même nom qui en a une (copyFrom),
   remplaçable par une image choisie (préparée, envoyée dans
   photo.image) ou retirée (« No photo »). La photo d'un vin
   existant se gère dans sa fiche. Version 1 :
   fiche de W4, pays, région et producteur en texte.

   La fiche se ferme à l'envoi : suivi (« Pending », statut)
   dans la fiche du vin ou au-dessus de la liste.
========================= */

const props = defineProps<{
  /* null : nouveau vin. */
  wine: Wine | null;
  cellar: WineCellarData;
  events: WineEvents;
}>();

const emit = defineEmits<{
  close: [];
}>();

const isNew =
  props.wine === null;

/* Fichier en version 2 : listes de référence, sinon null. */
const v2 =
  props.cellar.version === 2
    ? props.cellar
    : null;

/* Comparaison MySQL utf8mb4_unicode_ci : casse, accents et espaces ignorés. */
function fold(
  value: string
): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/* Taille par défaut : la bouteille de 75 cl (facteur 1), sinon la première. */
function defaultBottleSizeId(): number | null {
  if (!v2) {
    return null;
  }

  return (
    v2.bottleSizes.find(size => size.factor === 1) ??
    v2.bottleSizes[0]
  )?.id ?? null;
}

/* =========================
   Saisie (textes, convertis à l'envoi)
========================= */

function text(
  value: string | number | null | undefined
): string {
  return value === null || value === undefined
    ? ""
    : String(value);
}

const name = ref(props.wine?.name ?? "");
const vintage = ref(text(props.wine?.vintage));
const country = ref(props.wine?.country ?? "");
const region = ref(props.wine?.region ?? "");
const color = ref(props.wine?.color ?? "");
const winery = ref(props.wine?.winery ?? "");
const locationId = ref<number | null>(props.wine?.locationId ?? null);
const price = ref(text(props.wine?.priceChf));
const favorite = ref(props.wine?.favorite ?? false);
const drinkBefore = ref(text(props.wine?.drinkBefore));
const holdUntil = ref(text(props.wine?.holdUntil));
const purchasedAt = ref(props.wine?.purchasedAt ?? "");
const comments = ref(props.wine?.comments ?? "");
const quantity = ref(isNew ? "0" : text(props.wine?.quantity));
const bottleSizeId = ref<number | null>(props.wine?.bottleSizeId ?? defaultBottleSizeId());
const locationLevel = ref<number | null>(props.wine?.locationLevel ?? null);

/* Étages de l'emplacement choisi (version 2), 1 en haut ; [] sans étages. */
const levelOptions =
  computed(() => {
    const count =
      v2?.locations.find(location => location.id === locationId.value)?.levelCount ?? 0;

    return Array.from({ length: count }, (_, index) => index + 1);
  });

/* Emplacement changé : étage retiré s'il n'existe pas dans le nouveau. */
watch(
  levelOptions,

  options => {
    if (locationLevel.value !== null && !options.includes(locationLevel.value)) {
      locationLevel.value = null;
    }
  }
);

/* Couleur importée hors de la liste : gardée dans le choix pour ne pas la perdre en silence. */
const colorOptions =
  computed(() =>
    color.value && !(WINE_COLORS as readonly string[]).includes(color.value)
      ? [...WINE_COLORS, color.value]
      : [...WINE_COLORS]
  );

/* =========================
   Suggestions
========================= */

function distinct(
  values: (string | null)[]
): string[] {
  return [...new Set(values.filter((value): value is string => value !== null))]
    .sort((a, b) => a.localeCompare(b));
}

/* Version 2 : pays de la liste dont le nom correspond au texte saisi. */
const matchedCountry =
  computed(() => {
    const typed =
      fold(country.value);

    return typed
      ? v2?.countries.find(item => fold(item.name) === typed) ?? null
      : null;
  });

const countrySuggestions =
  computed(() =>
    v2
      ? v2.countries.map(item => item.name)
      : distinct(props.cellar.wines.map(wine => wine.country))
  );

/*
  Version 2 : régions du pays saisi, aucune pour un pays
  nouveau ou vide. Version 1 : régions du pays saisi s'il
  est connu, sinon toutes.
*/
const regionSuggestions =
  computed(() => {
    if (v2) {
      const countryId =
        matchedCountry.value?.id;

      return countryId === undefined
        ? []
        : v2.regions
            .filter(item => item.countryId === countryId)
            .map(item => item.name);
    }

    const typed =
      country.value.trim().toLowerCase();

    const wines =
      props.cellar.wines.filter(
        wine => wine.country?.toLowerCase() === typed
      );

    return distinct(
      (wines.length ? wines : props.cellar.wines).map(wine => wine.region)
    );
  });

const winerySuggestions =
  computed(() =>
    v2
      ? v2.wineries.map(item => item.name)
      : distinct(props.cellar.wines.map(wine => wine.winery))
  );

const nameSuggestions =
  computed(() =>
    distinct(props.cellar.wines.map(wine => wine.name))
  );

/* =========================
   Création : reprise d'un vin du même nom
========================= */

/* Vin du même nom, dernier millésime (sans millésime en dernier), puis le plus récent saisi. */
const sameNameWine =
  computed(() => {
    const typed =
      fold(name.value);

    if (!isNew || !typed) {
      return null;
    }

    return props.cellar.wines
      .filter(wine => fold(wine.name) === typed)
      .sort(
        (a, b) =>
          (b.vintage ?? -Infinity) - (a.vintage ?? -Infinity) ||
          b.id - a.id
      )[0] ?? null;
  });

const copiedFrom =
  ref<Wine | null>(null);

watch(
  sameNameWine,

  source => {
    if (!source) {
      return;
    }

    country.value ||= source.country ?? "";
    region.value ||= source.region ?? "";
    color.value ||= source.color ?? "";
    winery.value ||= source.winery ?? "";

    copiedFrom.value = source;
  }
);

/* =========================
   Création : photo (version 2)
========================= */

const photoDraft =
  useWinePhotoDraft();

const photoInput =
  ref<HTMLInputElement | null>(null);

/* Héritage : dernier millésime du même nom (vin bu ou non) qui a une photo. */
const photoSource =
  computed(() => {
    const typed =
      fold(name.value);

    if (!isNew || !v2 || !typed) {
      return null;
    }

    return props.cellar.wines
      .filter(wine => wine.photo && fold(wine.name) === typed)
      .sort(
        (a, b) =>
          (b.vintage ?? -Infinity) - (a.vintage ?? -Infinity) ||
          b.id - a.id
      )[0] ?? null;
  });

/* false : « No photo » choisi, l'héritage n'est pas repris. */
const inheritPhoto =
  ref(true);

const inheritedFrom =
  computed(() =>
    !photoDraft.draft.value && inheritPhoto.value
      ? photoSource.value
      : null
  );

function wineLabel(
  wine: Wine
): string {
  return wine.vintage ? `${wine.name} ${wine.vintage}` : wine.name;
}

function choosePhoto() {
  photoInput.value?.click();
}

function noPhoto() {
  photoDraft.clear();
  inheritPhoto.value = false;
}

function useInheritedPhoto() {
  photoDraft.clear();
  inheritPhoto.value = true;
}

/* Champ photo de WINE_SAVED, ajouté à l'envoi (image trop lourde pour la détection des changements). */
function photoPayload(): WinePhotoSave | undefined {
  const draft =
    photoDraft.draft.value;

  if (draft) {
    return { image: draft.image };
  }

  return inheritedFrom.value
    ? { copyFrom: inheritedFrom.value.id }
    : undefined;
}

/* =========================
   Contrôles
========================= */

const INTEGER =
  /^\d+$/;

const PRICE =
  /^\d+(?:[.,]\d{1,2})?$/;

const DATE =
  /^\d{4}-\d{2}-\d{2}$/;

/* Texte facultatif : vide = null. */
function optionalText(
  value: string
): string | null {
  return value.trim() || null;
}

/* Année facultative : null si vide, NaN si invalide. */
function parseYear(
  value: string
): number | null {
  const trimmed =
    value.trim();

  if (!trimmed) {
    return null;
  }

  const year =
    INTEGER.test(trimmed) ? Number(trimmed) : NaN;

  return year >= WINE_YEAR_MIN && year <= WINE_YEAR_MAX
    ? year
    : NaN;
}

function parsePrice(
  value: string
): number | null {
  const trimmed =
    value.trim();

  if (!trimmed) {
    return null;
  }

  return PRICE.test(trimmed)
    ? Number(trimmed.replace(",", "."))
    : NaN;
}

function isValidDate(
  value: string
): boolean {
  if (!DATE.test(value)) {
    return false;
  }

  const [year, month, day] =
    value.split("-").map(Number);

  const date =
    new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function yearError(
  label: string,
  value: string
): string {
  return Number.isNaN(parseYear(value))
    ? `${label}: a year from ${WINE_YEAR_MIN} to ${WINE_YEAR_MAX}.`
    : "";
}

function lengthError(
  label: string,
  value: string,
  max: number
): string {
  return value.trim().length > max
    ? `${label}: at most ${max} characters.`
    : "";
}

const errors =
  computed(() =>
    [
      name.value.trim() ? "" : "Enter a name.",
      lengthError("Name", name.value, WINE_NAME_MAX_LENGTH),
      yearError("Vintage", vintage.value),
      lengthError("Country", country.value, WINE_COUNTRY_MAX_LENGTH),
      lengthError("Region", region.value, WINE_REGION_MAX_LENGTH),
      lengthError("Winery", winery.value, WINE_WINERY_MAX_LENGTH),
      Number.isNaN(parsePrice(price.value))
        ? "Price: a positive amount (up to 2 decimals)."
        : "",
      yearError("Drink before", drinkBefore.value),
      yearError("Hold until", holdUntil.value),
      purchasedAt.value && !isValidDate(purchasedAt.value)
        ? "Purchased: a valid date."
        : "",
      isNew && !INTEGER.test(quantity.value.trim())
        ? "Bottles: a whole number (0 or more)."
        : "",
      locationId.value !== null &&
      !props.cellar.locations.some(location => location.id === locationId.value)
        ? "Unknown location."
        : "",
      v2 && region.value.trim() && !country.value.trim()
        ? "Region: enter its country first."
        : "",
      v2 && !v2.bottleSizes.some(size => size.id === bottleSizeId.value)
        ? "Choose a bottle size."
        : "",
      locationLevel.value !== null && !levelOptions.value.includes(locationLevel.value)
        ? "Level: not a level of this location."
        : "",
    ].filter(Boolean)
  );

/* =========================
   Références (version 2)
========================= */

function reference(
  value: string,
  existing: { id: number; name: string }[]
): WineReference | null {
  const typed =
    value.trim();

  if (!typed) {
    return null;
  }

  const match =
    existing.find(item => fold(item.name) === fold(typed));

  return match
    ? { id: match.id }
    : { id: null, name: typed };
}

/* Région cherchée dans le pays saisi ; pays nouveau : région nouvelle. */
function regionReference(): WineReference | null {
  const countryId =
    matchedCountry.value?.id;

  return reference(
    region.value,
    countryId === undefined
      ? []
      : v2?.regions.filter(item => item.countryId === countryId) ?? []
  );
}

/* =========================
   Envoi
========================= */

const payloadV1 =
  computed<WineSave>(() => ({
    wineId: props.wine?.id ?? null,
    name: name.value.trim(),
    vintage: parseYear(vintage.value),
    country: optionalText(country.value),
    region: optionalText(region.value),
    color: color.value || null,
    winery: optionalText(winery.value),
    locationId: locationId.value,
    priceChf: parsePrice(price.value),
    favorite: favorite.value,
    drinkBefore: parseYear(drinkBefore.value),
    holdUntil: parseYear(holdUntil.value),
    purchasedAt: purchasedAt.value || null,
    comments: optionalText(comments.value),
    quantity: isNew ? Number(quantity.value.trim()) : props.wine?.quantity ?? 0,
  }));

const payloadV2 =
  computed<WineSaveV2>(() => ({
    wineId: props.wine?.id ?? null,
    name: name.value.trim(),
    vintage: parseYear(vintage.value),
    country: reference(country.value, v2?.countries ?? []),
    region: regionReference(),
    color: color.value || null,
    winery: reference(winery.value, v2?.wineries ?? []),
    bottleSizeId: bottleSizeId.value ?? 0,
    locationId: locationId.value,
    locationLevel: locationId.value === null ? null : locationLevel.value,
    priceChf: parsePrice(price.value),
    favorite: favorite.value,
    drinkBefore: parseYear(drinkBefore.value),
    holdUntil: parseYear(holdUntil.value),
    purchasedAt: purchasedAt.value || null,
    comments: optionalText(comments.value),
    quantity: isNew ? Number(quantity.value.trim()) : props.wine?.quantity ?? 0,
  }));

const payload =
  computed(() =>
    v2 ? payloadV2.value : payloadV1.value
  );

const initialPayload =
  JSON.stringify(payload.value);

const changed =
  computed(() =>
    JSON.stringify(payload.value) !== initialPayload ||
    photoDraft.draft.value !== null
  );

/* Modification de ce vin encore en attente (ici ou sur un autre appareil). */
const pending =
  computed(() =>
    !isNew && props.events.isWinePending(props.wine?.id ?? null)
  );

const canSave =
  computed(() =>
    changed.value &&
    !errors.value.length &&
    !pending.value &&
    !photoDraft.preparing.value
  );

function save() {
  if (!canSave.value) {
    return;
  }

  if (v2) {
    props.events.saveWineV2({
      ...payloadV2.value,
      photo: isNew ? photoPayload() : undefined,
    });
  } else {
    props.events.saveWine(payloadV1.value);
  }

  emit("close");
}

function plural(
  count: number,
  word: string
): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

async function remove() {
  const wine =
    props.wine;

  if (!wine || pending.value) {
    return;
  }

  const losses =
    [
      wine.quantity > 0 ? `${plural(wine.quantity, "bottle")} in stock` : "",
      wine.tastings.length ? plural(wine.tastings.length, "tasting") : "",
      "its stock log",
    ].filter(Boolean);

  const title =
    wine.vintage ? `${wine.name} ${wine.vintage}` : wine.name;

  if (
    !(await confirmDialog({
      title: `Delete ${title}?`,
      message:
        `Deleted for good, with ${losses.join(", ")}. ` +
        "A wine you drank normally stays in the history (0 bottles): " +
        "delete only a wine entered by mistake.",
      confirmLabel: "Delete",
      destructive: true,
    }))
  ) {
    return;
  }

  props.events.deleteWine(wine.id);

  emit("close");
}

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
    :aria-label="isNew ? 'New wine' : wine?.name"
  >
    <header class="sheet-header">
      <div>
        <h2>{{ isNew ? "New wine" : wine?.name }}</h2>

        <div class="sheet-subtitle">
          {{ isNew ? CREATED_ON_SERVER : `Wine ${wine?.id}` }}
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

    <div class="form">
      <label class="field wide">
        <span class="field-label">Name</span>

        <SuggestInput
          v-if="isNew"
          v-model="name"
          :suggestions="nameSuggestions"
          :maxlength="WINE_NAME_MAX_LENGTH"
        />

        <input
          v-else
          v-model="name"
          type="text"
          :maxlength="WINE_NAME_MAX_LENGTH"
          autocomplete="off"
        />
      </label>

      <label class="field">
        <span class="field-label">Vintage</span>

        <input
          v-model="vintage"
          type="text"
          inputmode="numeric"
          maxlength="4"
          autocomplete="off"
          placeholder="YYYY"
        />
      </label>

      <label class="field">
        <span class="field-label">Color</span>

        <select v-model="color">
          <option value="">—</option>

          <option
            v-for="option in colorOptions"
            :key="option"
            :value="option"
          >
            {{ option }}
          </option>
        </select>
      </label>

      <label
        v-if="v2"
        class="field"
      >
        <span class="field-label">Bottle size</span>

        <select v-model="bottleSizeId">
          <option
            v-for="size in v2.bottleSizes"
            :key="size.id"
            :value="size.id"
          >
            {{ size.name }}
          </option>
        </select>
      </label>

      <label class="field">
        <span class="field-label">Country</span>

        <SuggestInput
          v-model="country"
          :suggestions="countrySuggestions"
          :maxlength="WINE_COUNTRY_MAX_LENGTH"
        />
      </label>

      <label class="field">
        <span class="field-label">Region</span>

        <SuggestInput
          v-model="region"
          :suggestions="regionSuggestions"
          :maxlength="WINE_REGION_MAX_LENGTH"
        />
      </label>

      <label class="field wide">
        <span class="field-label">Winery</span>

        <SuggestInput
          v-model="winery"
          :suggestions="winerySuggestions"
          :maxlength="WINE_WINERY_MAX_LENGTH"
        />
      </label>

      <label class="field">
        <span class="field-label">Location</span>

        <select v-model="locationId">
          <option :value="null">—</option>

          <option
            v-for="location in cellar.locations"
            :key="location.id"
            :value="location.id"
          >
            {{ location.label }}
          </option>
        </select>
      </label>

      <label
        v-if="levelOptions.length"
        class="field"
      >
        <span class="field-label">Level (1 = top)</span>

        <select v-model="locationLevel">
          <option :value="null">—</option>

          <option
            v-for="level in levelOptions"
            :key="level"
            :value="level"
          >
            {{ level }}
          </option>
        </select>
      </label>

      <label class="field">
        <span class="field-label">Price (CHF)</span>

        <input
          v-model="price"
          type="text"
          inputmode="decimal"
          autocomplete="off"
        />
      </label>

      <label class="field">
        <span class="field-label">Drink before</span>

        <input
          v-model="drinkBefore"
          type="text"
          inputmode="numeric"
          maxlength="4"
          autocomplete="off"
          placeholder="YYYY"
        />
      </label>

      <label class="field">
        <span class="field-label">Hold until</span>

        <input
          v-model="holdUntil"
          type="text"
          inputmode="numeric"
          maxlength="4"
          autocomplete="off"
          placeholder="YYYY"
        />
      </label>

      <label class="field">
        <span class="field-label">Purchased</span>

        <input
          v-model="purchasedAt"
          type="date"
        />
      </label>

      <label
        v-if="isNew"
        class="field"
      >
        <span class="field-label">Bottles</span>

        <input
          v-model="quantity"
          type="text"
          inputmode="numeric"
          autocomplete="off"
        />
      </label>

      <label class="checkbox">
        <input
          v-model="favorite"
          type="checkbox"
        />
        ★ Favorite
      </label>

      <div
        v-if="isNew && v2"
        class="field full"
      >
        <span class="field-label">Photo</span>

        <div class="photo-field">
          <img
            v-if="photoDraft.draft.value"
            class="photo-preview"
            :src="photoDraft.draft.value.previewUrl"
            alt="New label"
            draggable="false"
          />

          <WinePhoto
            v-else
            :photo-key="inheritedFrom?.photo ?? null"
            size="thumb"
            class="edit-photo"
          />

          <div class="photo-side">
            <span class="photo-text">
              {{
                photoDraft.preparing.value
                  ? "Preparing the image…"
                  : photoDraft.draft.value
                    ? "New photo"
                    : inheritedFrom
                      ? `Photo of ${wineLabel(inheritedFrom)}`
                      : "No photo"
              }}
            </span>

            <div class="photo-actions">
              <PillButton
                :disabled="photoDraft.preparing.value"
                @click="choosePhoto"
              >
                {{ photoDraft.draft.value || inheritedFrom ? "Choose another…" : "Add photo…" }}
              </PillButton>

              <PillButton
                v-if="photoDraft.draft.value || inheritedFrom"
                @click="noPhoto"
              >
                No photo
              </PillButton>

              <PillButton
                v-if="photoSource && !inheritedFrom"
                :disabled="photoDraft.preparing.value"
                @click="useInheritedPhoto"
              >
                Use photo of {{ wineLabel(photoSource) }}
              </PillButton>
            </div>

            <span
              v-if="photoDraft.error.value"
              class="photo-error"
            >
              {{ photoDraft.error.value }}
            </span>
          </div>

          <input
            ref="photoInput"
            class="photo-input"
            type="file"
            accept="image/*"
            @change="photoDraft.onFileInput"
          />
        </div>
      </div>

      <label class="field full">
        <span class="field-label">Comments</span>

        <textarea
          v-model="comments"
          rows="4"
        ></textarea>
      </label>
    </div>

    <p
      v-if="copiedFrom"
      class="note"
    >
      Country, region, color and winery taken from {{ copiedFrom.name }}{{ copiedFrom.vintage ? ` ${copiedFrom.vintage}` : "" }} where empty.
    </p>

    <p
      v-if="!isNew"
      class="note"
    >
      The stock changes only with − / + or a correction on the wine sheet.
    </p>

    <footer class="sheet-footer">
      <PillButton
        v-if="!isNew"
        variant="danger"
        :disabled="pending"
        @click="remove"
      >
        Delete
      </PillButton>

      <span
        class="footer-message"
        :class="{ error: !pending && changed && errors.length }"
      >
        {{
          pending
            ? waitingElsewhereMessage("A change of this wine")
            : changed ? errors[0] ?? "" : ""
        }}
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
/* =========================
   Photo (création)
========================= */

.photo-field {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

/* Préfixe .photo-field : l'emporte sur la taille de la vignette de WinePhoto. */
.photo-field .photo-preview,
.photo-field .edit-photo {
  flex-shrink: 0;

  width: 72px;
  height: 72px;
  box-sizing: border-box;

  border: 1px solid var(--border);
  border-radius: 8px;

  background: var(--bg-soft);

  object-fit: contain;
}

.photo-field .edit-photo :deep(img) {
  object-fit: contain;
}

.photo-side {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 0;
}

.photo-text {
  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

.photo-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.photo-error {
  color: var(--negative);
  font-size: var(--font-size-sm);
}

.photo-input {
  display: none;
}

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
   Form
========================= */

.form {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 0.75rem 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.field.wide {
  grid-column: span 2;
}

.field.full {
  grid-column: 1 / -1;
}

.field-label {
  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

.field :deep(input),
.field select,
.field textarea {
  box-sizing: border-box;
  width: 100%;

  padding: 7px 10px;

  border: 1px solid var(--input-border);
  border-radius: 8px;

  background: var(--surface);
  color: var(--text);

  font: inherit;
  font-size: var(--font-size-md);
}

.field textarea {
  resize: vertical;
}

.checkbox {
  display: inline-flex;
  align-items: center;
  align-self: end;
  gap: 6px;

  padding-bottom: 8px;
}

.note {
  margin: 0;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

.sheet-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.5rem;

  padding-top: 10px;

  border-top: 1px solid var(--border);
}

.footer-message {
  flex: 1;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

.footer-message.error {
  color: var(--negative);
}

@media (max-width: 520px) {
  .field.wide {
    grid-column: 1 / -1;
  }
}
</style>
