<script setup lang="ts">
import {
  computed,
  ref,
  watch,
  type Ref,
} from "vue";

import PageHeader from "@/components/PageHeader.vue";
import ChipSelector from "@/components/ChipSelector.vue";
import PillButton from "@/components/ui/PillButton.vue";
import SegmentedControl from "@/components/ui/SegmentedControl.vue";
import StatusPill from "@/components/ui/StatusPill.vue";
import WineEditSheet from "@/components/wineCellar/WineEditSheet.vue";
import WineLocationsSheet from "@/components/wineCellar/WineLocationsSheet.vue";
import WinePhoto from "@/components/wineCellar/WinePhoto.vue";
import WineSheet from "@/components/wineCellar/WineSheet.vue";

import { useRemoteJson } from "@/composables/useRemoteJson";
import { usePersistentRef } from "@/composables/usePersistentRef";
import { useWineEvents } from "@/composables/wineCellar/useWineEvents";

import {
  readWineCellar,
  WINE_CELLAR_FILE,
  WINE_CELLAR_FOLDER,
  WINE_COLORS,
  type Wine,
} from "@/contracts/wineCellar";

import { formatInteger } from "@/utils/amountFormat";

/* =========================
   Cave à vins (lecture)

   Page de la capacité wineCellar (contrat multi-environnements
   §3.4). Cave relue dès que le Mac republie wine/cellar.json
   (../Backend/docs/wine-cellar-contract.md).

   Une ligne par vin, avec la vignette de l'étiquette
   (chargée quand la ligne approche de l'écran). Filtres : stock (« In stock » par
   défaut, « History » = vins bus, « All »), favoris, pays,
   région (des pays choisis), couleur, millésime, emplacement
   (en version 2 du fichier : par identifiant, libellés des
   listes de référence ; en version 1 : par texte) ; recherche
   dans le nom et le producteur (casse et accents ignorés).
   Tri par nom, millésime ou « drink before » ; un vin en
   stock dont l'année « drink before » est passée est signalé.
   Les choix proposés et les totaux portent sur la sélection.
   Filtres conservés pendant la session. Un clic sur une
   ligne ouvre la fiche du vin.

   Saisies par événements WIN (useWineEvents, une instance
   pour la page, partagée avec la fiche) : vin en attente
   marqué « Pending », message de la dernière demande au-dessus
   de la liste. Boutons +/- de chaque ligne : une bouteille
   achetée (purchase) ou ouverte (opened), « - » désactivé à 0
   et tant que le vin est en attente. « New wine » et
   « Edit » (fiche du vin) : fiche complète, WineEditSheet ;
   la fiche du vin est masquée pendant la saisie.
   Taille affichée quand elle n'est pas la bouteille de 75 cl
   (facteur 1, version 2). « Locations » : gestion des
   emplacements (WineLocationsSheet), en version 1 seulement ;
   en version 2, dans la section « Wine » de Master data.
========================= */

type StockScope = "inStock" | "history" | "all";

type SortKey = "name" | "vintage" | "drinkBefore";

const stockOptions: { value: StockScope; label: string }[] = [
  { value: "inStock", label: "In stock" },
  { value: "history", label: "History" },
  { value: "all", label: "All" },
];

const sortOptions: { value: SortKey; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "vintage", label: "Vintage" },
  { value: "drinkBefore", label: "Drink before" },
];

/* Emplacement des vins qui n'en ont pas (identifiant jamais attribué). */
const NO_LOCATION = -1;

/* Millésime des vins qui n'en ont pas. */
const NO_VINTAGE = -1;

const CURRENT_YEAR =
  new Date().getFullYear();

const cellarFile =
  useRemoteJson({
    folder: WINE_CELLAR_FOLDER,
    file: WINE_CELLAR_FILE,
    read: readWineCellar,
  });

const cellar =
  computed(() =>
    cellarFile.data.value
  );

const wineEvents =
  useWineEvents();

/* =========================
   Filtres
========================= */

const stockScope =
  usePersistentRef<StockScope>("wineCellar.stock", "inStock");

const favoritesOnly =
  usePersistentRef("wineCellar.favoritesOnly", false);

const query =
  usePersistentRef("wineCellar.query", "");

const countryFilter =
  usePersistentRef<string[]>("wineCellar.countries", []);

const regionFilter =
  usePersistentRef<string[]>("wineCellar.regions", []);

const colorFilter =
  usePersistentRef<string[]>("wineCellar.colors", []);

const vintageFilter =
  usePersistentRef<number[]>("wineCellar.vintages", []);

const locationFilter =
  usePersistentRef<number[]>("wineCellar.locations", []);

const sortKey =
  usePersistentRef<SortKey>("wineCellar.sort", "name");

/* Valeurs retrouvées de la session mais plus valides : défaut. */
if (!stockOptions.some(option => option.value === stockScope.value)) {
  stockScope.value = "inStock";
}

if (!sortOptions.some(option => option.value === sortKey.value)) {
  sortKey.value = "name";
}

function fold(
  text: string
): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function vintageKey(
  wine: Wine
): number {
  return wine.vintage ?? NO_VINTAGE;
}

function locationKey(
  wine: Wine
): number {
  return wine.locationId ?? NO_LOCATION;
}

/* Clé du filtre pays : identifiant en version 2, nom en version 1. */
function countryKey(
  wine: Wine
): string | null {
  return cellar.value?.version === 2
    ? wine.countryId === null ? null : String(wine.countryId)
    : wine.country;
}

/* Clé du filtre région (deux pays peuvent avoir une région de même nom). */
function regionKey(
  wine: Wine
): string | null {
  return cellar.value?.version === 2
    ? wine.regionId === null ? null : String(wine.regionId)
    : wine.region;
}

function inSelection(
  selection: string[],
  key: string | null
): boolean {
  return !selection.length || (key !== null && selection.includes(key));
}

/* Vins du stock choisi (base des choix proposés). */
const scopedWines =
  computed(() =>
    (cellar.value?.wines ?? []).filter(
      wine =>
        (stockScope.value === "all" ||
          (stockScope.value === "inStock") === (wine.quantity > 0)) &&
        (!favoritesOnly.value || wine.favorite)
    )
  );

function distinct(
  values: (string | null)[]
): string[] {
  return [...new Set(values.filter((value): value is string => value !== null))]
    .sort((a, b) => a.localeCompare(b));
}

/* Pays présents dans la sélection, dans l'ordre de la liste de référence en version 2. */
const countryItems =
  computed(() => {
    const data =
      cellar.value;

    if (data?.version !== 2) {
      return distinct(scopedWines.value.map(wine => wine.country))
        .map(country => ({ id: country, label: country }));
    }

    const used =
      new Set(scopedWines.value.map(countryKey));

    return data.countries
      .filter(country => used.has(String(country.id)))
      .map(country => ({ id: String(country.id), label: country.name }));
  });

/*
  Régions des pays choisis. Version 2 : ordre de la liste
  (pays puis nom), pays ajouté au nom porté par deux régions
  proposées.
*/
const regionItems =
  computed(() => {
    const data =
      cellar.value;

    const wines =
      scopedWines.value.filter(
        wine => inSelection(countryFilter.value, countryKey(wine))
      );

    if (data?.version !== 2) {
      return distinct(wines.map(wine => wine.region))
        .map(region => ({ id: region, label: region }));
    }

    const used =
      new Set(wines.map(regionKey));

    const regions =
      data.regions.filter(region => used.has(String(region.id)));

    const countryNames =
      new Map(data.countries.map(country => [country.id, country.name]));

    return regions.map(region => {
      const shared =
        regions.some(
          other => other.id !== region.id && fold(other.name) === fold(region.name)
        );

      const country =
        region.countryId === null ? undefined : countryNames.get(region.countryId);

      return {
        id: String(region.id),
        label: shared && country ? `${region.name} (${country})` : region.name,
      };
    });
  });

/* Couleurs dans l'ordre du contrat, puis les autres éventuelles. */
const colorItems =
  computed(() => {
    const present =
      distinct(scopedWines.value.map(wine => wine.color));

    return [
      ...WINE_COLORS.filter(color => present.includes(color)),
      ...present.filter(color => !(WINE_COLORS as readonly string[]).includes(color)),
    ].map(color => ({ id: color, label: color }));
  });

/* Millésimes du plus ancien au plus récent, « None » à la fin. */
const vintageItems =
  computed(() => {
    const used =
      new Set(scopedWines.value.map(vintageKey));

    const items =
      [...used]
        .filter(vintage => vintage !== NO_VINTAGE)
        .sort((a, b) => a - b)
        .map(vintage => ({ id: vintage, label: String(vintage) }));

    return used.has(NO_VINTAGE)
      ? [...items, { id: NO_VINTAGE, label: "None" }]
      : items;
  });

/* Emplacements dans l'ordre du fichier, « None » à la fin. */
const locationItems =
  computed(() => {
    const used =
      new Set(scopedWines.value.map(locationKey));

    const items =
      (cellar.value?.locations ?? [])
        .filter(location => used.has(location.id))
        .map(location => ({ id: location.id, label: location.label }));

    return used.has(NO_LOCATION)
      ? [...items, { id: NO_LOCATION, label: "None" }]
      : items;
  });

/* Choix qui ne sont plus proposés : retirés. */
function pruneOnChange<T extends string | number>(
  selection: Ref<T[]>,
  items: Ref<{ id: T }[]>
) {
  watch(
    items,

    list => {
      if (!cellar.value) {
        return;
      }

      const ids =
        new Set(list.map(item => item.id));

      const kept =
        selection.value.filter(id => ids.has(id));

      if (kept.length !== selection.value.length) {
        selection.value = kept;
      }
    },

    {
      immediate: true,
    }
  );
}

pruneOnChange(countryFilter, countryItems);
pruneOnChange(regionFilter, regionItems);
pruneOnChange(colorFilter, colorItems);
pruneOnChange(vintageFilter, vintageItems);
pruneOnChange(locationFilter, locationItems);

const filteredWines =
  computed(() => {
    const text =
      fold(query.value.trim());

    return scopedWines.value.filter(
      wine =>
        inSelection(countryFilter.value, countryKey(wine)) &&
        inSelection(regionFilter.value, regionKey(wine)) &&
        (!colorFilter.value.length ||
          (wine.color !== null && colorFilter.value.includes(wine.color))) &&
        (!vintageFilter.value.length ||
          vintageFilter.value.includes(vintageKey(wine))) &&
        (!locationFilter.value.length ||
          locationFilter.value.includes(locationKey(wine))) &&
        (!text ||
          fold(wine.name).includes(text) ||
          fold(wine.winery ?? "").includes(text))
    );
  });

const hasFilters =
  computed(() =>
    favoritesOnly.value ||
    query.value.trim() !== "" ||
    countryFilter.value.length > 0 ||
    regionFilter.value.length > 0 ||
    colorFilter.value.length > 0 ||
    vintageFilter.value.length > 0 ||
    locationFilter.value.length > 0
  );

function resetFilters() {
  favoritesOnly.value = false;
  query.value = "";
  countryFilter.value = [];
  regionFilter.value = [];
  colorFilter.value = [];
  vintageFilter.value = [];
  locationFilter.value = [];
}

/* =========================
   Tri
========================= */

/* Valeurs absentes en dernier. */
function compareNullable(
  a: number | null,
  b: number | null
): number {
  if (a === b) {
    return 0;
  }

  if (a === null) {
    return 1;
  }

  if (b === null) {
    return -1;
  }

  return a - b;
}

function compareName(
  a: Wine,
  b: Wine
): number {
  return (
    a.name.localeCompare(b.name) ||
    compareNullable(a.vintage, b.vintage)
  );
}

const sortedWines =
  computed(() => {
    const list =
      [...filteredWines.value];

    switch (sortKey.value) {
      case "vintage":
        return list.sort(
          (a, b) => compareNullable(a.vintage, b.vintage) || compareName(a, b)
        );

      case "drinkBefore":
        return list.sort(
          (a, b) => compareNullable(a.drinkBefore, b.drinkBefore) || compareName(a, b)
        );

      default:
        return list.sort(compareName);
    }
  });

/* =========================
   Affichage
========================= */

/* En stock, à boire avant une année déjà passée. */
function isPastDrinkBefore(
  wine: Wine
): boolean {
  return (
    wine.quantity > 0 &&
    wine.drinkBefore !== null &&
    wine.drinkBefore < CURRENT_YEAR
  );
}

/* Taille autre que la bouteille de 75 cl (version 2), sinon null. */
const bottleSizes =
  computed(() =>
    cellar.value?.version === 2
      ? new Map(cellar.value.bottleSizes.map(size => [size.id, size]))
      : null
  );

function sizeTag(
  wine: Wine
): string | null {
  if (!bottleSizes.value || wine.bottleSizeId === null) {
    return null;
  }

  const size =
    bottleSizes.value.get(wine.bottleSizeId);

  return size?.factor === 1
    ? null
    : wine.bottleSize ?? size?.name ?? null;
}

const bottleCount =
  computed(() =>
    filteredWines.value.reduce((total, wine) => total + wine.quantity, 0)
  );

/* =========================
   Fiche

   Identifiant du vin ouvert : la fiche suit les
   republications et se ferme si le vin disparaît.
========================= */

const openWineId =
  ref<number | null>(null);

const openWine =
  computed(() =>
    openWineId.value === null
      ? null
      : cellar.value?.wines.find(wine => wine.id === openWineId.value) ?? null
  );

/* Fiche complète : undefined fermée, wine null nouveau vin. */
const editing =
  ref<{ wine: Wine | null } | undefined>(undefined);

const locationsOpen =
  ref(false);

function editOpenWine() {
  if (openWine.value) {
    editing.value = { wine: openWine.value };
  }
}

function plural(
  count: number,
  word: string
): string {
  return `${formatInteger(count)} ${word}${count === 1 ? "" : "s"}`;
}
</script>

<template>
  <PageHeader
    title="Wine cellar"
    icon="wine"
  />

  <div
    v-if="cellarFile.error.value"
    class="state-message error"
  >
    {{ cellarFile.error.value }}
  </div>

  <div
    v-else-if="!cellar"
    class="state-message"
  >
    Loading the wine cellar…
  </div>

  <main
    v-else
    class="wine-cellar-view"
  >
    <section class="filters">
      <div class="filter-line">
        <SegmentedControl
          v-model="stockScope"
          :options="stockOptions"
        />

        <PillButton
          :active="favoritesOnly"
          @click="favoritesOnly = !favoritesOnly"
        >
          ★ Favorites
        </PillButton>

        <input
          v-model="query"
          type="search"
          class="search-input"
          placeholder="Name or winery"
          autocomplete="off"
          spellcheck="false"
        />

        <PillButton
          v-if="hasFilters"
          @click="resetFilters"
        >
          Reset
        </PillButton>
      </div>

      <ChipSelector
        v-if="countryItems.length"
        v-model="countryFilter"
        label="Country"
        :items="countryItems"
        :multiple="true"
      />

      <ChipSelector
        v-if="regionItems.length"
        v-model="regionFilter"
        label="Region"
        :items="regionItems"
        :multiple="true"
      />

      <ChipSelector
        v-if="colorItems.length"
        v-model="colorFilter"
        label="Color"
        :items="colorItems"
        :multiple="true"
      />

      <ChipSelector
        v-if="vintageItems.length"
        v-model="vintageFilter"
        label="Vintage"
        :items="vintageItems"
        :multiple="true"
      />

      <ChipSelector
        v-if="locationItems.length"
        v-model="locationFilter"
        label="Location"
        :items="locationItems"
        :multiple="true"
      />
    </section>

    <section class="panel">
      <header class="panel-header">
        <span class="totals">
          {{ plural(filteredWines.length, "wine") }} ·
          {{ plural(bottleCount, "bottle") }}
        </span>

        <span class="sort">
          <span class="sort-label">Sort</span>

          <SegmentedControl
            v-model="sortKey"
            :options="sortOptions"
          />

          <PillButton
            v-if="cellar.version === 1"
            @click="locationsOpen = true"
          >
            Locations
          </PillButton>

          <PillButton
            variant="primary"
            @click="editing = { wine: null }"
          >
            New wine
          </PillButton>
        </span>
      </header>

      <p
        v-if="wineEvents.message.value"
        class="request-message"
        :class="wineEvents.messageTone.value"
      >
        {{ wineEvents.message.value }}
      </p>

      <p
        v-if="!sortedWines.length"
        class="empty"
      >
        {{ cellar.wines.length ? "No wine found." : "The cellar is empty." }}
      </p>

      <div
        v-else
        class="table-wrapper"
      >
        <table class="wines-table">
          <thead>
            <tr>
              <th class="col-favorite"></th>
              <th class="col-photo"></th>
              <th>Name</th>
              <th class="col-number">Vintage</th>
              <th>Winery</th>
              <th>Region</th>
              <th>Color</th>
              <th>Location</th>
              <th class="col-number">Drink before</th>
              <th class="col-quantity">Qty</th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="wine in sortedWines"
              :key="wine.id"
              class="wine-row"
              :class="{ consumed: wine.quantity === 0 }"
              tabindex="0"
              @click="openWineId = wine.id"
              @keydown.enter="openWineId = wine.id"
            >
              <td
                class="col-favorite"
                :title="wine.favorite ? 'Favorite' : undefined"
              >
                {{ wine.favorite ? "★" : "" }}
              </td>

              <td class="col-photo">
                <WinePhoto
                  :photo-key="wine.photo"
                  size="thumb"
                />
              </td>

              <td class="col-name">
                {{ wine.name }}

                <span
                  v-if="sizeTag(wine)"
                  class="size"
                >
                  {{ sizeTag(wine) }}
                </span>

                <StatusPill
                  v-if="wineEvents.isWinePending(wine.id)"
                  class="pending-pill"
                  tone="warning"
                >
                  Pending
                </StatusPill>
              </td>
              <td class="col-number">{{ wine.vintage ?? "" }}</td>
              <td class="soft">{{ wine.winery ?? "" }}</td>

              <td>
                {{ wine.region ?? "" }}

                <span
                  v-if="wine.country"
                  class="country"
                >
                  {{ wine.country }}
                </span>
              </td>

              <td>{{ wine.color ?? "" }}</td>
              <td class="soft">{{ wine.locationLabel ?? "" }}</td>

              <td
                class="col-number"
                :class="{ late: isPastDrinkBefore(wine) }"
                :title="isPastDrinkBefore(wine) ? 'Drink-before year passed' : undefined"
              >
                {{ wine.drinkBefore ?? "" }}
              </td>

              <td
                class="col-quantity"
                @click.stop
                @keydown.enter.stop
              >
                <span class="stepper">
                  <PillButton
                    class="step-button"
                    title="Bottle opened"
                    aria-label="Remove a bottle"
                    :disabled="wine.quantity === 0 || wineEvents.isWinePending(wine.id)"
                    @click="wineEvents.changeStock({ wineId: wine.id, delta: -1, reason: 'opened' })"
                  >
                    −
                  </PillButton>

                  <span class="quantity">{{ wine.quantity }}</span>

                  <PillButton
                    class="step-button"
                    title="Bottle purchased"
                    aria-label="Add a bottle"
                    :disabled="wineEvents.isWinePending(wine.id)"
                    @click="wineEvents.changeStock({ wineId: wine.id, delta: 1, reason: 'purchase' })"
                  >
                    +
                  </PillButton>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <WineSheet
      v-if="openWine && !editing"
      :wine="openWine"
      :past-drink-before="isPastDrinkBefore(openWine)"
      :size-label="sizeTag(openWine)"
      :events="wineEvents"
      @close="openWineId = null"
      @edit="editOpenWine"
    />

    <WineLocationsSheet
      v-if="locationsOpen && cellar.version === 1"
      :cellar="cellar"
      :events="wineEvents"
      @close="locationsOpen = false"
    />

    <WineEditSheet
      v-if="editing"
      :wine="editing.wine"
      :cellar="cellar"
      :events="wineEvents"
      @close="editing = undefined"
    />
  </main>
</template>

<style scoped>
.wine-cellar-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  padding: 1rem 1.5rem 2rem;
}

.state-message {
  padding: 2rem 1.5rem;

  color: var(--text-soft);
}

.state-message.error {
  color: var(--negative);
}

/* =========================
   Filters
========================= */

.filters {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.filter-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
}

.search-input {
  flex: 1;
  min-width: 12rem;
  max-width: 24rem;
  box-sizing: border-box;

  padding: 6px 10px;

  border: 1px solid var(--input-border);
  border-radius: 8px;

  font-size: var(--font-size-sm);
}

/* =========================
   Panel
========================= */

.panel {
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

  margin-bottom: 0.5rem;
}

.totals {
  font-size: var(--font-size-sm);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.sort {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.sort-label {
  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

.request-message {
  margin: 0 0 0.5rem;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

.request-message.completed {
  color: var(--positive);
}

.request-message.error {
  color: var(--negative);
}

.empty {
  margin: 0.5rem 0;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

/* =========================
   Table
========================= */

.table-wrapper {
  max-height: 70vh;
  overflow: auto;
}

.wines-table {
  width: 100%;

  border-collapse: collapse;

  font-size: var(--font-size-sm);
}

.wines-table th {
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

.wines-table td {
  padding: 6px 8px;

  border-bottom: 1px solid var(--border);

  vertical-align: middle;
}

.wine-row {
  cursor: pointer;
}

.wine-row:hover td,
.wine-row:focus-visible td {
  background: var(--primary-soft);
}

.wine-row:focus-visible {
  outline: none;
}

.wines-table tr.consumed td {
  color: var(--text-muted);
}

.col-favorite {
  width: 1%;

  color: var(--primary);
  text-align: center;
}

.col-photo {
  width: 1%;
}

.wines-table td.col-photo {
  padding: 3px 0 3px 8px;
}

.col-name {
  font-weight: 600;
}

.col-number {
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}

.wines-table th.col-number {
  text-align: right;
}

.col-quantity {
  width: 1%;

  cursor: default;
  text-align: center;
  white-space: nowrap;
}

.stepper {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.step-button {
  min-width: 28px;
  padding: 2px 8px;

  font-weight: 700;
}

.quantity {
  min-width: 1.75rem;

  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.soft {
  color: var(--text-soft);
}

.size {
  margin-left: 0.4rem;

  color: var(--text-soft);
  font-size: var(--font-size-xs);
  font-weight: 400;
}

.country {
  display: block;

  color: var(--text-soft);
  font-size: var(--font-size-xs);
}

.wines-table td.late {
  color: var(--warning);
  font-weight: 700;
}

.pending-pill {
  margin-left: 0.5rem;

  vertical-align: middle;
}
</style>
