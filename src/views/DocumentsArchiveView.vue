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
import ArchiveTable from "@/components/archive/ArchiveTable.vue";
import TagTooltip from "@/components/archive/TagTooltip.vue";

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
import { useTagTooltip } from "@/composables/archives/useTagTooltip";

import { formatDate } from "@/utils/dateFormat";

import {
  TO_FILE_FOLDER,
  type ArchiveItem,
} from "@/contracts/archive";

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
   Tags
========================= */

const {
  showTagTooltip,
  hideTagTooltip,
} = useTagTooltip();

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
  <!--
    Page à la hauteur de la fenêtre : filtres en haut, seule
    la liste défile (en-tête du tableau collé en haut).
  -->
  <div class="archives-page">
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

      <ArchiveTable
        v-else-if="
          filteredItems.length
        "
        :items="filteredItems"
        :bills="isBillsSelected"
        :search-text="searchText"
        :party-label="getPartyLabel"
        @open="openDocument"
        @classify="openClassification"
      />

      <div
        v-else
        class="empty-state"
      >
        {{ noDocuments ? "No documents" : "Check filters" }}
      </div>
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

  <TagTooltip />
</template>

<style scoped>
/* =========================================================
   BASE LAYOUT
========================================================= */

/*
  Hauteur de la fenêtre : les filtres (hauteur variable :
  date de paiement, tags…) gardent leur place, la liste
  prend le reste et défile seule.
*/
.archives-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
}

.sticky-stack {
  flex: 0 0 auto;
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
  flex:
    1 1 auto;

  min-height:
    0;

  overflow-y:
    auto;

  padding:
    0 1.5rem 1.5rem;

  scrollbar-gutter:
    stable;
}

/* =========================================================
   MISC
========================================================= */

.muted {
  opacity:
    0.6;
}

.error {
  color:
    var(--negative);
}
</style>