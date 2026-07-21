<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";

import {
  useStorageAccess,
} from "@/composables/useStorageAccess";

import {
  useAppBootstrap,
} from "@/composables/useAppBootstrap";

import {
  useDriveJsonFile,
} from "@/composables/useDriveJsonFile";

import {
  useDriveWatcher,
} from "@/composables/useDriveWatcher";

import {
  prefixEventFileName,
} from "@/utils/eventFileName";

import {
  useAllocationTags,
} from "@/composables/allocations/useAllocationTags";

import {
  useParties,
} from "@/composables/useParties";

import {
  loadJSONFromFolder,
} from "@/services/driveAdapter";

import {
  formatDate,
} from "@/utils/dateFormat";

/* =========================================================
   TYPES
========================================================= */

interface FollowUpDetailItem {
  allocationId: string;
  categoryId: number;
  subCategoryId: number;
  allocationDate: string;
  amount: number;
  amountCcy: number;
  currency: string;
  description: string;
  bankDescription: string;
  partyId: number | null;
  tagId: number | null;
}

interface FollowUpDetailsFile {
  version?: number;
  updatedAt?: string;
  year: number;
  items: FollowUpDetailItem[];
}

interface SpendingItem {
  id?: string;
  fitid?: string;
}

interface SpendingFile {
  version?: number;
  generatedAt?: string;
  count?: number;
  items: SpendingItem[];
}

interface MonthGroup {
  key: string;
  label: string;
  total: number;
  items: FollowUpDetailItem[];
}

/* =========================================================
   PROPS
========================================================= */

const props =
  defineProps<{
    year: number;
    categoryIds: number[];
    subCategoryId: number | null;
    monthlyBudgetMap?: Record<
      string,
      number
    >;
    nature?: "E" | "I" | null;
    maxMonth?: number | null;
    includeOffBudget?: boolean;
    labelFilter?: string;
  }>();

/* =========================================================
   STORAGE ACCESS
========================================================= */

const {
  storageReady,
  storageUnavailableMessage,
  ensureStorageReady,
} =
  useStorageAccess();

/* =========================================================
   BOOTSTRAP
========================================================= */

const {
  loadSettings,
} =
  useAppBootstrap();

/* =========================================================
   STORES
========================================================= */

const tagsStore =
  useAllocationTags();

const partiesStore =
  useParties();

/* =========================================================
   STATE
========================================================= */

const activeRowFitid =
  ref<string | null>(
    null
  );

const raw =
  ref<FollowUpDetailsFile | null>(
    null
  );

const detailsRemoteState =
  ref<string | null>(
    null
  );

const spendingRemoteState =
  ref<string | null>(
    null
  );

const loading =
  ref(false);

const error =
  ref<string | null>(
    null
  );

const initialized =
  ref(false);

const isTouchDevice =
  window.matchMedia(
    "(hover: none)"
  ).matches;

const fxPopover =
  ref<{
    item: FollowUpDetailItem;
    x: number;
    y: number;
  } | null>(
    null
  );

let fxTimer:
  number | null =
    null;

/* =========================================================
   PENDING REALLOCATIONS
========================================================= */

const PENDING_KEY =
  "pendingReallocations";

/*
  État local transitoire.

  Il est créé immédiatement après l’écriture de l’événement
  REA afin d’afficher Pending sans attendre le traitement
  backend.

  Dès que le FITID apparaît dans spending.json, cette entrée
  locale est supprimée car spending.json devient la source
  de vérité.
*/
const localPendingReallocationIds =
  ref<Map<string, number>>(
    loadPending()
  );

/*
  FITID présents dans spending.json.

  Un mouvement présent dans spending.json est non alloué
  ou revenu dans le workflow Spending après une demande
  de réallocation.
*/
const spendingPendingIds =
  ref<Set<string>>(
    new Set()
  );

/*
  État final utilisé dans le template.

  Il combine :
  - les demandes locales encore en transit ;
  - les FITID réellement présents dans spending.json.
*/
const pendingReallocationIds =
  computed<Set<string>>(
    () => {
      const ids =
        new Set<string>(
          spendingPendingIds.value
        );

      for (
        const id
        of localPendingReallocationIds
          .value
          .keys()
      ) {
        ids.add(id);
      }

      return ids;
    }
  );

function loadPending():
  Map<string, number> {

  try {
    const storedValue =
      localStorage.getItem(
        PENDING_KEY
      );

    if (!storedValue) {
      return new Map();
    }

    const parsed =
      JSON.parse(
        storedValue
      );

    if (!Array.isArray(parsed)) {
      return new Map();
    }

    return new Map(
      parsed
        .filter(
          entry =>
            Array.isArray(entry) &&
            entry.length >= 2
        )
        .map(
          entry => [
            String(entry[0]),
            Number(entry[1]),
          ]
        )
    );

  } catch {
    return new Map();
  }
}

function savePending(
  map: Map<string, number>
) {
  localStorage.setItem(
    PENDING_KEY,
    JSON.stringify(
      [...map.entries()]
    )
  );
}

/* =========================================================
   ROW ACTIONS
========================================================= */

function toggleRowAction(
  fitid: string
) {
  if (!isTouchDevice) {
    return;
  }

  activeRowFitid.value =
    activeRowFitid.value ===
      fitid
      ? null
      : fitid;
}

/* =========================================================
   EVENT HELPERS
========================================================= */

function buildEventFileName(
  allocationId: string
): string {
  const now =
    new Date();

  const YYYY =
    now.getFullYear();

  const MM =
    String(
      now.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const DD =
    String(
      now.getDate()
    ).padStart(
      2,
      "0"
    );

  const HH =
    String(
      now.getHours()
    ).padStart(
      2,
      "0"
    );

  const mm =
    String(
      now.getMinutes()
    ).padStart(
      2,
      "0"
    );

  const ss =
    String(
      now.getSeconds()
    ).padStart(
      2,
      "0"
    );

  const shortAllocationId =
    allocationId.slice(
      0,
      12
    );

  const baseFileName =
    `REA_${YYYY}${MM}${DD}${HH}${mm}${ss}_${shortAllocationId}.json`;

  return prefixEventFileName(
    baseFileName
  );
}

/* =========================================================
   REQUEST REALLOCATION
========================================================= */

async function requestReallocation(
  item: FollowUpDetailItem
) {
  if (
    pendingReallocationIds.value.has(
      item.allocationId
    )
  ) {
    return;
  }

  if (!storageReady.value) {
    error.value =
      storageUnavailableMessage.value ||
      "Storage not available.";

    return;
  }

  const confirmed =
    confirm(
      "Request allocation change for this transaction?\n" +
      "(back to Spending Drafts)"
    );

  if (!confirmed) {
    return;
  }

  try {
    const event = {
      eventType:
        "REALLOCATION_REQUEST",

      version:
        1,

      timestamp:
        new Date()
          .toISOString(),

      allocationMetadata: {
        allocationId:
          item.allocationId,
      },
    };

    const fileName =
      buildEventFileName(
        item.allocationId
      );

    /*
      En mode Object Storage :

      1. L’événement métier est écrit dans events/.
      2. writeS3JSON crée automatiquement un
         STORAGE_PULL_REQUESTED ciblant ce fichier.
    */
    const {
      save,
    } =
      useDriveJsonFile(
        "events",
        fileName
      );

    await save(event);

    /*
      Pending immédiat, sans attendre que le backend
      crée le draft et republie spending.json.
    */
    localPendingReallocationIds
      .value
      .set(
        item.allocationId,
        Date.now()
      );

    savePending(
      localPendingReallocationIds
        .value
    );

    activeRowFitid.value =
      null;

  } catch (err) {
    console.error(
      "Failed to request reallocation",
      err
    );

    error.value =
      err instanceof Error
        ? err.message
        : String(err);
  }
}

/* =========================================================
   SPENDING PENDING STATE
========================================================= */

function spendingItemId(
  item: SpendingItem
): string {
  return String(
    item.id ??
    item.fitid ??
    ""
  ).trim();
}

async function loadSpendingPending() {
  if (!storageReady.value) {
    spendingPendingIds.value =
      new Set();

    return;
  }

  try {
    const data =
      await loadJSONFromFolder<
        SpendingFile
      >(
        "spending",
        "spending.json"
      );

    const nextIds =
      new Set<string>();

    for (
      const item
      of data?.items ?? []
    ) {
      const id =
        spendingItemId(
          item
        );

      if (id) {
        nextIds.add(id);
      }
    }

    spendingPendingIds.value =
      nextIds;

    /*
      Lorsque le FITID apparaît dans spending.json,
      le backend a traité le REA.

      Le pending local transitoire peut être retiré :
      le pending reste alors porté par spending.json.
    */
    let localStateChanged =
      false;

    for (
      const id
      of [
        ...localPendingReallocationIds
          .value
          .keys(),
      ]
    ) {
      if (
        nextIds.has(id)
      ) {
        localPendingReallocationIds
          .value
          .delete(id);

        localStateChanged =
          true;
      }
    }

    if (localStateChanged) {
      savePending(
        localPendingReallocationIds
          .value
      );
    }

  } catch (err) {
    /*
      Une erreur temporaire de lecture ne doit pas
      supprimer les pending locaux existants.
    */
    console.error(
      "Unable to load spending pending state",
      err
    );
  }
}

/* =========================================================
   LOAD DETAILS
========================================================= */

async function loadDetails() {
  if (
    props.subCategoryId ===
    null
  ) {
    raw.value =
      null;

    error.value =
      null;

    return;
  }

  if (!storageReady.value) {
    raw.value =
      null;

    error.value =
      storageUnavailableMessage.value ||
      "Storage not available.";

    return;
  }

  loading.value =
    true;

  error.value =
    null;

  try {
    const filename =
      `FollowUpDetails-${props.year}.json`;

    const data =
      await loadJSONFromFolder<
        FollowUpDetailsFile
      >(
        "allocations/budget",
        filename
      );

    if (!data) {
      throw new Error(
        `${filename} not found`
      );
    }

    raw.value =
      data;

  } catch (err) {
    error.value =
      err instanceof Error
        ? err.message
        : "Unable to load FollowUpDetails";

    raw.value =
      null;

  } finally {
    loading.value =
      false;
  }
}

/* =========================================================
   PROPS WATCHERS
========================================================= */

watch(
  () =>
    props.year,

  async () => {
    activeRowFitid.value =
      null;

    detailsRemoteState.value =
      null;

    if (
      storageReady.value &&
      props.subCategoryId !==
        null
    ) {
      await loadDetails();
    }
  }
);

watch(
  () =>
    props.subCategoryId,

  async value => {
    activeRowFitid.value =
      null;

    if (value === null) {
      raw.value =
        null;

      error.value =
        null;

      return;
    }

    if (storageReady.value) {
      await loadDetails();
    }
  }
);

/* =========================================================
   STORAGE WATCHER
========================================================= */

watch(
  storageReady,

  async ready => {
    if (!ready) {
      initialized.value =
        false;

      raw.value =
        null;

      spendingPendingIds.value =
        new Set();

      detailsRemoteState.value =
        null;

      spendingRemoteState.value =
        null;

      error.value =
        null;

      return;
    }

    await loadSpendingPending();

    if (
      props.subCategoryId !==
      null
    ) {
      await loadDetails();
    }
  }
);

/* =========================================================
   REMOTE WATCHERS
========================================================= */

/*
  FollowUpDetails watcher.

  On observe le dossier allocations/budget plutôt qu’un nom
  de fichier calculé une seule fois afin de supporter les
  changements d’année.
*/
useDriveWatcher({
  folderId:
    "allocations/budget",

  lastKnownState:
    detailsRemoteState,

  onChanged:
    async () => {
      if (
        !storageReady.value ||
        props.subCategoryId ===
          null
      ) {
        return;
      }

      await loadDetails();

      activeRowFitid.value =
        null;
    },
});

/*
  spending.json watcher.

  Après traitement REA :
  - le FITID apparaît dans spending.json ;
  - le pending reste affiché.

  Après release de la nouvelle allocation :
  - le FITID disparaît de spending.json ;
  - le pending disparaît.
*/
useDriveWatcher({
  folderId:
    "spending",

  lastKnownState:
    spendingRemoteState,

  onChanged:
    async () => {
      if (!storageReady.value) {
        return;
      }

      await loadSpendingPending();
    },
});

/* =========================================================
   FORMAT HELPERS
========================================================= */

function fmt(
  value: number
): string {
  return value.toLocaleString(
    "en-GB",
    {
      minimumFractionDigits:
        2,

      maximumFractionDigits:
        2,
    }
  );
}

function fmtInt(
  value: number
): string {
  return Math
    .round(value)
    .toLocaleString(
      "en-GB"
    );
}

function fmtForeign(
  item: FollowUpDetailItem
): string {
  if (!item.amountCcy) {
    return "";
  }

  const value =
    item.amountCcy
      .toLocaleString(
        "en-GB",
        {
          minimumFractionDigits:
            2,

          maximumFractionDigits:
            2,
        }
      );

  return item.currency
    ? `${value} ${item.currency}`
    : value;
}

function monthKey(
  date: string
): string {
  return date.slice(
    0,
    7
  );
}

function monthLabel(
  key: string
): string {
  const [
    year,
    month,
  ] =
    key
      .split("-")
      .map(Number);

  return new Date(
    year,
    month - 1
  ).toLocaleDateString(
    "en-GB",
    {
      month:
        "long",

      year:
        "numeric",
    }
  );
}

function partyLabel(
  partyId: number | null
): string {
  if (partyId == null) {
    return "";
  }

  return (
    partiesStore
      .getParty(
        partyId
      )
      ?.label ??
    `#${partyId}`
  );
}

function getTag(
  tagId: number | null
) {
  if (tagId === null) {
    return null;
  }

  return tagsStore
    .getTag(
      tagId
    );
}

function tagLabel(
  tagId: number | null
): string {
  return (
    getTag(
      tagId
    )
      ?.tagName ??
    ""
  );
}

function isForeign(
  item: FollowUpDetailItem
): boolean {
  return (
    item.amountCcy !==
    0
  );
}

function normalizeText(
  value: string
): string {
  return value
    .normalize("NFD")
    .replace(
      /\p{Diacritic}/gu,
      ""
    )
    .toLowerCase()
    .trim();
}

/* =========================================================
   FX POPOVER
========================================================= */

function showFxPopover(
  event: MouseEvent,
  item: FollowUpDetailItem
) {
  if (!isForeign(item)) {
    return;
  }

  const target =
    event.currentTarget as
      HTMLElement;

  const rect =
    target.getBoundingClientRect();

  fxPopover.value = {
    item,

    x:
      rect.right - 10,

    y:
      rect.top - 8,
  };

  if (fxTimer !== null) {
    window.clearTimeout(
      fxTimer
    );
  }

  fxTimer =
    window.setTimeout(
      () => {
        fxPopover.value =
          null;

        fxTimer =
          null;
      },

      2000
    );
}

function closeFxPopover() {
  fxPopover.value =
    null;

  if (fxTimer !== null) {
    window.clearTimeout(
      fxTimer
    );

    fxTimer =
      null;
  }
}

/* =========================================================
   FILTERED ITEMS
========================================================= */

const filteredItems =
  computed<
    FollowUpDetailItem[]
  >(
    () => {
      if (
        !raw.value ||
        props.subCategoryId ===
          null
      ) {
        return [];
      }

      const selectedCategoryIds =
        new Set(
          props.categoryIds
        );

      const selectedSubCategoryId =
        props.subCategoryId;

      const maxMonth =
        props.maxMonth;

      const includeOffBudget =
        props.includeOffBudget;

      const query =
        normalizeText(
          props.labelFilter ??
          ""
        );

      return raw.value.items
        .filter(
          item => {
            const matchesCategory =
              selectedCategoryIds.size ===
                0 ||
              selectedCategoryIds.has(
                item.categoryId
              );

            if (!matchesCategory) {
              return false;
            }

            if (
              item.subCategoryId !==
              selectedSubCategoryId
            ) {
              return false;
            }

            const matchesMonth =
              maxMonth == null ||
              Number(
                item.allocationDate
                  .slice(
                    5,
                    7
                  )
              ) <= maxMonth;

            if (!matchesMonth) {
              return false;
            }

            const isOffBudget =
              getTag(
                item.tagId
              )
                ?.offBudget ===
              true;

            if (
              !includeOffBudget &&
              isOffBudget
            ) {
              return false;
            }

            if (query) {
              const haystack =
                normalizeText(
                  [
                    item.description,

                    partyLabel(
                      item.partyId
                    ),

                    item.bankDescription,

                    tagLabel(
                      item.tagId
                    ),
                  ].join(" ")
                );

              if (
                !haystack.includes(
                  query
                )
              ) {
                return false;
              }
            }

            return true;
          }
        )
        .sort(
          (a, b) =>
            b.allocationDate
              .localeCompare(
                a.allocationDate
              )
        );
    }
  );

/* =========================================================
   MONTHLY GROUPS
========================================================= */

const monthlyGroups =
  computed<MonthGroup[]>(
    () => {
      const map =
        new Map<
          string,
          FollowUpDetailItem[]
        >();

      for (
        const item
        of filteredItems.value
      ) {
        const key =
          monthKey(
            item.allocationDate
          );

        if (!map.has(key)) {
          map.set(
            key,
            []
          );
        }

        map.get(key)!
          .push(item);
      }

      return Array
        .from(
          map.entries()
        )
        .map(
          ([
            key,
            list,
          ]) => ({
            key,

            label:
              monthLabel(
                key
              ),

            total:
              list.reduce(
                (
                  total,
                  item
                ) =>
                  total +
                  item.amount,

                0
              ),

            items:
              list.sort(
                (a, b) =>
                  b.allocationDate
                    .localeCompare(
                      a.allocationDate
                    )
              ),
          })
        )
        .sort(
          (a, b) =>
            b.key.localeCompare(
              a.key
            )
        );
    }
  );

/* =========================================================
   COLLAPSE
========================================================= */

const openMonths =
  ref<Set<string>>(
    new Set()
  );

watch(
  monthlyGroups,

  groups => {
    if (!groups.length) {
      openMonths.value =
        new Set();

      return;
    }

    const availableKeys =
      new Set(
        groups.map(
          group =>
            group.key
        )
      );

    const retained =
      new Set(
        [
          ...openMonths.value,
        ].filter(
          key =>
            availableKeys.has(
              key
            )
        )
      );

    if (
      retained.size ===
      0
    ) {
      retained.add(
        groups[0].key
      );
    }

    openMonths.value =
      retained;
  },

  {
    immediate:
      true,
  }
);

function toggleMonth(
  key: string
) {
  const next =
    new Set(
      openMonths.value
    );

  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }

  openMonths.value =
    next;
}

/* =========================================================
   MONTH STATUS
========================================================= */

function monthStatusClass(
  key: string,
  total: number
): string {
  if (
    !props.monthlyBudgetMap ||
    !props.nature
  ) {
    return "neutral";
  }

  const budget =
    props.monthlyBudgetMap[
      key
    ];

  if (budget == null) {
    return "neutral";
  }

  if (
    props.nature ===
    "E"
  ) {
    if (total > budget) {
      return "over";
    }

    if (total < budget) {
      return "under";
    }

    return "neutral";
  }

  if (
    props.nature ===
    "I"
  ) {
    if (total < budget) {
      return "over";
    }

    if (total > budget) {
      return "under";
    }

    return "neutral";
  }

  return "neutral";
}

/* =========================================================
   INITIALIZATION
========================================================= */

async function initializeDetails() {
  if (initialized.value) {
    return;
  }

  const ready =
    await ensureStorageReady();

  if (!ready) {
    return;
  }

  try {
    await loadSettings();

    await loadSpendingPending();

    initialized.value =
      true;

    if (
      props.subCategoryId !==
      null
    ) {
      await loadDetails();
    }

  } catch (err) {
    console.error(
      "FollowUpDetails initialization failed",
      err
    );

    error.value =
      err instanceof Error
        ? err.message
        : String(err);
  }
}

onMounted(
  async () => {
    await initializeDetails();
  }
);

onBeforeUnmount(
  () => {
    closeFxPopover();
  }
);
</script>

<template>
  <section
    v-if="
      props.subCategoryId !==
      null
    "
    class="details"
  >
    <div
      v-if="!storageReady"
      class="muted storage-state"
    >
      {{
        storageUnavailableMessage ||
        "Storage not available."
      }}
    </div>

    <div
      v-else-if="loading"
      class="muted storage-state"
    >
      Loading…
    </div>

    <div
      v-else-if="error"
      class="error storage-state"
    >
      {{ error }}
    </div>

    <div v-else>
      <div
        v-for="
          group
          in monthlyGroups
        "
        :key="group.key"
        class="month-block"
      >
        <!-- Month header -->

        <div
          class="grid month-header"
          @click="
            toggleMonth(
              group.key
            )
          "
        >
          <div
            class="
              col-label
              month-toggle
            "
          >
            <span>
              {{
                openMonths.has(
                  group.key
                )
                  ? "▼"
                  : "►"
              }}
            </span>

            {{ group.label }}
          </div>

          <div></div>

          <div
            class="
              col-spent
              amount
            "
            :class="
              monthStatusClass(
                group.key,
                group.total
              )
            "
          >
            {{
              fmt(
                group.total
              )
            }}
          </div>

          <div
            class="
              col-budget
              amount
            "
          >
            <span
              v-if="
                props.monthlyBudgetMap
                  ?.[group.key] != null
              "
            >
              {{
                fmtInt(
                  props
                    .monthlyBudgetMap![
                      group.key
                    ]
                )
              }}
            </span>

            <span v-else>
              —
            </span>
          </div>
        </div>

        <!-- Month rows -->

        <div
          v-if="
            openMonths.has(
              group.key
            )
          "
        >
          <div
            v-for="
              (
                item,
                index
              )
              in group.items
            "
            :key="
              `${item.allocationId}-${index}`
            "
            class="grid row"
            :class="{
              active:
                activeRowFitid ===
                item.allocationId,

              pending:
                pendingReallocationIds.has(
                  item.allocationId
                )
            }"
            @click="
              !pendingReallocationIds.has(
                item.allocationId
              ) &&
              toggleRowAction(
                item.allocationId
              )
            "
          >
            <div
              class="
                col-label
                date-cell
              "
            >
              <span
                v-if="
                  pendingReallocationIds.has(
                    item.allocationId
                  )
                "
                class="pending-inline"
              >
                Pending
              </span>

              <button
                v-else
                type="button"
                class="reallocate-btn"
                :class="{
                  visible:
                    activeRowFitid ===
                    item.allocationId
                }"
                title="Request allocation change"
                @click.stop="
                  requestReallocation(
                    item
                  )
                "
              >
                🔄
              </button>

              <span class="date">
                {{
                  formatDate(
                    item.allocationDate,
                    "text"
                  )
                }}
              </span>
            </div>

            <div class="desc-block">
              <div class="desc-text">
                <div class="desc">
                  {{
                    item.description ||
                    "—"
                  }}
                </div>

                <div class="sub muted">
                  {{
                    partyLabel(
                      item.partyId
                    )
                  }}

                  <span
                    v-if="
                      item.bankDescription
                    "
                  >
                    ·
                    {{
                      item.bankDescription
                    }}
                  </span>
                </div>
              </div>

              <div class="tag-container">
                <span
                  v-if="
                    item.tagId !==
                    null
                  "
                  class="tag-chip"
                  :class="{
                    off:
                      getTag(
                        item.tagId
                      )?.offBudget
                  }"
                >
                  {{
                    tagLabel(
                      item.tagId
                    )
                  }}
                </span>
              </div>
            </div>

            <div
              class="
                col-spent
                amount
                amount-cell
              "
              @mouseenter="
                showFxPopover(
                  $event,
                  item
                )
              "
              @mouseleave="
                closeFxPopover
              "
              @click.stop="
                showFxPopover(
                  $event,
                  item
                )
              "
            >
              <span class="amount-value">
                {{
                  fmt(
                    item.amount
                  )
                }}
              </span>

              <span
                v-if="
                  isForeign(
                    item
                  )
                "
                class="ccy-dot"
              ></span>
            </div>

            <div></div>
          </div>
        </div>
      </div>

      <div
        v-if="
          !filteredItems.length
        "
        class="muted empty"
      >
        No allocations for this selection
      </div>
    </div>

    <div
      v-if="fxPopover"
      class="fx-popover"
      :style="{
        left:
          fxPopover.x +
          'px',

        top:
          fxPopover.y +
          'px'
      }"
    >
      {{
        fmtForeign(
          fxPopover.item
        )
      }}
    </div>
  </section>
</template>

<style scoped>
/* =========================================================
   Container
========================================================= */

.details {
  padding-top: 2px;
}

.storage-state {
  padding: 12px 0;
}

/* =========================================================
   Grid layout
========================================================= */

.grid {
  display: grid;

  grid-template-columns:
    220px
    1fr
    100px
    80px;

  column-gap: 16px;
  align-items: center;
}

/* =========================================================
   Month header
========================================================= */

.month-header {
  cursor: pointer;
  font-weight: 600;
  border-top: 1px solid var(--border);
  padding: 6px 0;
  font-size: 0.8rem;
  font-style: italic;
  color: var(--text-soft);
  opacity: 0.85;
  transition: background 0.15s ease;
}

.month-header:hover {
  background: var(--primary-soft);
}

.month-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* =========================================================
   Month status
========================================================= */

.month-header
.col-spent.amount.over {
  color: var(--negative);
}

.month-header
.col-spent.amount.under {
  color: var(--positive);
}

.month-header
.col-spent.amount.neutral {
  color: inherit;
}

/* =========================================================
   Rows
========================================================= */

.row {
  padding: 3px 0;
  transition: background 0.15s ease;
}

.row.active {
  background: var(--primary-soft);
}

.row.pending {
  opacity: 0.45;
}

.row:hover {
  background: var(--primary-soft);
}

.pending-inline {
  font-size: 0.85rem;
  font-style: italic;
  font-weight: 600;
  color: var(--negative);
  white-space: nowrap;
  min-width: 48px;
  text-align: right;
}

.reallocate-btn {
  width: 22px;
  height: 22px;

  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;

  opacity: 0;
  pointer-events: none;

  transition:
    opacity 0.15s ease,
    transform 0.15s ease;

  transform: scale(0.9);
}

.row:hover
.reallocate-btn {
  opacity: 0.75;
  pointer-events: auto;
  transform: scale(1);
}

.row.active
.reallocate-btn {
  opacity: 0.75;
  pointer-events: auto;
  transform: scale(1);
}

.row.pending:hover
.reallocate-btn {
  opacity: 0;
  pointer-events: none;
}

/* =========================================================
   Date
========================================================= */

.date-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  justify-self: end;
  width: max-content;
}

.date {
  font-weight: 600;
  font-size: 0.8rem;
  color: var(--text-soft);
  white-space: nowrap;
}

/* =========================================================
   Description + tags
========================================================= */

.desc-block {
  display: grid;
  grid-template-columns: 1fr auto;
  column-gap: 8px;
  align-items: center;
}

.desc-text {
  min-width: 0;
}

.tag-container {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tag-chip {
  padding: 1px 6px;

  border-radius: 999px;
  border: 1px solid var(--border);

  font-size: 0.65rem;
  font-weight: 700;

  background: var(--surface-soft);
  color: var(--text-soft);
}

.tag-chip.off {
  background: var(--primary-soft);
  border-color: var(--negative);
  color: var(--negative);
}

.desc {
  font-size: 0.8rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sub {
  font-size: 0.75rem;
  color: var(--text-soft);
}

/* =========================================================
   Amount
========================================================= */

.amount {
  text-align: right;
  font-weight: 700;
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
}

.amount-cell {
  position: relative;
  text-align: right;
}

.amount-value {
  display: inline-block;
}

/* =========================================================
   Currency indicator
========================================================= */

.ccy-dot {
  position: absolute;
  right: -12px;
  top: 50%;

  transform: translateY(-50%);

  width: 6px;
  height: 6px;
  border-radius: 50%;

  background: var(--primary);

  box-shadow:
    0 0 0 1px
    var(--surface);
}

/* =========================================================
   FX popover
========================================================= */

.fx-popover {
  position: fixed;

  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;

  padding: 4px 8px;

  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text);

  box-shadow: var(--shadow-md);

  pointer-events: none;
  z-index: 1000;
}

/* =========================================================
   States
========================================================= */

.muted {
  opacity: 0.4;
}

.error {
  color: var(--negative);
  font-size: 0.8rem;
}

.empty {
  padding: 12px 0;
}
</style>