<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  ref,
  watch,
} from "vue";

import PageHeader from "@/components/PageHeader.vue";
import ChipSelector from "@/components/ChipSelector.vue";
import ArchiveDocumentSheet from "@/components/archive/DocumentArchivingSheet.vue";

import { useStorageAccess } from "@/composables/useStorageAccess";
import { useAppBootstrap } from "@/composables/useAppBootstrap";
import { useDriveJsonFile } from "@/composables/useDriveJsonFile";
import { useDriveWatcher } from "@/composables/useDriveWatcher";
import { prefixEventFileName } from "@/utils/eventFileName";

import { useParties } from "@/composables/useParties";
import { useArchiveFolders } from "@/composables/archives/useArchiveFolders";
import { useTourismFolders } from "@/composables/archives/useTourismFolders";
import { useVariousFolders } from "@/composables/archives/useVariousFolders";
import { useDocumentTags } from "@/composables/archives/useDocumentTags";

import {
  loadJSONFromFolder,
} from "@/services/driveAdapter";

import { formatDate } from "@/utils/dateFormat";
import { formatAmount } from "@/utils/amountFormat";

import type {
  DocumentTag,
} from "@/composables/archives/useDocumentTags";

/* =========================
   Types
========================= */

interface ArchiveItem {
  tocid: number;
  folder: string;
  documentDate: string;
  dtaDate: string | null;
  info1: string;
  info2: string;
  indicatorDTA: number;
  physicalName: string;
  partyID: number;
  refAmount: number;
  googleFileId: string;
  tagIDs?: number[];
  sourceBucket?: string;
}

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

interface ArchiveIndex {
  years?: number[];
  foldersUpdated?: string[];
}

interface ArchiveBucketFile {
  items?: ArchiveItem[];
  groups?: Record<
    string,
    {
      items?: ArchiveItem[];
    }
  >;
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
  backend,
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

const loading =
  ref(false);

const error =
  ref<string | null>(null);

const initialized =
  ref(false);

const archive =
  ref<ArchiveItem[]>([]);

const indexLastModified =
  ref<string | null>(null);

const filtersOpen =
  ref(true);

const selectedFolder =
  ref<string | null>(null);

const selectedSubFolder =
  ref<number | null>(null);

const selectedDTADate =
  ref<string | null>(null);

const selectedTags =
  ref<number[]>([]);

const searchText =
  ref("");

const selectedQuarterOffset =
  ref(0);

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

const archiveFolders =
  computed<FolderView[]>(() => {
    const unique =
      [
        ...new Set(
          archive.value.map(
            item => item.folder
          )
        ),
      ];

    return unique
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
   Visibility rules
========================= */

const isPayDateVisible =
  computed(() =>
    selectedFolder.value ===
    billsFolderSource.value
  );

const isBillsSelected =
  computed(() =>
    selectedFolder.value ===
    billsFolderSource.value
  );

/* =========================
   Folder watcher
========================= */

watch(
  selectedFolder,
  value => {
    selectedSubFolder.value =
      null;

    if (
      value ===
      billsFolderSource.value
    ) {
      selectedTags.value =
        [];

      selectedQuarterOffset.value =
        0;

      selectDefaultPayDateForQuarter();

    } else {
      selectedDTADate.value =
        null;
    }
  }
);

/* =========================
   Platform detection
========================= */

function isRealMacDesktop():
  boolean {
  const userAgent =
    navigator.userAgent;

  const isMac =
    userAgent.includes(
      "Macintosh"
    );

  const isTouch =
    navigator.maxTouchPoints >
    1;

  return (
    isMac &&
    !isTouch
  );
}

/* =========================
   Open document
========================= */

function openLocalDocument(
  item: ArchiveItem
): boolean {
  if (
    !isRealMacDesktop() ||
    !item.physicalName
  ) {
    return false;
  }

  const url =
    "hometools://open?file=" +
    encodeURIComponent(
      item.physicalName
    );

  window.location.href =
    url;

  return true;
}

function openGoogleDocument(
  item: ArchiveItem
): boolean {
  if (!item.googleFileId) {
    return false;
  }

  const driveUrl =
    "https://drive.google.com/file/d/" +
    encodeURIComponent(
      item.googleFileId
    ) +
    "/view";

  window.open(
    driveUrl,
    "_blank",
    "noopener"
  );

  return true;
}

function isIOSStandalonePWA(): boolean {
  /*
    navigator.standalone est une propriete non-standard
    specifique a iOS Safari, vraie uniquement lorsque la
    PWA a ete ajoutee a l'ecran d'accueil et est lancee en
    mode standalone (pas d'UI de navigateur, pas d'onglets).
  */
  const standalone =
    (window.navigator as unknown as {
      standalone?: boolean;
    }).standalone;

  return standalone === true;
}

/*
  archives-prod est desormais un bucket PRIVE : il n'y a plus
  d'URL publique directe. La lecture passe par le proxy local
  (Tailscale), authentifiee par la meme cle que hometools-prod,
  sur l'endpoint binaire dedie /api/archives/read.
*/
async function fetchArchiveDocumentUrl(
  physicalName: string
): Promise<string> {
  const proxyUrl =
    import.meta.env.VITE_PROXY_URL as string | undefined;

  const proxyApiKey =
    import.meta.env.VITE_PROXY_API_KEY as string | undefined;

  if (!proxyUrl || !proxyApiKey) {
    throw new Error(
      "Missing VITE_PROXY_URL or VITE_PROXY_API_KEY"
    );
  }

  const base =
    proxyUrl.replace(/\/+$/, "");

  const url =
    new URL(base + "/api/archives/read");

  url.searchParams.set(
    "key",
    physicalName
  );

  const response =
    await fetch(url.toString(), {
      headers: {
        "X-Proxy-Key":
          proxyApiKey,
      },
    });

  if (!response.ok) {
    throw new Error(
      `Archive read failed: HTTP ${response.status} for ${physicalName}`
    );
  }

  const blob =
    await response.blob();

  /*
    L'URL blob:// generee ici n'est valide que dans cet onglet
    et est liberee automatiquement par le navigateur a sa
    fermeture - pas besoin de revokeObjectURL manuel pour ce
    cas d'usage ponctuel (ouverture d'un document).
  */
  return URL.createObjectURL(blob);
}

async function openS3Document(
  item: ArchiveItem
): Promise<boolean> {
  if (!item.physicalName) {
    return false;
  }

  try {
    const objectUrl =
      await fetchArchiveDocumentUrl(
        item.physicalName
      );

    if (isIOSStandalonePWA()) {
      /*
        window.open() est notoirement peu fiable dans une PWA
        iOS installee en mode standalone : il n'y a pas de
        notion d'onglet vers laquelle ouvrir une nouvelle
        fenetre, et l'appel echoue souvent silencieusement.

        Naviguer directement dans la fenetre courante est le
        contournement le plus robuste pour ce cas precis.
      */
      window.location.href =
        objectUrl;

      return true;
    }

    window.open(
      objectUrl,
      "_blank",
      "noopener"
    );

    return true;

  } catch (err) {
    console.error(
      "Failed to open archive document",
      err
    );

    return false;
  }
}

async function openDocument(
  item: ArchiveItem
) {
  /*
    Document opening strategy:

    - Mac desktop:
      open the physical local archive
      through the hometools:// protocol.

    - Google Drive:
      open the PDF through googleFileId.

    - Object Storage (iPad / browser):
      fetch the PDF through the local
      Tailscale proxy (archives-prod is
      now a private bucket).
  */

  if (
    openLocalDocument(item)
  ) {
    return;
  }

  if (
    backend.value ===
    "GOOGLE_DRIVE"
  ) {
    if (
      openGoogleDocument(item)
    ) {
      return;
    }
  }

  if (
    backend.value ===
    "OBJECT_STORAGE"
  ) {
    if (
      await openS3Document(item)
    ) {
      return;
    }
  }

  alert(
    "This document is not available on this device."
  );
}

/* =========================
   Archive mapping
========================= */

function mapToFileItems(
  data: ArchiveBucketFile | null
): ArchiveItem[] {
  if (!data?.items) {
    return [];
  }

  return data.items.map(
    item => ({
      ...item,

      folder:
        "A Classer",

      sourceBucket:
        "toFile",
    })
  );
}

function mapYearItems(
  data: ArchiveBucketFile | null,
  year: string
): ArchiveItem[] {
  if (!data?.groups) {
    return [];
  }

  const output:
    ArchiveItem[] = [];

  for (
    const [
      groupName,
      group,
    ]
    of Object.entries(
      data.groups
    )
  ) {
    const items =
      group.items ?? [];

    output.push(
      ...items.map(
        item => ({
          ...item,

          folder:
            folderLabelToSourceMap
              .value
              .get(groupName) ??
            groupName,

          sourceBucket:
            year,
        })
      )
    );
  }

  return output;
}

/* =========================
   Load archive
========================= */

async function loadArchive() {
  if (!storageReady.value) {
    return;
  }

  loading.value =
    true;

  error.value =
    null;

  try {
    const index =
      await loadJSONFromFolder<
        ArchiveIndex
      >(
        "archive",
        "index.json"
      );

    if (!index) {
      throw new Error(
        "Archive index not loaded"
      );
    }

    const years =
      index.years ?? [];

    const allItems:
      ArchiveItem[] = [];

    const toFile =
      await loadJSONFromFolder<
        ArchiveBucketFile
      >(
        "archive",
        "toFile.json"
      );

    allItems.push(
      ...mapToFileItems(
        toFile
      )
    );

    for (
      const year
      of years
    ) {
      const data =
        await loadJSONFromFolder<
          ArchiveBucketFile
        >(
          "archive",
          `${year}.json`
        );

      allItems.push(
        ...mapYearItems(
          data,
          String(year)
        )
      );
    }

    archive.value =
      allItems;

    if (
      selectedFolder.value ===
      null
    ) {
      selectedFolder.value =
        defaultFolder.value;
    }

    if (
      selectedFolder.value ===
      billsFolderSource.value
    ) {
      selectDefaultPayDateForQuarter();
    }

  } catch (err) {
    console.error(
      "Archive loading failed",
      err
    );

    error.value =
      err instanceof Error
        ? err.message
        : "Failed to load archive";

  } finally {
    loading.value =
      false;
  }
}

/* =========================
   Smart reload
========================= */

async function smartReload(
  index: ArchiveIndex
) {
  const foldersUpdated =
    index.foldersUpdated ??
    [];

  if (
    foldersUpdated.length ===
    0
  ) {
    console.log(
      "Archive full reload"
    );

    await loadArchive();

    return;
  }

  console.log(
    "Archive smart reload:",
    foldersUpdated
  );

  const updatedItems:
    ArchiveItem[] = [];

  for (
    const folder
    of foldersUpdated
  ) {
    if (
      folder ===
      "toFile"
    ) {
      const toFile =
        await loadJSONFromFolder<
          ArchiveBucketFile
        >(
          "archive",
          "toFile.json"
        );

      updatedItems.push(
        ...mapToFileItems(
          toFile
        )
      );

      continue;
    }

    if (
      /^\d{4}$/.test(
        folder
      )
    ) {
      const data =
        await loadJSONFromFolder<
          ArchiveBucketFile
        >(
          "archive",
          `${folder}.json`
        );

      updatedItems.push(
        ...mapYearItems(
          data,
          folder
        )
      );
    }
  }

  archive.value = [
    ...archive.value.filter(
      item =>
        !foldersUpdated.includes(
          item.sourceBucket ??
          ""
        )
    ),

    ...updatedItems,
  ];

  if (
    selectedFolder.value ===
    billsFolderSource.value
  ) {
    selectDefaultPayDateForQuarter();
  }

  console.log(
    "Archive smart reload completed"
  );
}

/* =========================
   Quarter logic
========================= */

function getQuarterKey(
  dateString: string
): string {
  const [
    year,
    month,
  ] =
    dateString
      .split("-")
      .map(Number);

  const quarter =
    Math.floor(
      (month - 1) / 3
    ) + 1;

  return (
    `${year} Q${quarter}`
  );
}

function getCurrentQuarterKey():
  string {
  const now =
    new Date();

  const quarter =
    Math.floor(
      now.getMonth() / 3
    ) + 1;

  return (
    `${now.getFullYear()} Q${quarter}`
  );
}

const payDatesByQuarter =
  computed(() => {
    const map =
      new Map<
        string,
        string[]
      >();

    for (
      const item
      of archive.value
    ) {
      if (!item.dtaDate) {
        continue;
      }

      const key =
        getQuarterKey(
          item.dtaDate
        );

      if (!map.has(key)) {
        map.set(
          key,
          []
        );
      }

      map.get(key)!
        .push(
          item.dtaDate
        );
    }

    for (
      const [
        key,
        dates,
      ]
      of map
    ) {
      const unique =
        [
          ...new Set(
            dates
          ),
        ];

      unique.sort(
        (a, b) =>
          b.localeCompare(a)
      );

      map.set(
        key,
        unique
      );
    }

    return map;
  });

const availableQuarters =
  computed(() =>
    [
      ...payDatesByQuarter
        .value
        .keys(),
    ]
      .sort()
      .reverse()
  );

const activeQuarterIndex =
  computed(() => {
    if (
      availableQuarters
        .value.length ===
      0
    ) {
      return -1;
    }

    const index =
      availableQuarters
        .value
        .indexOf(
          getCurrentQuarterKey()
        );

    return (
      index === -1
        ? 0
        : index
    );
  });

const activeQuarterKey =
  computed(() => {
    if (
      availableQuarters
        .value.length ===
      0
    ) {
      return null;
    }

    const base =
      activeQuarterIndex.value;

    const shifted =
      base +
      selectedQuarterOffset.value;

    if (
      shifted < 0 ||
      shifted >=
        availableQuarters
          .value.length
    ) {
      return (
        availableQuarters
          .value[base]
      );
    }

    return (
      availableQuarters
        .value[shifted]
    );
  });

const payDatesInActiveQuarter =
  computed(() => {
    if (
      !activeQuarterKey.value
    ) {
      return [];
    }

    return (
      payDatesByQuarter
        .value
        .get(
          activeQuarterKey.value
        ) ??
      []
    );
  });

watch(
  activeQuarterKey,
  () => {
    selectDefaultPayDateForQuarter();
  }
);

function todayISO():
  string {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

function selectDefaultPayDateForQuarter() {
  const quarter =
    activeQuarterKey.value;

  if (!quarter) {
    return;
  }

  const dates =
    payDatesByQuarter
      .value
      .get(quarter) ??
    [];

  if (
    dates.length === 0
  ) {
    return;
  }

  if (
    quarter ===
    getCurrentQuarterKey()
  ) {
    const ascending =
      [...dates].sort(
        (a, b) =>
          a.localeCompare(b)
      );

    const next =
      ascending.find(
        date =>
          date >= todayISO()
      );

    selectedDTADate.value =
      next ??
      ascending[
        ascending.length - 1
      ];

    return;
  }

  selectedDTADate.value =
    dates[0];
}

/* =========================
   Tag filters
========================= */

function toggleFilterTag(
  id: number
) {
  const index =
    selectedTags.value.indexOf(
      id
    );

  if (index >= 0) {
    selectedTags.value.splice(
      index,
      1
    );
  } else {
    selectedTags.value.push(
      id
    );
  }
}

/* =========================
   Filtering
========================= */

function resetFilters() {
  selectedFolder.value =
    defaultFolder.value;

  selectedSubFolder.value =
    null;

  selectedDTADate.value =
    null;

  selectedTags.value =
    [];

  searchText.value =
    "";

  selectedQuarterOffset.value =
    0;

  if (
    selectedFolder.value ===
    billsFolderSource.value
  ) {
    selectDefaultPayDateForQuarter();
  }
}

const filteredItems =
  computed(() => {
    return archive.value
      .filter(item => {
        if (
          selectedFolder.value &&
          item.folder !==
            selectedFolder.value
        ) {
          return false;
        }

        if (
          selectedSubFolder.value &&
          item.partyID !==
            selectedSubFolder.value
        ) {
          return false;
        }

        if (
          isPayDateVisible.value &&
          selectedDTADate.value &&
          item.dtaDate !==
            selectedDTADate.value
        ) {
          return false;
        }

        const query =
          searchText.value
            .trim()
            .toLowerCase();

        if (query) {
          const party =
            getPartyLabel(
              item.partyID
            ).toLowerCase();

          const info1 =
            item.info1
              ?.toLowerCase() ??
            "";

          const info2 =
            item.info2
              ?.toLowerCase() ??
            "";

          if (
            !party.includes(
              query
            ) &&
            !info1.includes(
              query
            ) &&
            !info2.includes(
              query
            )
          ) {
            return false;
          }
        }

        const itemTags =
          item.tagIDs ?? [];

        if (
          isBillsSelected.value
        ) {
          if (
            selectedTags.value
              .length === 0
          ) {
            if (
              itemTags.includes(7)
            ) {
              return false;
            }

          } else {
            const hasMatch =
              selectedTags.value
                .some(
                  tagID =>
                    itemTags.includes(
                      tagID
                    )
                );

            if (!hasMatch) {
              return false;
            }
          }

        } else if (
          selectedTags.value
            .length > 0
        ) {
          const hasMatch =
            selectedTags.value
              .some(
                tagID =>
                  itemTags.includes(
                    tagID
                  )
              );

          if (!hasMatch) {
            return false;
          }
        }

        return true;
      })
      .sort(
        (a, b) =>
          b.documentDate
            .localeCompare(
              a.documentDate
            )
      );
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

/* =========================
   Event helpers
========================= */

function buildEventFileName(
  tocid: number
): string {
  const now = new Date();

  const YYYY =
    now.getFullYear();

  const MM =
    String(now.getMonth() + 1)
      .padStart(2, "0");

  const DD =
    String(now.getDate())
      .padStart(2, "0");

  const HH =
    String(now.getHours())
      .padStart(2, "0");

  const mm =
    String(now.getMinutes())
      .padStart(2, "0");

  const baseFileName =
    `TOC_${YYYY}${MM}${DD}${HH}${mm}_${tocid}.json`;

  return prefixEventFileName(
    baseFileName
  );
}

function formatPartyID(
  partyID: number
): string {
  return (
    "P" +
    String(partyID)
      .padStart(5, "0")
  );
}

function buildPhysicalName(
  item: ArchiveItem
): string {
  const documentDate =
    item.documentDate;

  const dta =
    item.dtaDate
      ? `-DTA${item.dtaDate.replace(
          /-/g,
          ""
        )}`
      : "";

  const info1 =
    item.info1
      ? `-IF1${item.info1}`
      : "";

  const info2 =
    item.info2
      ? `-IF2${item.info2}`
      : "";

  const tags =
    item.tagIDs?.length
      ? `-TAG${item.tagIDs.join(
          "_"
        )}`
      : "";

  const amount =
    item.refAmount
      ? `-AMT${Math.round(
          item.refAmount * 100
        )}`
      : "";

  const extension =
    ".pdf";

  if (
    item.folder ===
    "A Classer"
  ) {
    const partyLabel =
      getPartyLabel(
        item.partyID
      ) ||
      `${item.partyID}`;

    return (
      `${documentDate}-` +
      `${partyLabel}` +
      `${info1}` +
      `${info2}` +
      `${tags}` +
      `${amount}` +
      `${extension}`
    );
  }

  const year =
    item.documentDate.slice(
      0,
      4
    );

  const party =
    formatPartyID(
      item.partyID
    );

  return (
    `${year}/` +
    `${item.folder}/` +
    `${party}/` +
    `${documentDate}` +
    `${dta}` +
    `${info1}` +
    `${info2}` +
    `${tags}` +
    `${amount}` +
    `${extension}`
  );
}

/* =========================
   Save classification
========================= */

async function saveClassification(
  updated: ArchiveItem
) {
  if (!storageReady.value) {
    error.value =
      storageUnavailableMessage.value ||
      "Storage not available.";

    return;
  }

  const previousItem =
    archive.value.find(
      item =>
        item.tocid ===
        updated.tocid
    );

  const previousSnapshot =
    previousItem
      ? { ...previousItem }
      : null;

  const processedFilePhysicalName =
    updated.physicalName;

  try {
    const index =
      archive.value.findIndex(
        item =>
          item.tocid ===
          updated.tocid
      );

    if (index !== -1) {
      archive.value[index] = {
        ...updated,
      };
    }

    const newPhysicalName =
      buildPhysicalName(
        updated
      );

    const event = {
      eventType:
        "ARCHIVE_UPDATED",

      version:
        1,

      timestamp:
        new Date().toISOString(),

      processedFile:
        processedFilePhysicalName,

      archiveMetadata: {
        tocid:
          updated.tocid,

        googleFileId:
          updated.googleFileId,

        newPhysicalName,

        folder:
          updated.folder,

        partyID:
          updated.partyID,

        documentDate:
          updated.documentDate,

        dtaDate:
          updated.dtaDate,

        info1:
          updated.info1,

        info2:
          updated.info2,

        refAmount:
          updated.refAmount,

        tagIDs:
          updated.tagIDs ??
          [],
      },
    };

    const fileName =
      buildEventFileName(
        updated.tocid
      );

    const {
      save,
    } =
      useDriveJsonFile(
        "events",
        fileName
      );

    await save(event);

    closeClassification();

    /*
      Do not reload immediately.

      The local backend processor updates the archive
      indexes, and index.json watcher reloads the
      affected bucket afterwards.

      Keeping the optimistic update avoids briefly
      restoring stale index data.
    */

  } catch (err) {
    console.error(
      "Archive classification save failed",
      err
    );

    if (
      previousSnapshot
    ) {
      const index =
        archive.value.findIndex(
          item =>
            item.tocid ===
            previousSnapshot.tocid
        );

      if (index !== -1) {
        archive.value[index] = {
          ...previousSnapshot,
        };
      }
    }

    error.value =
      err instanceof Error
        ? err.message
        : "Save failed";
  }
}

/* =========================
   Delete document
========================= */

async function deleteDocument(
  payload: {
    tocid: number;
  }
) {
  if (!storageReady.value) {
    error.value =
      storageUnavailableMessage.value ||
      "Storage not available.";

    return;
  }

  try {
    const fileName =
      buildEventFileName(
        payload.tocid
      );

    const event = {
      eventType:
        "ARCHIVE_DELETED",

      version:
        1,

      timestamp:
        new Date().toISOString(),

      archiveMetadata: {
        tocid:
          payload.tocid,
      },
    };

    const {
      save,
    } =
      useDriveJsonFile(
        "events",
        fileName
      );

    await save(event);

    closeClassification();

    /*
      No optimistic removal:
      archive/index.json watcher reloads the index
      after the backend has processed the event.
    */

  } catch (err) {
    console.error(
      "Archive deletion request failed",
      err
    );

    error.value =
      err instanceof Error
        ? err.message
        : "Delete failed";
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
    loading.value ||
    initialized.value
  ) {
    return;
  }

  loading.value =
    true;

  error.value =
    null;

  try {
    const ready =
      await ensureStorageReady();

    if (!ready) {
      return;
    }

    await loadSettings();
    await loadArchive();

    selectedFolder.value =
      selectedFolder.value ??
      defaultFolder.value;

    initialized.value =
      true;

  } catch (err) {
    console.error(
      "Archive initialization failed",
      err
    );

    error.value =
      err instanceof Error
        ? err.message
        : String(err);

  } finally {
    loading.value =
      false;
  }
}

watch(
  storageReady,
  async ready => {
    if (!ready) {
      initialized.value =
        false;

      archive.value =
        [];

      selectedFolder.value =
        null;

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
   Archive index watcher
========================= */

useDriveWatcher({
  folderId:
    "archive",

  fileName:
    "index.json",

  lastKnownState:
    indexLastModified,

  onChanged:
    async () => {
      if (
        !storageReady.value
      ) {
        return;
      }

      console.log(
        "Archive index changed"
      );

      const index =
        await loadJSONFromFolder<
          ArchiveIndex
        >(
          "archive",
          "index.json"
        );

      if (!index) {
        return;
      }

      /*
        Small consistency delay:
        index.json can be published a fraction before
        the affected year/toFile object is available.
      */
      await new Promise<void>(
        resolve =>
          window.setTimeout(
            resolve,
            200
          )
      );

      await smartReload(
        index
      );
    },
});

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
      title="Documents archives"
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

          <button
            v-if="filtersOpen"
            type="button"
            class="reset-button"
            @click.stop="
              resetFilters
            "
          >
            Reset
          </button>
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
              isPayDateVisible
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
          <span class="status-pill">
            {{ headerCountLabel }}
          </span>
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
      Check filters
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

.reset-button {
  padding:
    2px 20px;

  border-radius:
    999px;

  border:
    1px solid
    var(--border);

  background:
    var(--surface-soft);

  color:
    var(--text-soft);

  font-size:
    var(--font-size-xs);

  font-weight:
    600;

  cursor:
    pointer;

  transition:
    all 0.15s ease;
}

.reset-button:hover {
  background:
    var(--primary-soft);

  border-color:
    var(--primary);

  color:
    var(--primary);
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

.status-pill {
  padding:
    2px 10px;

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
    0.7rem;

  font-weight:
    600;
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