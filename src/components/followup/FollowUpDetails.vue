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
  useDriveWatcher,
} from "@/composables/useDriveWatcher";

import {
  useRemoteJson,
} from "@/composables/useRemoteJson";

import {
  FOLLOW_UP_FOLDER,
  followUpDetailsFile,
  readFollowUpDetails,
  type FollowUpDetailItem,
} from "@/contracts/followUp";

import {
  emitEvent,
  EVENTS_FOLDER,
  eventFilePattern,
} from "@/services/events/eventFiles";

import {
  useAllocationTags,
} from "@/composables/allocations/useAllocationTags";

import {
  useParties,
} from "@/composables/useParties";

import {
  useCategories,
} from "@/composables/useCategories";

import {
  listFiles,
} from "@/services/driveAdapter";

import {
  formatDate,
} from "@/utils/dateFormat";

import {
  formatAmount,
  formatInteger,
} from "@/utils/amountFormat";
import { confirmDialog } from "@/services/dialog/appDialog";

/* =========================================================
   TYPES
========================================================= */

/*
  Un groupe contient une ou plusieurs sections de lignes.

  - Détail d’une sous-catégorie : un groupe par mois,
    avec une seule section sans en-tête.
  - Recherche transversale : un groupe par sous-catégorie,
    avec une section par mois, chacune repliable.
*/
interface DetailSection {
  key: string;
  label: string;
  total: number;
  items: FollowUpDetailItem[];
  collapsible: boolean;
}

interface DetailGroup {
  key: string;
  label: string;
  total: number;
  items: FollowUpDetailItem[];
  sections: DetailSection[];
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

    /*
      Ne retient que les allocations en attente de
      réallocation.
    */
    pendingOnly?: boolean;

    /*
      Tags retenus : vide ou absent = tous.
    */
    tagIds?: number[];

    /*
      Recherche transversale : les allocations de toutes
      les sous-catégories des catégories transmises sont
      affichées, regroupées par sous-catégorie et non
      par mois.
    */
    groupBySubCategory?: boolean;
  }>();

/*
  Le détail est affiché pour une sous-catégorie
  sélectionnée, ou pour une recherche transversale.

  Les allocations de l’année sont chargées même lorsque
  le détail n’est pas affiché : la vue en a besoin pour
  le nombre d’écritures en pending.
*/
const detailsActive =
  computed(() =>
    props.subCategoryId !==
      null ||
    props.groupBySubCategory ===
      true
  );

/* =========================================================
   EMITS
========================================================= */

const emit =
  defineEmits<{
    (
      event: "filtered-total",
      total: number
    ): void;

    (
      event: "pending-count",
      count: number
    ): void;
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

const categoriesStore =
  useCategories();

/* =========================================================
   STATE
========================================================= */

const activeRowFitid =
  ref<string | null>(
    null
  );

/*
  Allocations de l’année affichée, relues dès qu’elles
  changent sur le stockage.
*/
const details =
  useRemoteJson({
    folder:
      FOLLOW_UP_FOLDER,

    file:
      () =>
        followUpDetailsFile(
          props.year
        ),

    read:
      readFollowUpDetails,
  });

const raw =
  details.data;

const eventsRemoteState =
  ref<string | null>(
    null
  );

const loading =
  details.loading;

/*
  Erreur d’une action (demande de ré-allocation) ; elle
  prime sur l’erreur de chargement.
*/
const actionError =
  ref<string | null>(
    null
  );

const error =
  computed(() =>
    actionError.value ??
    details.error.value
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

/*
  Nom d’un événement REA :
    PWA-REA_<AAAAMMJJHHMMSS>_<FITID>.json
  (sans préfixe pour les demandes plus anciennes en Local
  Drive).
*/
const REA_EVENT_FILE_PATTERN =
  eventFilePattern("REA");

/*
  FITID dont l’événement REA attend encore son traitement
  dans events/.

  Cet état est relu depuis le stockage : aucun pending
  n’est conservé sur l’appareil. Le backend retire le
  fichier de events/ une fois le REA traité ; le pending
  est alors porté par FollowUpDetails.
*/
const requestedReallocationIds =
  ref<Set<string>>(
    new Set()
  );

/*
  Demandes dont l’écriture est en cours, pour ignorer
  un second appui sur la même ligne.
*/
const reallocationRequestsInFlight =
  new Set<string>();

/*
  FITID que le backend exporte comme pending dans
  FollowUpDetails : le REA est traité, le mouvement attend
  sa nouvelle allocation et conserve les précédentes.
*/
const backendPendingIds =
  computed<Set<string>>(
    () => {
      const ids =
        new Set<string>();

      for (
        const item
        of raw.value?.items ?? []
      ) {
        if (item.pending === true) {
          ids.add(
            item.allocationId
          );
        }
      }

      return ids;
    }
  );

/*
  État final utilisé dans le template.

  Il combine :
  - les demandes encore en attente dans events/ ;
  - les FITID exportés comme pending par le backend.
*/
const pendingReallocationIds =
  computed<Set<string>>(
    () => {
      const ids =
        new Set<string>(
          backendPendingIds.value
        );

      for (
        const id
        of requestedReallocationIds.value
      ) {
        ids.add(id);
      }

      return ids;
    }
  );

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
   REQUEST REALLOCATION
========================================================= */

async function requestReallocation(
  item: FollowUpDetailItem
) {
  if (
    pendingReallocationIds.value.has(
      item.allocationId
    ) ||
    reallocationRequestsInFlight.has(
      item.allocationId
    )
  ) {
    return;
  }

  if (!storageReady.value) {
    actionError.value =
      storageUnavailableMessage.value ||
      "Storage not available.";

    return;
  }

  const confirmed =
    await confirmDialog({
      title: "Request allocation change for this transaction?",
      message: "It goes back to the Spending drafts.",
      confirmLabel: "Request",
    });

  if (!confirmed) {
    return;
  }

  reallocationRequestsInFlight.add(
    item.allocationId
  );

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

    /*
      En mode Object Storage :

      1. L’événement métier est écrit dans events/.
      2. writeS3JSON crée automatiquement un
         STORAGE_PULL_REQUESTED ciblant ce fichier.
    */
    await emitEvent(
      "REA",
      event,
      item.allocationId
    );

    /*
      Pending immédiat : l’événement vient d’être écrit
      dans events/. Le watcher confirme ensuite cet état
      à partir du contenu réel du dossier.
    */
    requestedReallocationIds.value =
      new Set([
        ...requestedReallocationIds.value,
        item.allocationId,
      ]);

    activeRowFitid.value =
      null;

  } catch (err) {
    console.error(
      "Failed to request reallocation",
      err
    );

    actionError.value =
      err instanceof Error
        ? err.message
        : String(err);

  } finally {
    reallocationRequestsInFlight.delete(
      item.allocationId
    );
  }
}

/* =========================================================
   REQUESTED REALLOCATIONS
========================================================= */

async function loadRequestedReallocations() {
  if (!storageReady.value) {
    requestedReallocationIds.value =
      new Set();

    return;
  }

  try {
    const files =
      await listFiles(
        EVENTS_FOLDER
      );

    const nextIds =
      new Set<string>();

    for (const file of files) {
      const id =
        REA_EVENT_FILE_PATTERN
          .exec(file.name)
          ?.[1];

      if (id) {
        nextIds.add(id);
      }
    }

    /*
      Un REA qui quitte events/ a été traité : le backend a
      publié FollowUpDetails avec le pending avant de le
      retirer. Si ce pending n’a pas encore été relu,
      FollowUpDetails est rechargé avant de retirer la
      demande, pour que le pending ne disparaisse pas entre
      les deux watchers.
    */
    const someProcessedRequestUnseen =
      [
        ...requestedReallocationIds.value,
      ].some(
        id =>
          !nextIds.has(id) &&
          !backendPendingIds.value.has(id)
      );

    if (someProcessedRequestUnseen) {
      await details.reload();
    }

    requestedReallocationIds.value =
      nextIds;

  } catch (err) {
    /*
      Une erreur temporaire de lecture ne doit pas
      modifier l’état affiché.
    */
    console.error(
      "Unable to load requested reallocations",
      err
    );
  }
}

/* =========================================================
   PROPS WATCHERS
========================================================= */

watch(
  [
    () =>
      props.year,

    () =>
      props.subCategoryId,

    detailsActive,
  ],

  () => {
    activeRowFitid.value =
      null;
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

      requestedReallocationIds.value =
        new Set();

      eventsRemoteState.value =
        null;

      actionError.value =
        null;

      return;
    }

    await loadRequestedReallocations();
  }
);

/* =========================================================
   REMOTE WATCHERS
========================================================= */

/*
  events watcher.

  Entre la demande et son traitement par le backend,
  l’événement REA est présent dans events/ : le pending
  est visible par tous les clients du même stockage.
*/
useDriveWatcher({
  folderId:
    EVENTS_FOLDER,

  lastKnownState:
    eventsRemoteState,

  onChanged:
    async () => {
      if (!storageReady.value) {
        return;
      }

      await loadRequestedReallocations();
    },
});

/* =========================================================
   FORMAT HELPERS
========================================================= */

function fmtForeign(
  item: FollowUpDetailItem
): string {
  if (!item.amountCcy) {
    return "";
  }

  const value =
    formatAmount(
      item.amountCcy
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

/*
  Allocations du périmètre courant : catégories,
  sous-catégorie, période, off-budget, tags et libellé.

  Le filtre Pending n’est pas appliqué ici, pour pouvoir
  compter les écritures en pending de ce périmètre.
*/
const scopedItems =
  computed<
    FollowUpDetailItem[]
  >(
    () => {
      if (!raw.value) {
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

      const selectedTagIds =
        new Set(
          props.tagIds ?? []
        );

      return raw.value.items
        .filter(
          item => {
            if (
              !selectedCategoryIds.has(
                item.categoryId
              )
            ) {
              return false;
            }

            if (
              selectedSubCategoryId !==
                null &&
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

            if (
              selectedTagIds.size > 0 &&
              (
                item.tagId === null ||
                !selectedTagIds.has(
                  item.tagId
                )
              )
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

/*
  Allocations affichées.
*/
const filteredItems =
  computed<
    FollowUpDetailItem[]
  >(
    () => {
      if (!detailsActive.value) {
        return [];
      }

      if (!props.pendingOnly) {
        return scopedItems.value;
      }

      return scopedItems.value
        .filter(
          item =>
            pendingReallocationIds.value.has(
              item.allocationId
            )
        );
    }
  );

/* =========================================================
   PENDING COUNT
========================================================= */

/*
  Nombre d’écritures en pending dans le périmètre
  courant. Une écriture répartie sur plusieurs
  allocations ne compte qu’une fois.
*/
const pendingCount =
  computed(() =>
    new Set(
      scopedItems.value
        .filter(
          item =>
            pendingReallocationIds.value.has(
              item.allocationId
            )
        )
        .map(
          item =>
            item.allocationId
        )
    ).size
  );

watch(
  pendingCount,

  count => {
    emit(
      "pending-count",
      count
    );
  },

  {
    immediate: true,
  }
);

/* =========================================================
   FILTERED TOTAL
========================================================= */

/*
  Total des allocations affichées, tous mois confondus.

  Il est transmis à la vue : lorsqu’un libellé est
  recherché, le total ne peut pas venir des agrégats,
  qui ignorent ce filtre.
*/
watch(
  filteredItems,

  list => {
    emit(
      "filtered-total",

      list.reduce(
        (
          total,
          item
        ) =>
          total +
          item.amount,

        0
      )
    );
  },

  {
    immediate: true,
  }
);

/* =========================================================
   GROUPS
========================================================= */

function groupTotal(
  list: FollowUpDetailItem[]
): number {
  return list.reduce(
    (
      total,
      item
    ) =>
      total +
      item.amount,

    0
  );
}

/*
  filteredItems est déjà trié par date décroissante :
  les lignes de chaque groupe conservent cet ordre.
*/
function groupItems(
  list: FollowUpDetailItem[],
  keyOf: (
    item: FollowUpDetailItem
  ) => string
): Map<
  string,
  FollowUpDetailItem[]
> {
  const map =
    new Map<
      string,
      FollowUpDetailItem[]
    >();

  for (
    const item
    of list
  ) {
    const key =
      keyOf(item);

    if (!map.has(key)) {
      map.set(
        key,
        []
      );
    }

    map.get(key)!
      .push(item);
  }

  return map;
}

/*
  Sections mensuelles d’une liste d’allocations, du mois
  le plus récent au plus ancien.
*/
function monthSections(
  list: FollowUpDetailItem[],
  keyPrefix: string,
  collapsible: boolean
): DetailSection[] {
  return Array
    .from(
      groupItems(
        list,

        item =>
          monthKey(
            item.allocationDate
          )
      ).entries()
    )
    .sort(
      (a, b) =>
        b[0].localeCompare(
          a[0]
        )
    )
    .map(
      ([
        month,
        monthItems,
      ]) => ({
        key:
          `${keyPrefix}${month}`,

        label:
          monthLabel(
            month
          ),

        total:
          groupTotal(
            monthItems
          ),

        items:
          monthItems,

        collapsible,
      })
    );
}

const monthGroups =
  computed<DetailGroup[]>(
    () =>
      monthSections(
        filteredItems.value,
        "",
        false
      ).map(
        section => ({
          key:
            section.key,

          label:
            section.label,

          total:
            section.total,

          items:
            section.items,

          sections:
            [section],
        })
      )
  );

/*
  Recherche transversale : un groupe par sous-catégorie,
  dans l’ordre habituel des catégories puis des
  sous-catégories, détaillé par mois.
*/
const subCategoryGroups =
  computed<DetailGroup[]>(
    () =>
      Array
        .from(
          groupItems(
            filteredItems.value,

            item =>
              `${item.categoryId}-${item.subCategoryId}`
          ).entries()
        )
        .map(
          ([
            key,
            list,
          ]) => {
            const category =
              categoriesStore
                .getCategory(
                  list[0].categoryId
                );

            const subCategory =
              category
                ?.subcategories
                .find(
                  item =>
                    item.id ===
                    list[0].subCategoryId
                );

            return {
              key,

              label:
                `${
                  category?.label ??
                  `#${list[0].categoryId}`
                } › ${
                  subCategory?.label ??
                  `#${list[0].subCategoryId}`
                }`,

              total:
                groupTotal(list),

              items:
                list,

              sections:
                monthSections(
                  list,
                  `${key}|`,
                  true
                ),

              categorySeq:
                category?.seq ??
                Number.MAX_SAFE_INTEGER,

              subCategorySeq:
                subCategory?.seq ??
                Number.MAX_SAFE_INTEGER,
            };
          }
        )
        .sort(
          (a, b) =>
            a.categorySeq -
              b.categorySeq ||
            a.subCategorySeq -
              b.subCategorySeq ||
            a.key.localeCompare(
              b.key
            )
        )
  );

const detailGroups =
  computed<DetailGroup[]>(
    () =>
      props.groupBySubCategory
        ? subCategoryGroups.value
        : monthGroups.value
  );

/* =========================================================
   COLLAPSE
========================================================= */

const openGroups =
  ref<Set<string>>(
    new Set()
  );

/*
  Les groupes et sections ouverts le restent lorsque la
  liste change. À défaut, le premier groupe est ouvert,
  ainsi que la première section de chaque groupe.
*/
watch(
  detailGroups,

  groups => {
    const collapsibleSections =
      (
        group: DetailGroup
      ) =>
        group.sections.filter(
          section =>
            section.collapsible
        );

    const availableKeys =
      new Set(
        groups.flatMap(
          group => [
            group.key,

            ...collapsibleSections(
              group
            ).map(
              section =>
                section.key
            ),
          ]
        )
      );

    const retained =
      new Set(
        [
          ...openGroups.value,
        ].filter(
          key =>
            availableKeys.has(
              key
            )
        )
      );

    if (
      groups.length &&
      !groups.some(
        group =>
          retained.has(
            group.key
          )
      )
    ) {
      retained.add(
        groups[0].key
      );
    }

    for (
      const group
      of groups
    ) {
      const sections =
        collapsibleSections(
          group
        );

      if (
        sections.length &&
        !sections.some(
          section =>
            retained.has(
              section.key
            )
        )
      ) {
        retained.add(
          sections[0].key
        );
      }
    }

    openGroups.value =
      retained;
  },

  {
    immediate:
      true,
  }
);

function toggleGroup(
  key: string
) {
  const next =
    new Set(
      openGroups.value
    );

  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }

  openGroups.value =
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

    await loadRequestedReallocations();

    initialized.value =
      true;

  } catch (err) {
    console.error(
      "FollowUpDetails initialization failed",
      err
    );

    actionError.value =
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
    v-if="detailsActive"
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
          in detailGroups
        "
        :key="group.key"
        class="month-block"
      >
        <!-- Group header -->

        <div
          class="grid month-header"
          :class="{
            primary:
              props.groupBySubCategory
          }"
          @click="
            toggleGroup(
              group.key
            )
          "
        >
          <div
            class="
              col-label
              month-toggle
            "
            :class="{
              wide:
                props.groupBySubCategory
            }"
          >
            <span>
              {{
                openGroups.has(
                  group.key
                )
                  ? "▼"
                  : "►"
              }}
            </span>

            {{ group.label }}

            <span
              v-if="
                props.groupBySubCategory
              "
              class="group-count"
            >
              ({{ group.items.length }})
            </span>
          </div>

          <div
            v-if="
              !props.groupBySubCategory
            "
          ></div>

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
              formatAmount(
                group.total
              )
            }}
          </div>

          <div
            v-if="
              !props.groupBySubCategory
            "
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
                formatInteger(
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

        <!-- Group sections -->

        <template
          v-if="
            openGroups.has(
              group.key
            )
          "
        >
          <template
            v-for="
              section
              in group.sections
            "
            :key="section.key"
          >
            <!-- Section header -->

            <div
              v-if="section.collapsible"
              class="grid month-header secondary"
              @click="
                toggleGroup(
                  section.key
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
                    openGroups.has(
                      section.key
                    )
                      ? "▼"
                      : "►"
                  }}
                </span>

                {{ section.label }}
              </div>

              <div></div>

              <div
                class="
                  col-spent
                  amount
                "
              >
                {{
                  formatAmount(
                    section.total
                  )
                }}
              </div>

              <div></div>
            </div>

            <!-- Section rows -->

            <div
              v-if="
                !section.collapsible ||
                openGroups.has(
                  section.key
                )
              "
            >
              <div
                v-for="
                  (
                    item,
                    index
                  )
                  in section.items
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
                      formatAmount(
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
          </template>
        </template>
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

   Mêmes colonnes et même marge horizontale que la grille
   de FollowUpView, pour aligner les montants sur la ligne
   Total et sur les en-têtes.
========================================================= */

.grid {
  display: grid;

  grid-template-columns:
    220px
    1fr
    90px
    90px;

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
  padding: 6px 12px;
  font-size: 0.8rem;
  font-style: italic;
  color: var(--text-soft);
  opacity: 0.85;
  transition: background 0.15s ease;
}

.month-header:hover {
  background: var(--primary-soft);
}

/*
  Recherche transversale : la sous-catégorie est le premier
  niveau, les mois sont en retrait au second niveau.
*/
.month-header.primary {
  font-style: normal;
  color: var(--text);
  opacity: 1;
}

.month-header.secondary {
  border-top: none;
  padding-left: 30px;
}

.month-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
}

/*
  Recherche transversale : le libellé « Catégorie ›
  Sous-catégorie » occupe aussi la colonne centrale.
*/
.month-toggle.wide {
  grid-column: span 2;
}

.group-count {
  font-weight: 400;
  color: var(--text-muted);
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
  padding: 3px 12px;
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