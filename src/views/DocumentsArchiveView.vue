<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  ref,
  watch,
} from "vue";

import PageHeader from "@/components/PageHeader.vue";
import ChipSelector from "@/components/ChipSelector.vue";
import PillButton from "@/components/ui/PillButton.vue";
import StatusPill from "@/components/ui/StatusPill.vue";
import ArchiveDocumentSheet from "@/components/archive/DocumentArchivingSheet.vue";

import { useStorageAccess } from "@/composables/useStorageAccess";
import { useAppBootstrap } from "@/composables/useAppBootstrap";
import { openArchiveDocument } from "@/services/archive/archiveDocumentOpen";

import { useParties } from "@/composables/useParties";
import { useArchiveFolders } from "@/composables/archives/useArchiveFolders";
import { useTourismFolders } from "@/composables/archives/useTourismFolders";
import { useVariousFolders } from "@/composables/archives/useVariousFolders";
import { useDocumentTags } from "@/composables/archives/useDocumentTags";
import { useArchiveDocuments } from "@/composables/archives/useArchiveDocuments";
import { useArchiveFilters } from "@/composables/archives/useArchiveFilters";
import { useArchiveClassification } from "@/composables/archives/useArchiveClassification";

import { formatDate } from "@/utils/dateFormat";
import { formatAmount } from "@/utils/amountFormat";

import {
  TO_FILE_FOLDER,
  type ArchiveItem,
} from "@/contracts/archive";

import type {
  DocumentTag,
} from "@/composables/archives/useDocumentTags";
import { alertDialog } from "@/services/dialog/appDialog";

/* =========================
   Types
========================= */

interface ArchiveFolderConfig {
  id: number;
  source: string;
  label: string;
  order: number;
}

interface FolderView {
  source: string;
  label: string;
  order: number;
}

type SubFolder = {
  id: number;
  label: string;
  seqNb?: number;
};

/* =========================
   Storage access
========================= */

const {
  storageReady,
  storageUnavailableMessage,
  ensureStorageReady,
} = useStorageAccess();

/* =========================
   Bootstrap
========================= */

const {
  loadSettings,
} = useAppBootstrap();

/* =========================
   Stores
========================= */

const partiesStore =
  useParties();

const archiveFoldersStore =
  useArchiveFolders();

const tourismStore =
  useTourismFolders();

const variousStore =
  useVariousFolders();

const tagsStore =
  useDocumentTags();

/* =========================
   State
========================= */

/*
  Connexion au stockage et référentiels communs.
*/
const bootstrapping =
  ref(false);

const bootstrapped =
  ref(false);

/*
  Erreur de démarrage ou d’une action (classement,
  suppression) ; elle prime sur les erreurs de chargement.
*/
const actionError =
  ref<string | null>(null);

const filtersOpen =
  ref(true);

const selectedItem =
  ref<ArchiveItem | null>(null);

/* =========================
   Folder mapping
========================= */

const folderLabelToSourceMap =
  computed(() => {
    const map =
      new Map<string, string>();

    for (
      const folder
      of archiveFoldersStore
        .folders.value
    ) {
      map.set(
        folder.label,
        folder.source
      );
    }

    return map;
  });

const folderConfigMap =
  computed(() => {
    const map =
      new Map<
        string,
        {
          label: string;
          order: number;
        }
      >();

    for (
      const folder
      of archiveFoldersStore
        .folders.value
    ) {
      map.set(
        folder.source,
        {
          label:
            folder.label,

          order:
            folder.order,
        }
      );
    }

    return map;
  });

/*
  Dossiers proposés : tous ceux d’archiveFolders, même
  vides (environnement ou année neufs : une année n’existe
  dans le magasin qu’avec son premier document), plus ceux
  des documents chargés. « A Classer » n’apparaît que s’il
  contient des documents (toFile).
*/
const archiveFolders =
  computed<FolderView[]>(() => {
    const unique =
      new Set(
        archive.value.map(
          item => item.folder
        )
      );

    for (
      const folder
      of archiveFoldersStore
        .folders.value
    ) {
      if (folder.source !== TO_FILE_FOLDER) {
        unique.add(folder.source);
      }
    }

    return [...unique]
      .map(
        (
          folder
        ): FolderView => {
          const config =
            folderConfigMap.value.get(
              folder
            );

          if (!config) {
            console.warn(
              "No archive folder configuration for:",
              folder
            );
          }

          return {
            source:
              folder,

            label:
              config?.label ??
              folder,

            order:
              config?.order ??
              999,
          };
        }
      )
      .sort(
        (a, b) =>
          a.order - b.order
      );
  });

/* Dossier choisi sans aucun document, ou archive vide (All). */
const noDocuments =
  computed(() =>
    selectedFolder.value
      ? !archive.value.some(
          item =>
            item.folder ===
            selectedFolder.value
        )
      : archive.value.length === 0
  );

const billsFolderSource =
  computed(() => {
    const configs =
      (
        archiveFoldersStore
          .folders.value as
          ArchiveFolderConfig[]
      ) ?? [];

    const bills =
      configs.find(
        folder =>
          folder.label ===
          "Bills"
      );

    return (
      bills?.source ??
      null
    );
  });

const defaultFolder =
  computed(() => {
    const configs =
      (
        archiveFoldersStore
          .folders.value as
          ArchiveFolderConfig[]
      ) ?? [];

    const sorted =
      [...configs].sort(
        (a, b) =>
          a.order - b.order
      );

    return (
      sorted[0]?.source ??
      null
    );
  });

const folderItems =
  computed(() =>
    archiveFolders.value.map(
      folder => ({
        id:
          folder.source,

        label:
          folder.label,
      })
    )
  );

/* =========================
   Subfolders
========================= */

const selectedFolderConfig =
  computed(() =>
    archiveFoldersStore
      .folders.value
      .find(
        folder =>
          folder.source ===
          selectedFolder.value
      )
  );

const subFolders =
  computed<SubFolder[]>(() => {
    const label =
      selectedFolderConfig.value
        ?.label;

    if (label === "Tourism") {
      return tourismStore
        .folders.value;
    }

    if (label === "Various") {
      return variousStore
        .folders.value;
    }

    return [];
  });

const subFolderItems =
  computed(() =>
    subFolders.value.map(
      folder => ({
        id:
          folder.id,

        label:
          folder.label,
      })
    )
  );

/* =========================
   Party map
========================= */

const partyMap =
  computed(() => {
    const map =
      new Map<
        number,
        string
      >();

    for (
      const party
      of partiesStore
        .parties.value
    ) {
      map.set(
        party.id,
        party.label
      );
    }

    return map;
  });

function getPartyLabel(
  partyID: number
): string {
  return (
    partyMap.value.get(
      partyID
    ) ??
    `#${partyID}`
  );
}

/* =========================
   Open document
========================= */

async function openDocument(
  item: ArchiveItem
) {
  /*
    Ouverture via le proxy Tailscale : Aperçu ou disque sur
    le Mac serveur, magasin S3 archives ailleurs
    (src/services/archive/archiveDocumentOpen.ts).

    L'ancien protocole hometools:// est abandonne : impossible
    a deboguer depuis ce fichier (mecanisme natif macOS hors de
    ce codebase), et souffrait tres probablement du meme bug de
    normalisation Unicode (NFC/NFD) deja identifie et corrige
    cote proxy pour les noms de fichiers accentues.
  */
  const failure =
    await openArchiveDocument(item.physicalName);

  if (failure === null) {
    return;
  }

  await alertDialog({
    title: "Document not available",
    message: failure,
  });
}

/* =========================
   Load archive
========================= */

function folderOfLabel(
  label: string
): string {
  return (
    folderLabelToSourceMap.value.get(
      label
    ) ??
    label
  );
}

/*
  Documents de toFile.json et des fichiers d’année, après
  chaque version de l’index.
*/
const {
  items: archive,
  loading: archiveLoading,
  error: archiveError,
} = useArchiveDocuments({
  ready: bootstrapped,
  folderOfLabel,

  onLoaded: () => {
    applyDefaultFolder();

    if (
      selectedFolder.value ===
      billsFolderSource.value
    ) {
      selectDefaultPayDateForQuarter();
    }
  },
});

const loading =
  computed(() =>
    bootstrapping.value ||
    archiveLoading.value
  );

const error =
  computed(() =>
    actionError.value ??
    archiveError.value
  );

/* =========================
   Filters
========================= */

const {
  selectedFolder,
  folderChosen,
  applyDefaultFolder,
  selectedSubFolder,
  selectedDTADate,
  selectedTags,
  searchText,
  selectedQuarterOffset,
  isBillsSelected,
  activeQuarterKey,
  payDatesInActiveQuarter,
  selectDefaultPayDateForQuarter,
  toggleFilterTag,
  resetFilters,
  filteredItems,
} = useArchiveFilters({
  items: archive,
  billsFolderSource,
  defaultFolder,
  partyLabel: getPartyLabel,
});

const resultCount =
  computed(() =>
    filteredItems.value.length
  );

const headerCountLabel =
  computed(() => {
    const count =
      resultCount.value;

    return (
      `${count} document` +
      `${count !== 1 ? "s" : ""}`
    );
  });

/* =========================
   Classification sheet
========================= */

function openClassification(
  item: ArchiveItem
) {
  selectedItem.value =
    item;
}

function closeClassification() {
  selectedItem.value =
    null;
}

/*
  Classement (ARCHIVE_UPDATED) et suppression
  (ARCHIVE_DELETED) : fiche fermée si l'événement est
  écrit, sinon erreur affichée.
*/
const classification =
  useArchiveClassification({
    items: archive,
    partyLabel: getPartyLabel,
  });

function storageMissing(): boolean {
  if (storageReady.value) {
    return false;
  }

  actionError.value =
    storageUnavailableMessage.value ||
    "Storage not available.";

  return true;
}

async function saveClassification(
  updated: ArchiveItem
) {
  if (storageMissing()) {
    return;
  }

  const failure =
    await classification.save(updated);

  if (failure === null) {
    closeClassification();
  } else {
    actionError.value =
      failure;
  }
}

async function deleteDocument(
  payload: {
    tocid: number;
  }
) {
  if (storageMissing()) {
    return;
  }

  const failure =
    await classification.remove(payload.tocid);

  if (failure === null) {
    closeClassification();
  } else {
    actionError.value =
      failure;
  }
}

/* =========================
   Row click
========================= */

function rowClick(
  event: MouseEvent,
  item: ArchiveItem
) {
  const element =
    event.target as HTMLElement;

  if (
    element.closest(
      ".classify-btn"
    )
  ) {
    return;
  }

  openDocument(item);
}

/* =========================
   Tags
========================= */

const tagMap =
  computed(() => {
    const map =
      new Map<
        number,
        DocumentTag
      >();

    for (
      const tag
      of tagsStore.tags.value
    ) {
      map.set(
        tag.id,
        tag
      );
    }

    return map;
  });

const tooltip =
  ref<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

let tooltipTimer:
  ReturnType<
    typeof setTimeout
  > | null = null;

function showTagTooltip(
  event: MouseEvent,
  tagID: number
) {
  const tag =
    tagMap.value.get(
      tagID
    );

  if (!tag) {
    return;
  }

  const target =
    event.currentTarget as
      HTMLElement;

  const rect =
    target.getBoundingClientRect();

  tooltip.value = {
    text:
      tag.tagName,

    x:
      rect.left +
      rect.width / 2,

    y:
      rect.top - 8,
  };

  if (
    tooltipTimer
  ) {
    clearTimeout(
      tooltipTimer
    );
  }

  tooltipTimer =
    setTimeout(
      () => {
        tooltip.value =
          null;

        tooltipTimer =
          null;
      },

      2000
    );
}

function hideTagTooltip() {
  if (
    tooltipTimer
  ) {
    clearTimeout(
      tooltipTimer
    );

    tooltipTimer =
      null;
  }

  tooltip.value =
    null;
}

/* =========================
   Formatting
========================= */

function escapeRegExp(
  value: string
): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function highlight(
  text:
    | string
    | null
    | undefined
): string {
  if (!text) {
    return "";
  }

  const query =
    searchText.value.trim();

  if (!query) {
    return text;
  }

  const safeQuery =
    escapeRegExp(
      query
    );

  const regex =
    new RegExp(
      `(${safeQuery})`,
      "gi"
    );

  return text.replace(
    regex,
    "<mark>$1</mark>"
  );
}

/* =========================
   Initialize
========================= */

async function initializeView() {
  if (
    bootstrapping.value ||
    bootstrapped.value
  ) {
    return;
  }

  bootstrapping.value =
    true;

  actionError.value =
    null;

  try {
    const ready =
      await ensureStorageReady();

    if (!ready) {
      return;
    }

    await loadSettings();

    applyDefaultFolder();

    bootstrapped.value =
      true;

  } catch (err) {
    console.error(
      "Archive initialization failed",
      err
    );

    actionError.value =
      err instanceof Error
        ? err.message
        : String(err);

  } finally {
    bootstrapping.value =
      false;
  }
}

watch(
  storageReady,

  async (ready, wasReady) => {
    if (!ready) {
      bootstrapped.value =
        false;

      /* Changement de backend : retour au dossier par défaut. */
      if (wasReady) {
        selectedFolder.value =
          null;

        folderChosen.value =
          false;
      }

      return;
    }

    await initializeView();
  },

  {
    immediate:
      true,
  }
);

/* =========================
   Cleanup
========================= */

onBeforeUnmount(() => {
  hideTagTooltip();
});
</script>

<template>
  <div class="sticky-stack">
    <PageHeader
      title="Documents"
      icon="bookshelf"
    />

    <div
      v-if="!storageReady"
      class="archives-view muted"
    >
      {{
        storageUnavailableMessage ||
        "Storage not available."
      }}
    </div>

    <div v-else>
      <section class="filters">
        <header
          class="filters-header clickable"
          @click="
            filtersOpen =
              !filtersOpen
          "
        >
          <span class="arrow">
            {{
              filtersOpen
                ? "▼"
                : "►"
            }}
          </span>

          <span class="filters-title">
            Filters
          </span>

          <PillButton
            v-if="filtersOpen"
            @click.stop="
              resetFilters
            "
          >
            Reset
          </PillButton>
        </header>

        <div
          v-if="filtersOpen"
          class="filters-body"
        >
          <ChipSelector
            v-model="selectedFolder"
            label="Documents"
            :items="folderItems"
            :show-all="true"
            :align-with-content="true"
          />

          <ChipSelector
            v-if="
              subFolderItems.length
            "
            v-model="
              selectedSubFolder
            "
            label="Type"
            :items="
              subFolderItems
            "
            :show-all="true"
            :align-with-content="
              true
            "
          />

          <div
            v-if="
              tagsStore.tags.value
                .length
            "
            class="filter-row with-label"
          >
            <span class="filter-label">
              Tags
            </span>

            <div class="chip-line">
              <button
                type="button"
                class="chip"
                :class="{
                  active:
                    selectedTags
                      .length === 0
                }"
                @click="
                  selectedTags = []
                "
              >
                None
              </button>

              <div
                v-for="
                  tag
                  in tagsStore.tags.value
                "
                :key="tag.id"
                class="tag-dot"
                :class="{
                  active:
                    selectedTags.includes(
                      tag.id
                    )
                }"
                :style="{
                  backgroundColor:
                    tag.color
                }"
                @click="
                  toggleFilterTag(
                    tag.id
                  )
                "
                @mouseenter="
                  showTagTooltip(
                    $event,
                    tag.id
                  )
                "
                @mouseleave="
                  hideTagTooltip
                "
              ></div>
            </div>
          </div>

          <div
            v-if="
              isBillsSelected
            "
            class="filter-row paydate-row"
          >
            <span class="filter-label">
              Pay date
            </span>

            <div class="paydate-content">
              <div class="quarter-capsule">
                <span
                  class="arrow-nav"
                  @click="
                    selectedQuarterOffset--
                  "
                >
                  ‹
                </span>

                <span class="quarter-title">
                  {{ activeQuarterKey }}
                </span>

                <span
                  class="arrow-nav"
                  @click="
                    selectedQuarterOffset++
                  "
                >
                  ›
                </span>
              </div>

              <div class="chip-scroll">
                <button
                  v-for="
                    date
                    in payDatesInActiveQuarter
                  "
                  :key="date"
                  type="button"
                  class="chip"
                  :class="{
                    active:
                      selectedDTADate ===
                      date
                  }"
                  @click="
                    selectedDTADate =
                      date
                  "
                >
                  {{
                    formatDate(
                      date,
                      "text"
                    )
                  }}
                </button>
              </div>
            </div>
          </div>

          <div class="filter-row with-label">
            <span class="filter-label">
              Search
            </span>

            <input
              v-model="searchText"
              type="text"
              placeholder="Search info..."
            />
          </div>
        </div>
      </section>

      <div class="archive-counter-wrapper">
        <div class="archive-separator"></div>

        <div class="archive-counter">
          <StatusPill tone="primary">
            {{ headerCountLabel }}
          </StatusPill>
        </div>

        <div class="archive-separator"></div>
      </div>
    </div>
  </div>

  <div
    v-if="storageReady"
    class="archives-table-wrapper"
  >
    <div
      v-if="loading"
      class="archives-view muted"
    >
      Loading…
    </div>

    <div
      v-else-if="error"
      class="archives-view error"
    >
      {{ error }}
    </div>

    <table
      v-else-if="
        filteredItems.length
      "
      class="archive-table"
    >
      <colgroup>
        <col
          class="col-action"
          style="width: 35px"
        >

        <col
          class="col-date"
          style="width: 110px"
        >

        <col class="col-party">
        <col class="col-info1">
        <col class="col-info2">

        <col
          v-if="isBillsSelected"
          class="col-dta"
          style="width: 125px"
        >

        <col
          v-if="isBillsSelected"
          class="col-amount"
        >
      </colgroup>

      <thead>
        <tr>
          <th class="col-action"></th>
          <th class="col-date">Date</th>
          <th class="col-party">Party</th>
          <th class="col-info1">Info1</th>
          <th class="col-info2">Info2</th>

          <th
            v-if="isBillsSelected"
            class="col-dta"
          >
            DTA
          </th>

          <th
            v-if="isBillsSelected"
            class="col-amount"
          >
            Amount
          </th>
        </tr>
      </thead>

      <tbody>
        <tr
          v-for="
            item
            in filteredItems
          "
          :key="item.tocid"
          class="clickable-row"
          @click="
            rowClick(
              $event,
              item
            )
          "
        >
          <td class="col-action">
            <button
              type="button"
              class="classify-btn"
              @click.stop="
                openClassification(
                  item
                )
              "
            >
              📂
            </button>
          </td>

          <td class="col-date">
            {{
              formatDate(
                item.documentDate,
                "text"
              )
            }}
          </td>

          <td
            class="col-party"
            v-html="
              highlight(
                getPartyLabel(
                  item.partyID
                )
              )
            "
          ></td>

          <td
            class="col-info1"
            v-html="
              highlight(
                item.info1
              )
            "
          ></td>

          <td class="col-info2">
            <div class="info2-cell">
              <span
                class="info2-text"
                v-html="
                  highlight(
                    item.info2
                  )
                "
              ></span>

              <span
                v-if="
                  item.tagIDs?.length
                "
                class="tag-squares"
              >
                <span
                  v-for="
                    tagID
                    in item.tagIDs
                  "
                  :key="tagID"
                  class="tag-square"
                  :style="{
                    backgroundColor:
                      tagMap.get(
                        tagID
                      )?.color ??
                      '#ccc'
                  }"
                  @mouseenter="
                    showTagTooltip(
                      $event,
                      tagID
                    )
                  "
                  @mouseleave="
                    hideTagTooltip
                  "
                ></span>
              </span>
            </div>
          </td>

          <td
            v-if="isBillsSelected"
            class="col-dta"
          >
            <span
              v-if="
                item.indicatorDTA ===
                1
              "
              class="dta-badge"
            >
              {{
                formatDate(
                  item.dtaDate,
                  "text"
                )
              }}
            </span>
          </td>

          <td
            v-if="isBillsSelected"
            class="col-amount"
          >
            {{
              formatAmount(
                item.refAmount
              )
            }}
          </td>
        </tr>
      </tbody>
    </table>

    <div
      v-else
      class="empty-state"
    >
      {{ noDocuments ? "No documents" : "Check filters" }}
    </div>
  </div>

  <ArchiveDocumentSheet
    v-if="selectedItem"
    :doc="selectedItem"
    @close="
      closeClassification
    "
    @save="
      saveClassification
    "
    @delete="
      deleteDocument
    "
  />

  <div
    v-if="tooltip"
    class="tag-tooltip"
    :style="{
      left:
        tooltip.x +
        'px',

      top:
        tooltip.y +
        'px'
    }"
  >
    {{ tooltip.text }}
  </div>
</template>

<style scoped>
/* =========================================================
   BASE LAYOUT
========================================================= */

.sticky-stack {
  position: sticky;
  top: 0;
  z-index: 100;

  border-bottom:
    1px solid
    var(--border);

  padding-bottom:
    4px;

  backdrop-filter:
    blur(6px);

  background:
    color-mix(
      in srgb,
      var(--bg) 92%,
      transparent
    );

  --sticky-offset:
    0px;
}

/* =========================================================
   FILTER HEADER
========================================================= */

.filters-header {
  padding:
    0.5rem;

  display:
    flex;

  align-items:
    center;

  gap:
    0.5rem;
}

.filters-title {
  font-size:
    var(--font-size-sm);

  font-weight:
    600;

  color:
    var(--text-soft);
}

/* =========================================================
   FILTERS
========================================================= */

.filters-body {
  padding:
    6px 12px 8px;

  display:
    flex;

  flex-direction:
    column;

  gap:
    10px;
}

.filter-row.with-label {
  display:
    grid;

  grid-template-columns:
    90px
    minmax(0, 1fr);

  align-items:
    center;

  gap:
    0.75rem;
}

.filter-label {
  font-size:
    0.85rem;

  font-weight:
    500;

  color:
    var(--text-soft);
}

.filter-row input {
  box-sizing:
    border-box;

  width:
    100%;

  max-width:
    420px;

  padding:
    7px 10px;

  border:
    1px solid
    var(--border);

  border-radius:
    8px;

  background:
    var(--surface);

  color:
    var(--text);

  font-family:
    inherit;
}

.filter-row input:focus {
  outline:
    none;

  border-color:
    var(--primary);

  box-shadow:
    0 0 0 2px
    var(--primary-soft);
}

/* =========================================================
   EMPTY / STATES
========================================================= */

.archives-view {
  padding:
    1rem;
}

.empty-state {
  padding:
    1rem;

  text-align:
    center;

  font-size:
    1.05rem;

  color:
    var(--positive);

  font-style:
    italic;
}

/* =========================================================
   CHIPS
========================================================= */

.chip {
  padding:
    6px 10px;

  border-radius:
    999px;

  border:
    1px solid
    var(--border);

  background:
    var(--surface);

  color:
    var(--text);

  font-size:
    0.75rem;

  font-weight:
    600;

  opacity:
    0.7;

  cursor:
    pointer;

  white-space:
    nowrap;

  transition:
    all 0.15s ease;
}

.chip:hover {
  opacity:
    0.9;
}

.chip.active {
  opacity:
    1;

  background:
    var(--primary-soft);

  border-color:
    var(--primary);

  color:
    var(--primary);
}

.chip-line {
  display:
    flex;

  gap:
    6px;

  flex-wrap:
    wrap;

  align-items:
    center;
}

/* =========================================================
   TAG FILTERS
========================================================= */

.tag-dot {
  width:
    18px;

  height:
    18px;

  border-radius:
    5px;

  border:
    1px solid
    var(--border);

  cursor:
    pointer;

  opacity:
    0.75;

  transition:
    all 0.15s ease;

  display:
    inline-flex;
}

.tag-dot:hover {
  opacity:
    1;

  transform:
    scale(1.1);
}

.tag-dot.active {
  opacity:
    1;

  border:
    2px solid
    var(--primary);

  transform:
    scale(1.15);
}

.chip + .tag-dot {
  margin-left:
    4px;
}

/* =========================================================
   PAY DATE
========================================================= */

.paydate-row {
  display:
    grid;

  grid-template-columns:
    90px
    minmax(0, 1fr);

  align-items:
    center;

  gap:
    0.75rem;
}

.paydate-content {
  display:
    flex;

  align-items:
    center;

  gap:
    0.75rem;

  min-width:
    0;

  width:
    100%;
}

.quarter-capsule {
  display:
    inline-flex;

  align-items:
    center;

  gap:
    6px;

  padding:
    4px 10px;

  border-radius:
    999px;

  border:
    1px solid
    var(--primary);

  background:
    var(--primary-soft);

  color:
    var(--primary);

  font-size:
    var(--font-size-xs);

  font-weight:
    600;

  flex:
    0 0 auto;
}

.arrow-nav {
  opacity:
    0.6;

  cursor:
    pointer;

  padding:
    0 2px;

  transition:
    opacity 0.15s;
}

.arrow-nav:hover {
  opacity:
    1;
}

.chip-scroll {
  display:
    flex;

  gap:
    6px;

  overflow-x:
    auto;

  min-width:
    0;

  flex:
    1 1 auto;
}

/* =========================================================
   COUNTER
========================================================= */

.archive-counter-wrapper {
  margin-top:
    4px;
}

.archive-separator {
  height:
    1px;

  background:
    var(--border);
}

.archive-counter {
  display:
    flex;

  justify-content:
    center;

  padding:
    4px 0;
}

/* =========================================================
   TABLE WRAPPER
========================================================= */

.archives-table-wrapper {
  height:
    calc(100vh - 220px);

  overflow-y:
    auto;

  padding:
    0 1.5rem 1.5rem;

  scrollbar-gutter:
    stable;
}

/* =========================================================
   TABLE
========================================================= */

.archive-table {
  width:
    100%;

  table-layout:
    fixed;

  font-size:
    0.85rem;
}

.archive-table col.col-party {
  width:
    auto;
}

.archive-table col.col-info1 {
  width:
    auto;
}

.archive-table col.col-info2 {
  width:
    auto;
}

.archive-table col.col-dta {
  width:
    100px;
}

.archive-table col.col-amount {
  width:
    80px;
}

.archive-table thead th {
  position:
    sticky;

  top:
    var(--sticky-offset);

  z-index:
    50;

  border-bottom:
    1px solid
    var(--border);

  font-weight:
    700;

  background:
    color-mix(
      in srgb,
      var(--bg) 96%,
      transparent
    );
}

.archive-table th,
.archive-table td {
  padding:
    0.5rem 0.6rem;

  border-bottom:
    1px solid
    var(--border);

  vertical-align:
    middle;

  white-space:
    nowrap;

  overflow:
    hidden;

  text-overflow:
    ellipsis;
}

.archive-table th.col-date,
.archive-table td.col-date,
.archive-table th.col-dta,
.archive-table td.col-dta {
  text-align:
    center;
}

.archive-table th.col-party,
.archive-table td.col-party,
.archive-table th.col-info1,
.archive-table td.col-info1,
.archive-table th.col-info2,
.archive-table td.col-info2 {
  text-align:
    left;
}

.archive-table th.col-amount,
.archive-table td.col-amount {
  text-align:
    right;

  font-variant-numeric:
    tabular-nums;
}

/* =========================================================
   ROWS
========================================================= */

.clickable-row {
  cursor:
    pointer;

  transition:
    background 0.15s ease;
}

.clickable-row:hover {
  background:
    var(--primary-soft);
}

/* =========================================================
   CELLS
========================================================= */

.col-action {
  width:
    30px;

  text-align:
    center;
}

.classify-btn {
  border:
    none;

  background:
    transparent;

  cursor:
    pointer;

  font-size:
    16px;

  opacity:
    0.7;
}

.classify-btn:hover {
  opacity:
    1;
}

.dta-badge {
  padding:
    2px 6px;

  border-radius:
    6px;

  background:
    var(--primary-soft);

  color:
    var(--primary);

  font-size:
    0.75rem;
}

/* =========================================================
   TAGS
========================================================= */

.info2-cell {
  display:
    flex;

  align-items:
    center;

  justify-content:
    space-between;

  gap:
    8px;
}

.info2-text {
  min-width:
    0;

  flex:
    1 1 auto;
}

.tag-squares {
  flex:
    0 0 auto;

  display:
    inline-flex;

  align-items:
    center;

  gap:
    4px;
}

.tag-square {
  width:
    11px;

  height:
    11px;

  border-radius:
    2px;

  border:
    1px solid
    var(--border);

  box-shadow:
    inset 0 0 0 1px
    rgba(255, 255, 255, 0.1);

  cursor:
    pointer;
}

/* =========================================================
   TOOLTIP
========================================================= */

.tag-tooltip {
  position:
    fixed;

  transform:
    translate(-50%, -100%);

  padding:
    4px 8px;

  border-radius:
    6px;

  background:
    var(--surface);

  color:
    var(--text);

  font-size:
    0.75rem;

  white-space:
    nowrap;

  pointer-events:
    none;

  z-index:
    3000;

  box-shadow:
    var(--shadow-sm);
}

/* =========================================================
   MISC
========================================================= */

mark {
  background:
    var(--primary-soft);

  color:
    var(--primary);

  padding:
    0 2px;

  border-radius:
    3px;
}

.muted {
  opacity:
    0.6;
}

.error {
  color:
    var(--negative);
}
</style>