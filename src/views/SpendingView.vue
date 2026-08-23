<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";

import { useRouter } from "vue-router";

import PageHeader from "@/components/PageHeader.vue";
import AppIcon from "@/components/AppIcon.vue";
import ChipSelector from "@/components/ChipSelector.vue";
import DateChip from "@/components/DateChip.vue";

import { useStorageAccess } from "@/composables/useStorageAccess";
import { useDriveWatcher } from "@/composables/useDriveWatcher";
import { useDriveJsonFile } from "@/composables/useDriveJsonFile";

import { useAppBootstrap } from "@/composables/useAppBootstrap";

import {
  useSpending,
  type SpendingWithStatus,
  type AllocationStatus,
} from "@/composables/spending/useSpending";

import {
  releaseDraftsBatch,
} from "@/composables/allocations/releaseBatch";

import {
  listFiles,
  loadJSONFromFolder,
} from "@/services/driveAdapter";

import {
  transformSpendingRaw,
} from "@/spending/transformSpendingRaw";

import {
  formatDate,
} from "@/utils/dateFormat";

import {
  formatAmount,
} from "@/utils/amountFormat";

import { prefixEventFileName } from "@/utils/eventFileName";

/* =========================
   Router / storage
========================= */

const router =
  useRouter();

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
   Store
========================= */

const spending =
  useSpending();

/* =========================
   View state
========================= */

const loading =
  ref(false);

const loadError =
  ref<string | null>(null);

const initialized =
  ref(false);

/* =========================
   Watcher state
========================= */

const draftsState =
  ref<string | null>(null);

const releasedState =
  ref<string | null>(null);

const card24StatusState =
  ref<string | null>(null);

/* =========================
   Filters
========================= */

const SPENDING_FILTERS_KEY =
  "spendingFilters";

const filtersOpen =
  ref(false);

const ownerFilter =
  ref<Set<string>>(
    new Set()
  );

const statusFilter =
  ref<Set<AllocationStatus>>(
    new Set()
  );

const currencyFilter =
  ref<Set<string>>(
    new Set()
  );

const dateFrom =
  ref("");

const dateTo =
  ref("");

const minAmount =
  ref<number | null>(
    null
  );

const maxAmount =
  ref<number | null>(
    null
  );

/* =========================
   Collapse accounts
========================= */

const collapsedAccounts =
  ref<Set<string>>(
    new Set()
  );

function toggleAccount(
  id: string
) {
  if (
    collapsedAccounts.value.has(
      id
    )
  ) {
    collapsedAccounts.value.delete(
      id
    );

    return;
  }

  collapsedAccounts.value.add(
    id
  );
}

function isCollapsed(
  id: string
): boolean {
  return collapsedAccounts.value.has(
    id
  );
}

/* =========================
   Accounts / owners
========================= */

const accounts =
  computed(() =>
    spending.accounts.value
  );

const availableOwners =
  computed(() => {
    const owners =
      new Set<string>();

    for (
      const record
      of spending.records.value
    ) {
      if (record.owner) {
        owners.add(
          record.owner
        );
      }
    }

    return Array
      .from(owners)
      .sort();
  });

const ownerItems =
  computed(() =>
    availableOwners.value.map(
      owner => ({
        id: owner,
        label:
          owner || "-",
      })
    )
  );

const ownerFilterArray =
  computed<string[]>({
    get: () =>
      Array.from(
        ownerFilter.value
      ),

    set: value => {
      ownerFilter.value =
        new Set(value);
    },
  });

/* =========================
   Status filters
========================= */

const allStatuses:
  AllocationStatus[] = [
    "none",
    "partial",
    "draft",
    "released",
  ];

const statusItems =
  computed(() =>
    allStatuses.map(
      status => ({
        id: status,
        label: status,
      })
    )
  );

const statusFilterArray =
  computed<AllocationStatus[]>({
    get: () =>
      Array.from(
        statusFilter.value
      ),

    set: value => {
      statusFilter.value =
        new Set(value);
    },
  });

/* =========================
   Currency filters
========================= */

const availableCurrencies =
  computed(() => {
    const currencies =
      new Set<string>();

    for (
      const record
      of spending.records.value
    ) {
      if (
        record.currency &&
        record.currency !== "CHF" &&
        record.foreignAmount != null
      ) {
        currencies.add(
          record.currency
        );
      }
    }

    if (
      currencies.size === 0
    ) {
      return [];
    }

    return [
      "CHF",
      ...Array
        .from(currencies)
        .sort(),
    ];
  });

const currencyItems =
  computed(() =>
    availableCurrencies.value.map(
      currency => ({
        id: currency,
        label: currency,
      })
    )
  );

const currencyFilterArray =
  computed<string[]>({
    get: () =>
      Array.from(
        currencyFilter.value
      ),

    set: value => {
      currencyFilter.value =
        new Set(value);
    },
  });

/* =========================
   Filter helpers
========================= */

function resetFilters() {
  ownerFilter.value =
    new Set();

  statusFilter.value =
    new Set();

  currencyFilter.value =
    new Set();

  dateFrom.value = "";
  dateTo.value = "";

  minAmount.value =
    null;

  maxAmount.value =
    null;

  sessionStorage.removeItem(
    SPENDING_FILTERS_KEY
  );
}

function isForeign(
  record: SpendingWithStatus
): boolean {
  return Boolean(
    record.foreignAmount != null &&
    record.currency &&
    record.currency !== "CHF"
  );
}

function applyFilters(
  records: SpendingWithStatus[]
): SpendingWithStatus[] {
  return records.filter(
    record => {
      if (
        statusFilter.value.size &&
        !statusFilter.value.has(
          record.allocationStatus
        )
      ) {
        return false;
      }

      if (
        ownerFilter.value.size &&
        !ownerFilter.value.has(
          record.owner
        )
      ) {
        return false;
      }

      if (
        currencyFilter.value.size
      ) {
        const recordCurrency =
          isForeign(record)
            ? record.currency!
            : "CHF";

        if (
          !currencyFilter.value.has(
            recordCurrency
          )
        ) {
          return false;
        }
      }

      if (
        dateFrom.value &&
        record.date <
          dateFrom.value
      ) {
        return false;
      }

      if (
        dateTo.value &&
        record.date >
          dateTo.value
      ) {
        return false;
      }

      const absoluteAmount =
        Math.abs(
          record.amount
        );

      if (
        minAmount.value !== null &&
        absoluteAmount <
          minAmount.value
      ) {
        return false;
      }

      if (
        maxAmount.value !== null &&
        absoluteAmount >
          maxAmount.value
      ) {
        return false;
      }

      return true;
    }
  );
}

function saveFiltersToSession() {
  sessionStorage.setItem(
    SPENDING_FILTERS_KEY,

    JSON.stringify({
      owner:
        Array.from(
          ownerFilter.value
        ),

      status:
        Array.from(
          statusFilter.value
        ),

      currency:
        Array.from(
          currencyFilter.value
        ),

      dateFrom:
        dateFrom.value,

      dateTo:
        dateTo.value,

      minAmount:
        minAmount.value,

      maxAmount:
        maxAmount.value,

      filtersOpen:
        filtersOpen.value,
    })
  );
}

function restoreFiltersFromSession() {
  const raw =
    sessionStorage.getItem(
      SPENDING_FILTERS_KEY
    );

  if (!raw) {
    return;
  }

  try {
    const saved =
      JSON.parse(raw);

    ownerFilter.value =
      new Set(
        saved.owner ?? []
      );

    statusFilter.value =
      new Set(
        saved.status ?? []
      );

    currencyFilter.value =
      new Set(
        saved.currency ?? []
      );

    dateFrom.value =
      saved.dateFrom ?? "";

    dateTo.value =
      saved.dateTo ?? "";

    minAmount.value =
      saved.minAmount ?? null;

    maxAmount.value =
      saved.maxAmount ?? null;

    filtersOpen.value =
      saved.filtersOpen ?? false;

  } catch {
    // Ignore corrupted session storage.
  }
}

/* =========================
   Records / totals
========================= */

function recordsFor(
  accountId: string
): SpendingWithStatus[] {
  return applyFilters(
    spending
      .getRecordsForAccount(
        accountId
      )
  );
}

function totalFor(
  accountId: string
): number {
  return recordsFor(
    accountId
  ).reduce(
    (
      total,
      record
    ) =>
      total +
      record.amount,

    0
  );
}

const remainingAmount =
  computed(() =>
    accounts.value.reduce(
      (
        total,
        account
      ) =>
        total +
        totalFor(
          account.id
        ),

      0
    )
  );

const absRemainingAmount =
  computed(() =>
    Math.abs(
      remainingAmount.value
    )
  );

/* =========================
   Navigation
========================= */

async function openFollowUp() {
  await router.push({
    name: "followup",
  });
}

async function openAllocation(
  record: SpendingWithStatus
) {
  await router.push({
    name: "allocation",

    params: {
      id: record.id,
    },
  });
}

/* =========================
   Card24 download
========================= */

const card24Downloading =
  ref(false);

const card24PendingFileName =
  ref<string | null>(null);

const CARD24_STATUS_FOLDER =
  "events/status";

const CARD24_PENDING_KEY =
  "card24PendingEvent";

const CARD24_TIMEOUT_MS =
  5 * 60 * 1000; // safety net: 5 min

let card24TimeoutHandle:
  number | null = null;

function buildCard24EventFileName():
  string {
  const now  = new Date();
  const YYYY = now.getFullYear();
  const MM   = String(now.getMonth() + 1).padStart(2, "0");
  const DD   = String(now.getDate()).padStart(2, "0");
  const HH   = String(now.getHours()).padStart(2, "0");
  const mm   = String(now.getMinutes()).padStart(2, "0");
  const ss   = String(now.getSeconds()).padStart(2, "0");

  const baseFileName =
    `BAT_${YYYY}${MM}${DD}${HH}${mm}${ss}_Card24Download.json`;

  return prefixEventFileName(
    baseFileName
  );
}

function clearCard24Pending() {
  card24Downloading.value =
    false;

  card24PendingFileName.value =
    null;

  localStorage.removeItem(
    CARD24_PENDING_KEY
  );

  if (card24TimeoutHandle !== null) {
    window.clearTimeout(
      card24TimeoutHandle
    );

    card24TimeoutHandle =
      null;
  }
}

function armCard24Timeout(
  remainingMs: number =
    CARD24_TIMEOUT_MS
) {
  if (card24TimeoutHandle !== null) {
    window.clearTimeout(
      card24TimeoutHandle
    );
  }

  card24TimeoutHandle =
    window.setTimeout(() => {
      if (card24Downloading.value) {
        loadError.value =
          "Card24 : pas de réponse du backend après 5 minutes.";

        clearCard24Pending();
      }
    }, Math.max(remainingMs, 0));
}

/*
  Checks whether a status file for this event has appeared yet.
  Returns true once the pending state has been resolved (success
  or error), false if it's still in progress.
*/
async function checkCard24Status(
  fileName: string
): Promise<boolean> {
  try {
    const status =
      await loadJSONFromFolder<{
        status: string;
        message?: string;
      }>(
        CARD24_STATUS_FOLDER,
        fileName
      );

    if (!status) {
      return false;
    }

    if (status.status === "error") {
      loadError.value =
        status.message ||
        "Card24 download failed";
    }

    clearCard24Pending();

    return true;

  } catch {
    // Status file not there yet, keep waiting.
    return false;
  }
}

async function onDownloadCard24() {
  if (!storageReady.value) {
    loadError.value =
      storageUnavailableMessage.value ||
      "Storage not available.";

    return;
  }

  if (card24Downloading.value) {
    return;
  }

  card24Downloading.value =
    true;

  try {
    const event = {
      type:      "BATCH_REQUESTED",
      version:   1,
      timestamp: new Date().toISOString(),
      payload: {
        script: "Card24Download",
        reason: "CARD24_DOWNLOAD_REQUESTED",
      },
    };

    const fileName =
      buildCard24EventFileName();

    const { save } =
      useDriveJsonFile(
        "events",
        fileName
      );

    await save(event);

    card24PendingFileName.value =
      fileName;

    localStorage.setItem(
      CARD24_PENDING_KEY,

      JSON.stringify({
        fileName,
        startedAt: Date.now(),
      })
    );

    armCard24Timeout();

    // In case the backend already ran between save() and now.
    await checkCard24Status(
      fileName
    );

  } catch (err) {
    console.error(
      "Card24 event publish failed",
      err
    );

    loadError.value =
      err instanceof Error
        ? err.message
        : "Card24 event publish failed";

    clearCard24Pending();
  }
}

useDriveWatcher({
  folderId: CARD24_STATUS_FOLDER,

  lastKnownState:
    card24StatusState,

  onChanged:
    async () => {
      if (
        !card24PendingFileName.value
      ) {
        return;
      }

      await checkCard24Status(
        card24PendingFileName.value
      );
    },
});

onMounted(() => {
  const raw =
    localStorage.getItem(
      CARD24_PENDING_KEY
    );

  if (!raw) {
    return;
  }

  try {
    const pending =
      JSON.parse(raw) as {
        fileName: string;
        startedAt: number;
      };

    const elapsed =
      Date.now() - pending.startedAt;

    if (elapsed >= CARD24_TIMEOUT_MS) {
      localStorage.removeItem(
        CARD24_PENDING_KEY
      );

      return;
    }

    card24Downloading.value =
      true;

    card24PendingFileName.value =
      pending.fileName;

    armCard24Timeout(
      CARD24_TIMEOUT_MS - elapsed
    );

    // The backend may have finished while the app was closed/reloaded.
    checkCard24Status(
      pending.fileName
    );

  } catch {
    localStorage.removeItem(
      CARD24_PENDING_KEY
    );
  }
});

/* =========================
   FX popover
========================= */

const fxPopover =
  ref<{
    record: SpendingWithStatus;
    x: number;
    y: number;
  } | null>(null);

let fxTimer:
  number | null = null;

function showFxPopover(
  event: MouseEvent,
  record: SpendingWithStatus
) {
  if (
    !isForeign(record)
  ) {
    return;
  }

  const target =
    event.currentTarget as
      HTMLElement;

  const rect =
    target.getBoundingClientRect();

  fxPopover.value = {
    record,
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

/* =========================
   Release drafts
========================= */

const draftRecords =
  computed(() =>
    spending
      .getReleaseableDraftRecords()
  );

const draftCount =
  computed(() =>
    draftRecords.value.length
  );

const canReleaseAll =
  computed(() =>
    draftCount.value > 0
  );

async function releaseAllDrafts() {
  if (
    !canReleaseAll.value
  ) {
    return;
  }

  const confirmed =
    confirm(
      `Release ${draftCount.value} draft(s)?\n` +
      "This action cannot be undone."
    );

  if (!confirmed) {
    return;
  }

  await releaseDraftsBatch(
    draftRecords.value
  );

  await loadAllocationStatus();
}

/* =========================
   Storage loaders
========================= */

async function loadSpending() {
  const raw =
    await loadJSONFromFolder<any>(
      "spending",
      "spending.json"
    );

  if (!raw) {
    spending.clear();

    throw new Error(
      "spending.json not found"
    );
  }

  /*
    Certains exports peuvent contenir modifiedTime.
    Le watcher utilise sinon les métadonnées du backend.
  */
  if (raw.modifiedTime) {
    spending
      .setSpendingLastModified(
        raw.modifiedTime
      );
  }

  const {
    accounts:
      transformedAccounts,

    records:
      transformedRecords,
  } = transformSpendingRaw(
    raw.items
  );

  spending.replaceAll(
    transformedAccounts,
    transformedRecords
  );

  await loadAllocationStatus();
}

async function loadAllocationStatus() {
  const draftsFolder =
    "allocations/drafts";

  const releasedFolder =
    "allocations/released";

  const [
    draftFiles,
    releasedFiles,
  ] = await Promise.all([
    listFiles(
      draftsFolder
    ),

    listFiles(
      releasedFolder
    ),
  ]);

  const draftIds =
    new Set<string>();

  const readyDraftIds =
    new Set<string>();

  for (
    const file
    of draftFiles
  ) {
    if (
      !file.name.endsWith(
        ".json"
      )
    ) {
      continue;
    }

    const id =
      file.name.replace(
        /\.json$/i,
        ""
      );

    draftIds.add(id);

    try {
      const raw =
        await loadJSONFromFolder<any>(
          draftsFolder,
          file.name
        );

      if (
        raw?.toProcess === true
      ) {
        readyDraftIds.add(id);
      }

    } catch (err) {
      console.warn(
        "[AllocationStatus] Invalid draft ignored:",
        file.name,
        err
      );
    }
  }

  const releasedIds =
    new Set<string>(
      releasedFiles
        .filter(file =>
          file.name.endsWith(
            ".json"
          )
        )
        .map(file =>
          file.name.replace(
            /\.json$/i,
            ""
          )
        )
    );

  spending.applyAllocationStatus(
    draftIds,
    releasedIds,
    readyDraftIds
  );
}

/* =========================
   Watchers
========================= */

/*
  Nom historique conservé.
  Le watcher utilise la façade multi-backend.
*/

useDriveWatcher({
  folderId: "spending",
  fileName: "spending.json",

  lastKnownState:
    spending.spendingLastModified,

  onChanged:
    async () => {
      if (
        !storageReady.value
      ) {
        return;
      }

      await loadSpending();
    },
});

useDriveWatcher({
  folderId:
    "allocations/drafts",

  lastKnownState:
    draftsState,

  onChanged:
    async () => {
      if (
        !storageReady.value
      ) {
        return;
      }

      await loadAllocationStatus();
    },
});

useDriveWatcher({
  folderId:
    "allocations/released",

  lastKnownState:
    releasedState,

  onChanged:
    async () => {
      if (
        !storageReady.value
      ) {
        return;
      }

      await loadAllocationStatus();
    },
});

watch(
  storageReady,
  ready => {
    if (!ready) {
      initialized.value =
        false;

      spending.clear();
    }
  }
);

watch(
  [
    ownerFilter,
    statusFilter,
    currencyFilter,
    dateFrom,
    dateTo,
    minAmount,
    maxAmount,
    filtersOpen,
  ],

  saveFiltersToSession,

  {
    deep: true,
  }
);

/* =========================
   Initialization
========================= */

async function initializeView() {
  if (
    loading.value
  ) {
    return;
  }

  loading.value =
    true;

  loadError.value =
    null;

  try {
    const ready =
      await ensureStorageReady();

    if (!ready) {
      await router.replace({
        name:
          "authentication",
      });

      return;
    }

    await loadSettings();
    await loadSpending();

    initialized.value =
      true;

  } catch (err) {
    console.error(
      "Spending initialization failed",
      err
    );

    loadError.value =
      err instanceof Error
        ? err.message
        : String(err);

  } finally {
    loading.value =
      false;
  }
}

onMounted(async () => {
  restoreFiltersFromSession();

  await initializeView();
});

/* =========================
   Sticky sizing
========================= */

const stickyRef =
  ref<HTMLElement | null>(
    null
  );

let resizeObserver:
  ResizeObserver | null =
    null;

onMounted(() => {
  const element =
    stickyRef.value;

  if (!element) {
    return;
  }

  const applyHeight = () => {
    const height =
      element
        .getBoundingClientRect()
        .height;

    element.style.setProperty(
      "--sticky-height",
      `${Math.ceil(height)}px`
    );
  };

  applyHeight();

  resizeObserver =
    new ResizeObserver(
      applyHeight
    );

  resizeObserver.observe(
    element
  );
});

onBeforeUnmount(() => {
  closeFxPopover();

  if (
    resizeObserver &&
    stickyRef.value
  ) {
    resizeObserver.unobserve(
      stickyRef.value
    );
  }

  resizeObserver =
    null;

  // Note: intentionally NOT clearing card24 pending state here —
  // it must survive a reload/navigation so the hourglass can resume.
  if (card24TimeoutHandle !== null) {
    window.clearTimeout(
      card24TimeoutHandle
    );

    card24TimeoutHandle =
      null;
  }
});
</script>

<template>
  <PageHeader
    title="Spending"
    icon="spending"
  >
    <template #actions>
      <div class="header-actions">
        <div class="header-group">
          <AppIcon
            name="followup"
            :size="32"
            class="header-icon"
            title="Follow up"
            @click="openFollowUp"
          />
        </div>

        <div
          class="header-group danger"
          :class="{
            disabled:
              !canReleaseAll
          }"
          :title="
            canReleaseAll
              ? 'Release all drafts'
              : 'No drafts to release'
          "
          @click="
            canReleaseAll &&
            releaseAllDrafts()
          "
        >
          <AppIcon
            name="rss"
            :size="32"
            class="header-icon"
          />
        </div>
      </div>
    </template>
  </PageHeader>

  <div
    v-if="!storageReady"
    class="loading-state"
  >
    {{
      storageUnavailableMessage ||
      "Storage not available."
    }}
  </div>

  <div
    v-else-if="
      loading &&
      !initialized
    "
    class="loading-state"
  >
    Loading spending…
  </div>

  <div
    v-else-if="loadError"
    class="loading-state error"
  >
    {{ loadError }}
  </div>

  <div
    v-else
    class="spending-scroll"
  >
    <!-- Sticky filters -->

    <div
      ref="stickyRef"
      class="sticky-zone"
    >
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

          <h2>Filters</h2>

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
            v-model="
              ownerFilterArray
            "
            label="Owner"
            :items="ownerItems"
            :multiple="true"
            :show-all="true"
            :align-with-content="
              true
            "
          />

          <ChipSelector
            v-model="
              statusFilterArray
            "
            label="Status"
            :items="statusItems"
            :multiple="true"
            :show-all="true"
            :align-with-content="
              true
            "
          />

          <ChipSelector
            v-if="
              availableCurrencies.length >
              0
            "
            v-model="
              currencyFilterArray
            "
            label="Currency"
            :items="currencyItems"
            :multiple="true"
            :show-all="true"
            :align-with-content="
              true
            "
          />

          <div class="filter-row with-label">
            <span class="label">
              Period
            </span>

            <div class="filter-content">
              <div class="dates-row">
                <DateChip
                  v-model="dateFrom"
                  placeholder="From"
                />

                <DateChip
                  v-model="dateTo"
                  placeholder="To"
                />
              </div>
            </div>
          </div>

          <div class="filter-row with-label">
            <span class="label">
              Amount
            </span>

            <div class="filter-content">
              <div class="amount-inputs">
                <input
                  v-model.number="
                    minAmount
                  "
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Min"
                />

                <input
                  v-model.number="
                    maxAmount
                  "
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Max"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- Accounts -->

    <div class="spending-view">
      <section
        v-for="
          account
          in accounts
        "
        :key="account.id"
        class="account"
      >
        <div class="account-separator"></div>

    <header
      class="account-header clickable"
      @click="toggleAccount(account.id)"
    >
      <div class="account-title">
        <span class="arrow">
          {{ isCollapsed(account.id) ? "►" : "▼" }}
        </span>

        <h2>{{ account.label }}</h2>

        <span class="ops-count">
          {{ recordsFor(account.id).length }} ops
        </span>
        <!-- Bouton download Card24 — uniquement pour Global Card -->
        <button
          v-if="account.label.toLowerCase().includes('card')"
          class="btn-download-card24"
          :disabled="card24Downloading"
          title="Télécharger les transactions Card24"
          @click.stop="onDownloadCard24()"
        >
          {{ card24Downloading ? "⏳" : "⬇" }}
        </button>

      </div>

      <div
        class="total right"
        :class="totalFor(account.id) >= 0 ? 'positive' : 'negative'"
      >
        {{ formatAmount(totalFor(account.id), { showPlus: true }) }}
      </div>
    </header>
        <table
          v-if="
            !isCollapsed(
              account.id
            )
          "
          class="spending-table"
        >
          <colgroup>
            <col class="col-date">
            <col class="col-party">
            <col class="col-owner">
            <col class="col-status">
            <col class="col-currency">
            <col class="col-amount">
          </colgroup>

          <thead>
            <tr>
              <th>Date</th>
              <th>Party</th>
              <th>Owner</th>
              <th>Status</th>
              <th class="currency-col"></th>
              <th class="right">
                Amount
              </th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="
                record
                in recordsFor(
                  account.id
                )
              "
              :key="record.id"
              class="row"
              @click="
                openAllocation(
                  record
                )
              "
            >
              <td>
                {{
                  formatDate(
                    record.date,
                    "compact"
                  )
                }}
              </td>

              <td>
                {{ record.party }}
              </td>

              <td>
                {{ record.owner }}
              </td>

              <td>
                <span
                  :class="[
                    'status-pill',
                    record
                      .allocationStatus
                  ]"
                >
                  {{
                    record
                      .allocationStatus
                  }}
                </span>
              </td>

              <td class="currency-cell">
                <span
                  v-if="
                    isForeign(
                      record
                    )
                  "
                  class="fx-code"
                >
                  {{ record.currency }}
                </span>
              </td>

              <td
                class="right amount-cell"
                :class="[
                  record.amount >= 0
                    ? 'positive'
                    : 'negative',

                  {
                    foreign:
                      isForeign(
                        record
                      )
                  }
                ]"
                @click.stop="
                  showFxPopover(
                    $event,
                    record
                  )
                "
              >
                {{
                  isForeign(
                    record
                  )
                    ? formatAmount(
                        record.amount >= 0
                          ? Math.abs(
                              record.foreignAmount ??
                              0
                            )
                          : -Math.abs(
                              record.foreignAmount ??
                              0
                            ),
                        {
                          showPlus: true
                        }
                      )
                    : formatAmount(
                        record.amount,
                        {
                          showPlus: true
                        }
                      )
                }}
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </div>

  <div
    v-if="fxPopover"
    class="fx-popover"
    :style="{
      top:
        fxPopover.y +
        'px',

      left:
        fxPopover.x +
        'px'
    }"
    @click.stop="
      closeFxPopover
    "
  >
    {{
      formatAmount(
        fxPopover.record.amount,
        {
          showPlus: true
        }
      )
    }}
    CHF
  </div>
</template>

<style scoped>
/* =========================================================
   HEADER ACTIONS
========================================================= */

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-group {
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.header-group + .header-group {
  padding-left: 12px;
  border-left: 1px solid var(--border);
}

.header-group.danger .header-icon {
  color: var(--negative);
}

.header-group.danger:not(.disabled):hover .header-icon {
  background: var(--primary-soft);
  border-radius: 6px;
}

.header-group.disabled {
  opacity: 0.35;
  cursor: default;
  pointer-events: none;
}

/* =========================================================
   LOAD STATES
========================================================= */

.loading-state {
  padding: 1rem;
  color: var(--text-soft);
}

.loading-state.error {
  color: var(--negative);
}

/* =========================================================
   ROOT SCROLL
========================================================= */

.spending-scroll {
  height: calc(100vh - 64px);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  background: var(--bg);
}

/* =========================================================
   STICKY ZONE
========================================================= */

.sticky-zone {
  position: sticky;
  top: 0;
  z-index: 200;

  background:
    color-mix(
      in srgb,
      var(--bg) 92%,
      transparent
    );

  border-bottom:
    1px solid
    var(--border);

  --sticky-height: 48px;
}

.filters {
  font-size: var(--font-size-sm);
  background: var(--bg);
}

.filters-header {
  padding: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filters-header h2 {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-soft);
}

.dates-row {
  display: flex;
  gap: 10px;
}

.reset-button {
  padding: 2px 20px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface-soft);
  color: var(--text-soft);
  font-size: var(--font-size-xs);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.reset-button:hover {
  background: var(--primary-soft);
  border-color: var(--primary);
  color: var(--primary);
}

.filters-body {
  padding: 0.5rem 0.5rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.filter-row.with-label {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr);
  align-items: center;
  gap: 0.75rem;
}

.filter-content {
  min-width: 0;
}

.amount-inputs {
  display: flex;
  gap: 10px;
}

.label {
  font-size: 0.9rem;
  color: var(--text-soft);
}

/* =========================================================
   INPUTS
========================================================= */

.filter-row input:not(.hidden-date-input) {
  height: 30px;
  padding: 0 8px;

  border-radius: 18px;
  border: 1px solid var(--border);

  background: var(--surface);
  color: var(--text);

  font-size: var(--font-size-xs);
  font-weight: 600;
  font-family: inherit;
}

.filter-row.with-label .filter-content {
  min-width: 0;
  margin-left: -14px;
}

.filter-row input[type="date"] {
  width: 120px;
  letter-spacing: 0.04rem;
}

.filter-row input[type="number"] {
  width: 80px;
}

.filter-row input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary-soft);
}

/* =========================================================
   ACCOUNT HEADER
========================================================= */

.spending-view {
  padding-bottom: 1rem;
}

.account {
  margin-bottom: 0.75rem;
}

.account-separator {
  height: 1px;
  background: var(--border);
  margin: 0.25rem 0 0.5rem;
}

.account-header {
  position: sticky;
  top: var(--sticky-height);
  z-index: 120;

  background:
    color-mix(
      in srgb,
      var(--surface-soft) 90%,
      transparent
    );

  border-top:
    1px solid
    var(--border);

  border-bottom:
    1px solid
    var(--border);

  display: grid;
  grid-template-columns:
    110px
    minmax(0, 1fr)
    110px
    100px
    50px
    120px;

  column-gap: 0.5rem;

  padding: 0.25rem 0;
  align-items: center;
}

.account-title {
  grid-column: 1 / 6;
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  padding-left: 0.5rem;
  flex-wrap: wrap;
  min-width: 0;
}

.account-title h2 {
  font-size: var(--font-size-lg);
  font-weight: 600;
  margin: 0;
}

.ops-count {
  font-size: var(--font-size-sm);
  opacity: 0.6;
  white-space: nowrap;
}

.total {
  grid-column: 6 / 7;
  font-weight: 600;
  text-align: right;
  padding-right: 0.5rem;
}

.btn-download-card24 {
  background: transparent;
  border: none;
  color: #555;
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0 4px;
  margin-left: 6px;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.btn-download-card24:hover {
  opacity: 1;
  color: #aaa;
}

/* =========================================================
   TABLE
========================================================= */

.spending-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: var(--font-size-md);
}

.spending-table col.col-date {
  width: 110px;
}

.spending-table col.col-party {
  width: auto;
}

.spending-table col.col-owner {
  width: 110px;
}

.spending-table col.col-status {
  width: 100px;
}

.spending-table col.col-currency {
  width: 50px;
}

.spending-table col.col-amount {
  width: 100px;
}

.spending-table th,
.spending-table td {
  padding: 8px;
  border-bottom: 1px solid var(--border);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.spending-table tbody tr:nth-child(even) {
  background: var(--surface-soft);
}

.spending-table th:nth-child(1),
.spending-table td:nth-child(1) {
  text-align: center;
}

.spending-table th:nth-child(2),
.spending-table td:nth-child(2) {
  text-align: left;
}

.spending-table th:nth-child(3),
.spending-table td:nth-child(3),
.spending-table th:nth-child(4),
.spending-table td:nth-child(4) {
  text-align: center;
}

.spending-table th:nth-child(5),
.spending-table td:nth-child(5) {
  text-align: left;
}

.spending-table th:nth-child(6),
.spending-table td:nth-child(6) {
  text-align: right;
}

/* =========================================================
   STATUS
========================================================= */

.status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: var(--font-size-xs);
  font-weight: 600;
  text-transform: uppercase;
  border: 1px solid transparent;
  margin: 0 auto;
}

.status-pill.none {
  background: var(--bg-soft);
  color: var(--text-soft);
  border-color: var(--border);
}

.status-pill.partial {
  background:
    color-mix(
      in srgb,
      var(--warning) 15%,
      transparent
    );

  color: var(--warning);
  border-color: var(--warning);
}

.status-pill.draft {
  background: var(--primary-soft);
  color: var(--primary);
  border-color: var(--primary);
}

.status-pill.released {
  background:
    color-mix(
      in srgb,
      var(--positive) 15%,
      transparent
    );

  color: var(--positive);
  border-color: var(--positive);
}

/* =========================================================
   FX
========================================================= */

.currency-cell {
  text-align: left;
  padding-left: 0;
  padding-right: 0;
}

.amount-cell {
  text-align: right;
  padding-left: 0;
  padding-right: 8px;
}

.fx-code {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--primary);
}

.amount-cell.foreign {
  cursor: pointer;
}

.amount-cell.positive,
.total.positive {
  color: var(--positive);
}

.amount-cell.negative,
.total.negative {
  color: var(--negative);
}

.fx-popover {
  position: fixed;
  transform: translate(-100%, -100%);
  background: var(--surface);
  color: var(--text);
  padding: 6px 10px;
  border-radius: 10px;
  font-size: var(--font-size-xs);
  font-weight: 600;
  white-space: nowrap;
  box-shadow: var(--shadow-md);
  animation: fxFade 0.15s ease-out;
  z-index: 1000;
}

@keyframes fxFade {
  from {
    opacity: 0;
    transform:
      translate(
        -100%,
        -90%
      )
      scale(0.95);
  }

  to {
    opacity: 1;
    transform:
      translate(
        -100%,
        -100%
      )
      scale(1);
  }
}
</style>