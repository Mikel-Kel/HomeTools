<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";

import PillButton from "@/components/ui/PillButton.vue";
import StatusPill from "@/components/ui/StatusPill.vue";
import WinePhoto from "@/components/wineCellar/WinePhoto.vue";
import WinePhotoViewer from "@/components/wineCellar/WinePhotoViewer.vue";
import WineTastings from "@/components/wineCellar/WineTastings.vue";

import type {
  Wine,
  WineStockReason,
} from "@/contracts/wineCellar";

import type { WineEvents } from "@/composables/wineCellar/useWineEvents";
import { useWinePhotoDraft } from "@/composables/wineCellar/useWinePhotoDraft";

import { confirmDialog } from "@/services/dialog/appDialog";

import { formatAmount } from "@/utils/amountFormat";
import { formatDate } from "@/utils/dateFormat";

/* =========================
   Fiche d'un vin (lecture)

   Tous les champs de wine/cellar.json
   (../Backend/docs/wine-cellar-contract.md, § 2) :
   emplacement par son libellé, commentaires sur plusieurs
   lignes, dégustations dans l'ordre du fichier (la plus
   récente en premier), dates partielles telles quelles.
   Photo de l'étiquette (§ 5, WinePhoto), pictogramme neutre
   sans photo ou si elle ne se charge pas ; un appui l'ouvre
   en grand (WinePhotoViewer). Sous la photo (W7, § 5) :
   choix d'une image (fichier sur Mac ; appareil photo,
   photothèque ou fichiers sur iPad), préparée puis montrée
   en aperçu avant l'envoi (WINE_PHOTO_SAVED) ; retrait après
   confirmation (WINE_PHOTO_DELETED). La nouvelle photo
   s'affiche à la republication, sous sa nouvelle clé.

   Fermeture : ✕, Échap, clic hors de la fiche.

   Saisies par les événements de la page (events) : fiche
   marquée « Pending » tant qu'un événement du vin attend,
   message de la dernière demande quand elle porte sur ce vin.
   Stock : « - » (bouteille ouverte), « + » (achetée) et
   correction (quantité constatée → variation, reason
   correction). Actions désactivées tant que le vin attend.
   Dégustations : WineTastings ; une saisie non envoyée
   (dégustation ou photo) est confirmée avant de fermer la
   fiche. « Edit » : fiche
   complète (WineEditSheet, ouverte par la page).
========================= */

const props = defineProps<{
  wine: Wine;
  pastDrinkBefore: boolean;

  /* Taille autre que la bouteille de 75 cl, sinon null. */
  sizeLabel: string | null;
  events: WineEvents;
}>();

const pending =
  computed(() =>
    props.events.isWinePending(props.wine.id)
  );

/* =========================
   Photo
========================= */

const photo =
  ref<InstanceType<typeof WinePhoto> | null>(null);

const photoUrl =
  computed(() => photo.value?.url ?? null);

const photoOpen =
  ref(false);

const photoDraft =
  useWinePhotoDraft();

const photoInput =
  ref<HTMLInputElement | null>(null);

/* Image montrée : aperçu de la photo choisie, sinon photo actuelle. */
const shownPhotoUrl =
  computed(() =>
    photoDraft.draft.value?.previewUrl ?? photoUrl.value
  );

const photoBusy =
  computed(() =>
    pending.value || photoDraft.preparing.value
  );

function choosePhoto() {
  photoInput.value?.click();
}

async function sendPhoto() {
  const draft =
    photoDraft.draft.value;

  if (!draft || pending.value) {
    return;
  }

  await props.events.savePhoto(
    props.wine.id,
    draft.image
  );

  photoDraft.clear();
}

async function removePhoto() {
  if (
    pending.value ||
    !(await confirmDialog({
      title: "Remove the label photo?",
      message: `${props.wine.name}: the photo will be deleted.`,
      confirmLabel: "Remove",
      destructive: true,
    }))
  ) {
    return;
  }

  props.events.deletePhoto(props.wine.id);
}

/* =========================
   Stock
========================= */

function changeStock(
  delta: number,
  reason: WineStockReason
) {
  props.events.changeStock({
    wineId: props.wine.id,
    delta,
    reason,
  });
}

/*
  Quantité constatée, saisie pour une correction : préremplie
  avec le stock affiché, remise à jour à chaque republication.
*/
const countedText =
  ref(String(props.wine.quantity));

watch(
  () => props.wine.quantity,

  quantity => {
    countedText.value = String(quantity);
  }
);

const countedQuantity =
  computed(() => {
    const text =
      countedText.value.trim();

    return /^\d+$/.test(text)
      ? Number(text)
      : null;
  });

const correctionError =
  computed(() =>
    countedQuantity.value === null
      ? "Enter a whole number of bottles (0 or more)."
      : ""
  );

const canCorrect =
  computed(() =>
    !pending.value &&
    countedQuantity.value !== null &&
    countedQuantity.value !== props.wine.quantity
  );

function correctStock() {
  if (!canCorrect.value || countedQuantity.value === null) {
    return;
  }

  changeStock(
    countedQuantity.value - props.wine.quantity,
    "correction"
  );
}

const requestMessage =
  computed(() =>
    props.events.concernsWine(props.wine.id)
      ? props.events.message.value
      : ""
  );

const emit = defineEmits<{
  close: [];
  edit: [];
}>();

const subtitle =
  computed(() =>
    [
      props.wine.vintage,
      props.sizeLabel,
      props.wine.color,
      props.wine.winery,
    ]
      .filter(value => value !== null && value !== "")
      .join(" · ")
  );

const origin =
  computed(() =>
    [props.wine.region, props.wine.country]
      .filter((value): value is string => value !== null)
      .join(", ")
  );

const priceText =
  computed(() =>
    props.wine.priceChf === null
      ? ""
      : `CHF ${formatAmount(props.wine.priceChf)}`
  );

/* Champs affichés, valeur vide = « — ». */
const fields =
  computed(() => [
    { label: "Region", value: origin.value },
    { label: "Location", value: props.wine.locationLabel ?? "" },
    { label: "Price", value: priceText.value },
    { label: "Purchased", value: formatDate(props.wine.purchasedAt) },
    { label: "Hold until", value: props.wine.holdUntil?.toString() ?? "" },
  ]);

/* Dégustation saisie mais pas encore envoyée. */
const tastingDirty =
  ref(false);

async function close() {
  if (
    photoDraft.draft.value &&
    !(await confirmDialog({
      title: "Discard the new photo?",
      confirmLabel: "Discard",
      destructive: true,
    }))
  ) {
    return;
  }

  if (
    tastingDirty.value &&
    !(await confirmDialog({
      title: "Discard the tasting?",
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
    :aria-label="wine.name"
  >
    <header class="sheet-header">
      <div>
        <h2>
          <span
            v-if="wine.favorite"
            class="favorite"
            title="Favorite"
          >★</span>
          {{ wine.name }}

          <StatusPill
            v-if="pending"
            class="pending-pill"
            tone="warning"
          >
            Pending
          </StatusPill>
        </h2>

        <div
          v-if="subtitle"
          class="sheet-subtitle"
        >
          {{ subtitle }}
        </div>
      </div>

      <div class="header-actions">
        <PillButton
          :disabled="pending || tastingDirty"
          @click="emit('edit')"
        >
          Edit
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

    <div class="summary">

      <div class="summary-main">
        <dl class="key-figures">
          <div>
            <dt>Bottles</dt>
            <dd class="stock">
              <PillButton
                class="step-button"
                title="Bottle opened"
                aria-label="Remove a bottle"
                :disabled="wine.quantity === 0 || pending"
                @click="changeStock(-1, 'opened')"
              >
                −
              </PillButton>

              <span :class="{ consumed: wine.quantity === 0 }">
                {{ wine.quantity }}
              </span>

              <PillButton
                class="step-button"
                title="Bottle purchased"
                aria-label="Add a bottle"
                :disabled="pending"
                @click="changeStock(1, 'purchase')"
              >
                +
              </PillButton>
            </dd>
          </div>

          <div>
            <dt>Drink before</dt>
            <dd
              :class="{ late: pastDrinkBefore }"
              :title="pastDrinkBefore ? 'Drink-before year passed' : undefined"
            >
              {{ wine.drinkBefore ?? "—" }}
            </dd>
          </div>
        </dl>

        <div class="correction">
          <label
            class="correction-label"
            for="wine-counted"
          >
            Counted bottles
          </label>

          <input
            id="wine-counted"
            v-model="countedText"
            class="correction-input"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            @keydown.enter="correctStock"
          />

          <PillButton
            title="Set the stock to the counted bottles"
            :disabled="!canCorrect"
            @click="correctStock"
          >
            Correct stock
          </PillButton>

          <span
            v-if="correctionError"
            class="correction-error"
          >
            {{ correctionError }}
          </span>
        </div>
      </div>

      <div class="photo-column">
        <button
          type="button"
          class="photo"
          :disabled="!shownPhotoUrl"
          :title="shownPhotoUrl ? 'Show the label' : wine.photo ? undefined : 'No label photo'"
          @click="photoOpen = true"
        >
          <img
            v-if="photoDraft.draft.value"
            class="photo-preview"
            :src="photoDraft.draft.value.previewUrl"
            alt="New label"
            draggable="false"
          />

          <WinePhoto
            v-else
            ref="photo"
            :photo-key="wine.photo"
            size="sheet"
          />
        </button>

        <input
          ref="photoInput"
          class="photo-input"
          type="file"
          accept="image/*"
          @change="photoDraft.onFileInput"
        />

        <div
          v-if="photoDraft.draft.value"
          class="photo-actions"
        >
          <PillButton
            variant="primary"
            :disabled="pending"
            @click="sendPhoto"
          >
            Save photo
          </PillButton>

          <PillButton @click="photoDraft.clear">
            Cancel
          </PillButton>
        </div>

        <div
          v-else
          class="photo-actions"
        >
          <PillButton
            :disabled="photoBusy"
            @click="choosePhoto"
          >
            {{ photoDraft.preparing.value ? "Preparing…" : wine.photo ? "Change…" : "Add photo…" }}
          </PillButton>

          <PillButton
            v-if="wine.photo"
            variant="danger"
            :disabled="photoBusy"
            @click="removePhoto"
          >
            Remove
          </PillButton>
        </div>

        <span
          v-if="photoDraft.error.value"
          class="photo-error"
        >
          {{ photoDraft.error.value }}
        </span>
      </div>
    </div>

    <dl class="fields">
      <div
        v-for="field in fields"
        :key="field.label"
      >
        <dt>{{ field.label }}</dt>
        <dd>{{ field.value || "—" }}</dd>
      </div>
    </dl>

    <div
      v-if="wine.comments"
      class="block"
    >
      <h3>Comments</h3>
      <p class="comments">{{ wine.comments }}</p>
    </div>

    <WineTastings
      :wine="wine"
      :events="events"
      :pending="pending"
      @dirty="tastingDirty = $event"
    />

    <footer
      v-if="wine.updatedAt || requestMessage"
      class="sheet-footer"
    >
      <span
        v-if="requestMessage"
        class="request-message"
        :class="events.messageTone.value"
      >
        {{ requestMessage }}
      </span>

      <span
        v-if="wine.updatedAt"
        class="updated"
      >
        Updated {{ formatDate(wine.updatedAt) }}
      </span>
    </footer>

    <!-- Hors de la fiche : sa transformation confinerait la vue en plein écran. -->
    <Teleport to="body">
      <WinePhotoViewer
        v-if="photoOpen && shownPhotoUrl"
        :url="shownPhotoUrl"
        :title="wine.name"
        @close="photoOpen = false"
      />
    </Teleport>
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

  width: 600px;
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

.favorite {
  color: var(--primary);
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

/* =========================
   Summary
========================= */

.summary {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.25rem;
}

.photo-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  gap: 0.5rem;

  width: 160px;
}

.photo-input {
  display: none;
}

.photo-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.4rem;
}

.photo-error {
  color: var(--negative);
  font-size: var(--font-size-sm);
  text-align: center;
}

.photo-preview {
  display: block;

  width: 160px;
  height: 160px;
  box-sizing: border-box;

  border: 1px solid var(--border);
  border-radius: 10px;

  background: var(--bg-soft);

  object-fit: contain;
}

.photo {
  flex-shrink: 0;

  padding: 0;

  border: none;
  border-radius: 10px;

  background: none;

  cursor: zoom-in;
}

.photo:disabled {
  cursor: default;
}

.key-figures {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem 2rem;

  margin: 0;
}

.key-figures dt {
  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

.key-figures dd {
  margin: 2px 0 0;

  font-size: 1.6rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.summary-main {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 0;
}

.stock {
  display: flex;
  align-items: center;
  gap: 8px;
}

.step-button {
  min-width: 32px;
  padding: 3px 10px;

  font-size: var(--font-size-md);
  font-weight: 700;
}

.consumed {
  color: var(--text-muted);
}

.correction {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem 0.6rem;
}

.correction-label {
  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

.correction-input {
  width: 4.5rem;
  box-sizing: border-box;

  padding: 5px 8px;

  border: 1px solid var(--input-border);
  border-radius: 8px;

  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
}

.correction-error {
  flex-basis: 100%;

  color: var(--negative);
  font-size: var(--font-size-sm);
}

.key-figures dd.late {
  color: var(--warning);
}

/* =========================
   Fields
========================= */

.fields {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 0.75rem 1rem;

  margin: 0;
}

.fields dt {
  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

.fields dd {
  margin: 2px 0 0;

  overflow-wrap: anywhere;
}

.block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.block h3 {
  margin: 0;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
  font-weight: 700;
}

.comments {
  margin: 0;

  white-space: pre-line;
  overflow-wrap: anywhere;
}

.sheet-footer {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;

  padding-top: 10px;

  border-top: 1px solid var(--border);

  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

.request-message {
  flex: 1;
}

.request-message.completed {
  color: var(--positive);
}

.request-message.error {
  color: var(--negative);
}

.updated {
  margin-left: auto;
}

.pending-pill {
  margin-left: 0.5rem;

  vertical-align: middle;
}
</style>
