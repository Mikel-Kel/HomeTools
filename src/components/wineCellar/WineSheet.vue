<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
} from "vue";

import type {
  Wine,
  WineLocation,
} from "@/contracts/wineCellar";

import { formatAmount } from "@/utils/amountFormat";
import { formatDate } from "@/utils/dateFormat";

/* =========================
   Fiche d'un vin (lecture)

   Tous les champs de wine/cellar.json
   (../Backend/docs/wine-cellar-contract.md, § 2) :
   emplacement par son libellé, commentaires sur plusieurs
   lignes, dégustations dans l'ordre du fichier (la plus
   récente en premier), dates partielles telles quelles.
   Zone de la photo réservée (photos : lot W5), pictogramme
   neutre en attendant.

   Fermeture : ✕, Échap, clic hors de la fiche. Aucune
   saisie : modification de la cave par événements (lot W4).
========================= */

const props = defineProps<{
  wine: Wine;
  location: WineLocation | null;
  pastDrinkBefore: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const subtitle =
  computed(() =>
    [
      props.wine.vintage,
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

const locationText =
  computed(() =>
    props.wine.locationId === null
      ? ""
      : props.location?.label ?? `#${props.wine.locationId}`
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
    { label: "Location", value: locationText.value },
    { label: "Price", value: priceText.value },
    { label: "Purchased", value: formatDate(props.wine.purchasedAt) },
    { label: "Hold until", value: props.wine.holdUntil?.toString() ?? "" },
  ]);

function onKeydown(
  event: KeyboardEvent
) {
  if (event.key === "Escape") {
    emit("close");
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
    @click="emit('close')"
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
        </h2>

        <div
          v-if="subtitle"
          class="sheet-subtitle"
        >
          {{ subtitle }}
        </div>
      </div>

      <button
        type="button"
        class="close-btn"
        aria-label="Close"
        @click="emit('close')"
      >
        ✕
      </button>
    </header>

    <div class="summary">
      <div
        class="photo"
        :title="wine.photo ? undefined : 'No label photo'"
      >
        <svg
          viewBox="0 0 24 64"
          aria-hidden="true"
        >
          <path
            d="M9 2h6v14c0 3 6 6 6 13v31a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V29c0-7 6-10 6-13z"
          />
          <rect
            x="5"
            y="34"
            width="14"
            height="14"
            rx="1"
          />
        </svg>
      </div>

      <dl class="key-figures">
        <div>
          <dt>Bottles</dt>
          <dd :class="{ consumed: wine.quantity === 0 }">
            {{ wine.quantity }}
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

    <div class="block">
      <h3>Tastings</h3>

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
        >
          <span class="tasting-date">{{ tasting.date || "—" }}</span>
          <span class="tasting-note">{{ tasting.note }}</span>
        </li>
      </ul>
    </div>

    <footer
      v-if="wine.updatedAt"
      class="sheet-footer"
    >
      Updated {{ formatDate(wine.updatedAt) }}
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
  align-items: center;
  gap: 1.25rem;
}

.photo {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  width: 96px;
  height: 128px;

  border: 1px dashed var(--border);
  border-radius: 10px;

  background: var(--bg-soft);
}

.photo svg {
  height: 88px;

  fill: var(--text-muted);
  opacity: 0.5;
}

.photo svg rect {
  fill: var(--bg-soft);
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

.key-figures dd.consumed {
  color: var(--text-muted);
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

.note {
  margin: 0;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

.comments {
  margin: 0;

  white-space: pre-line;
  overflow-wrap: anywhere;
}

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
  gap: 0.75rem;
}

.tasting-date {
  flex-shrink: 0;
  min-width: 5.5rem;

  color: var(--text-soft);
  font-variant-numeric: tabular-nums;
}

.tasting-note {
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.sheet-footer {
  padding-top: 10px;

  border-top: 1px solid var(--border);

  color: var(--text-soft);
  font-size: var(--font-size-sm);
}
</style>
