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
import PillButton from "@/components/ui/PillButton.vue";
import StatusPill from "@/components/ui/StatusPill.vue";
import AccountSection from "@/components/spending/AccountSection.vue";
import MovementRow from "@/components/spending/MovementRow.vue";
import type { StatusTone } from "@/components/ui/StatusPill.vue";
import MovementFilters from "@/components/spending/MovementFilters.vue";

import { useStorageAccess } from "@/composables/useStorageAccess";
import { useDriveWatcher } from "@/composables/useDriveWatcher";
import { useEventRequest } from "@/composables/useEventRequest";

import { useAppBootstrap } from "@/composables/useAppBootstrap";
import { useMovementLabel } from "@/composables/spending/useMovementLabel";

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
  useRemoteJson,
} from "@/composables/useRemoteJson";

import { useRememberRequest } from "@/composables/allocations/useRememberRequest";
import { usePersistentRef } from "@/composables/usePersistentRef";
import { useMovementFilters } from "@/composables/spending/useMovementFilters";

import {
  readSpending,
  SPENDING_FILE,
  SPENDING_FOLDER,
} from "@/contracts/spending";

import { confirmDialog } from "@/services/dialog/appDialog";
import { hasCapability } from "@/services/environment/environmentState";

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

const movementLabel =
  useMovementLabel();

/* =========================
   View state
========================= */

/*
  Connexion au stockage et référentiels communs.
*/
const bootstrapping =
  ref(false);

const bootstrapped =
  ref(false);

/*
  Erreur de démarrage ou d’une action (Card24, release) ;
  elle prime sur l’erreur de chargement.
*/
const actionError =
  ref<string | null>(null);

/*
  Mouvements à allouer, relus dès que spending.json change
  sur le stockage. Contrat : src/contracts/spending.ts.
*/
const spendingFile =
  useRemoteJson({
    folder:
      SPENDING_FOLDER,

    file:
      SPENDING_FILE,

    read:
      readSpending,
  });

const loading =
  computed(() =>
    bootstrapping.value ||
    spendingFile.loading.value
  );

const loadError =
  computed(() =>
    actionError.value ??
    spendingFile.error.value
  );

const initialized =
  computed(() =>
    bootstrapped.value &&
    spendingFile.data.value !== null
  );

/* =========================
   Watcher state
========================= */

const draftsState =
  ref<string | null>(null);

const releasedState =
  ref<string | null>(null);

/* =========================
   Filters
========================= */

const SPENDING_FILTERS_KEY =
  "spendingFilters";

/* Téléchargement Card24 : capacité de l'environnement (§3.4). */
const card24Enabled =
  hasCapability("card24");

/*
  Seconde ligne des écritures (texte de la banque) :
  préférence d'affichage de l'appareil, gardée hors des
  filtres (Reset n'y touche pas). Masquée : lignes plus
  basses.
*/
const showBankText =
  usePersistentRef("spending.showBankText", true);

/*
  Statut d'allocation et saisie de l'iPhone : filtres propres
  à Spending, ajoutés aux filtres communs des mouvements.
*/
const statusFilter =
  ref<Set<AllocationStatus>>(
    new Set()
  );

/*
  Mouvement lié à une saisie de l'iPhone : candidat mobile
  dans spending.json (capacité mobileExpense,
  ../Backend/docs/mobile-expense-contract.md, § 7). Pastille
  « iPhone » à la place de « none » (un mouvement lié est un
  draft latent), statut seul dès qu'un draft existe ; filtre
  « Entry ».
*/
const mobileEnabled =
  hasCapability("mobileExpense");

function isMobileLinked(
  record: SpendingWithStatus
): boolean {
  return (
    mobileEnabled &&
    record.suggestions.some(
      suggestion => suggestion.source === "mobile"
    )
  );
}

const MOBILE_ENTRY = "iphone";

const entryItems = [
  { id: MOBILE_ENTRY, label: "iPhone" },
];

const entryFilter =
  ref<string[]>([]);

const movementFilters =
  useMovementFilters<SpendingWithStatus>({
    records:
      () => spending.records.value,

    loaded:
      () => spendingFile.data.value !== null,

    sessionKey:
      SPENDING_FILTERS_KEY,

    extension: {
      matches:
        record =>
          (
            !statusFilter.value.size ||
            statusFilter.value.has(
              record.allocationStatus
            )
          ) &&
          (
            !mobileEnabled ||
            !entryFilter.value.includes(MOBILE_ENTRY) ||
            isMobileLinked(record)
          ),

      reset: () => {
        statusFilter.value =
          new Set();

        entryFilter.value =
          [];
      },

      snapshot: () => ({
        status:
          Array.from(
            statusFilter.value
          ),

        entry:
          entryFilter.value,
      }),

      restore: saved => {
        statusFilter.value =
          new Set(
            Array.isArray(saved.status)
              ? saved.status as AllocationStatus[]
              : []
          );

        entryFilter.value =
          Array.isArray(saved.entry) &&
          saved.entry.includes(MOBILE_ENTRY)
            ? [MOBILE_ENTRY]
            : [];
      },
    },
  });

const {
  applyFilters,
  selectedYearEmpty,
} = movementFilters;

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
   Accounts
========================= */

const accounts =
  computed(() =>
    spending.accounts.value
  );

/* =========================
   Status filters
========================= */

const STATUS_TONES:
  Record<AllocationStatus, StatusTone> = {
    none: "neutral",
    partial: "warning",
    draft: "primary",
    released: "positive",
  };

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

/* =========================
   Navigation
========================= */

async function openBudget() {
  await router.push({
    name: "budget",
  });
}

async function openLedger() {
  await router.push({
    name: "ledger",
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

/*
  Demande de téléchargement, events/PWA-BAT_<AAAAMMJJHHMMSS>_Card24Download.json,
  suivie par son statut dans events/status/. Elle survit à
  un rechargement de la page.
*/
const CARD24_TIMEOUT_MS =
  5 * 60 * 1000;

/*
  « Remember » envoyé depuis la page Allocation : demande
  reprise ici pour afficher le statut du Mac (règle créée,
  modèle obtenu) ou son refus.
*/
const rememberRequest =
  useRememberRequest();

const card24 =
  useEventRequest({
    trigram: "BAT",
    timeoutMs: CARD24_TIMEOUT_MS,
    persistKey: "card24PendingEvent",
  });

const card24Downloading =
  card24.inProgress;

watch(
  () => card24.request.value?.phase,

  phase => {
    if (phase === "error") {
      actionError.value =
        card24.request.value?.message ||
        "Card24 download failed";
    }
  }
);

async function onDownloadCard24() {
  if (!storageReady.value) {
    actionError.value =
      storageUnavailableMessage.value ||
      "Storage not available.";

    return;
  }

  if (card24Downloading.value) {
    return;
  }

  await card24.send(
    {
      type:      "BATCH_REQUESTED",
      version:   1,
      timestamp: new Date().toISOString(),
      payload: {
        script: "Card24Download",
        reason: "CARD24_DOWNLOAD_REQUESTED",
      },
    },
    "Card24Download"
  );
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
    await confirmDialog({
      title: `Release ${draftCount.value} draft(s)?`,
      message: "This action cannot be undone.",
      confirmLabel: "Release",
      destructive: true,
    });

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

/*
  Les statuts d’allocation (drafts, released) sont relus à
  chaque nouvelle version des mouvements.
*/
watch(
  () =>
    spendingFile.data.value,

  async file => {
    if (!file) {
      spending.clear();
      return;
    }

    spending.replaceAll(
      file.accounts,
      file.records
    );

    await loadAllocationStatus();
  }
);

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
      bootstrapped.value =
        false;

      spending.clear();
    }
  }
);


/* =========================
   Initialization
========================= */

async function initializeView() {
  if (
    bootstrapping.value
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
      await router.replace({
        name:
          "authentication",
      });

      return;
    }

    await loadSettings();

    await movementLabel.load();

    bootstrapped.value =
      true;

  } catch (err) {
    console.error(
      "Spending initialization failed",
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

onMounted(async () => {
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
});
</script>

<template>
  <PageHeader
    title="Spending"
    icon="creditcard"
  >
    <template #actions>
      <div class="header-actions">
        <div class="header-group">
          <AppIcon
            name="budget"
            :size="32"
            class="header-icon"
            title="Budget"
            @click="openBudget"
          />

          <AppIcon
            name="book"
            :size="32"
            class="header-icon"
            title="Ledger"
            @click="openLedger"
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
    <p
      v-if="rememberRequest.message.value"
      class="remember-message"
      :class="rememberRequest.tone.value"
    >
      {{ rememberRequest.message.value }}
    </p>

    <!-- Sticky filters -->

    <div
      ref="stickyRef"
      class="sticky-zone"
    >
      <MovementFilters :filters="movementFilters">
        <template #header>
          <PillButton
            :active="showBankText"
            title="Second line of each movement: the bank text"
            @click="showBankText = !showBankText"
          >
            Bank text
          </PillButton>
        </template>

        <template #selectors>
          <ChipSelector
            v-model="statusFilterArray"
            label="Status"
            :items="statusItems"
            :multiple="true"
            :show-all="true"
            :align-with-content="true"
          />

          <ChipSelector
            v-if="mobileEnabled"
            v-model="entryFilter"
            label="Entry"
            :items="entryItems"
            :multiple="true"
            :show-all="true"
            :align-with-content="true"
          />
        </template>
      </MovementFilters>
    </div>

    <!-- Accounts -->

    <div class="spending-view">
      <p
        v-if="selectedYearEmpty"
        class="empty-year"
      >
        No unallocated expenses
      </p>

      <AccountSection
        v-for="
          account
          in accounts
        "
        :key="account.id"
        :label="account.label"
        :count="recordsFor(account.id).length"
        :total="totalFor(account.id)"
        :collapsed="isCollapsed(account.id)"
        @toggle="toggleAccount(account.id)"
      >
        <!-- Bouton download Card24 — uniquement pour Global Card, avec la capacité card24 -->
        <template
          v-if="card24Enabled && account.label.toLowerCase().includes('card')"
          #actions
        >
          <button
            class="btn-download-card24"
            :disabled="card24Downloading"
            title="Télécharger les transactions Card24"
            @click="onDownloadCard24()"
          >
            {{ card24Downloading ? "⏳" : "⬇" }}
          </button>
        </template>

        <table class="spending-table">
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
            <MovementRow
              v-for="
                record
                in recordsFor(
                  account.id
                )
              "
              :key="record.id"
              :record="record"
              :show-bank-text="showBankText"
              @open="openAllocation(record)"
            >
              <template #status>
                <StatusPill
                  v-if="isMobileLinked(record) && record.allocationStatus === 'none'"
                  class="mobile-status"
                  tone="warning"
                  title="Entered on the iPhone"
                >
                  iPhone
                </StatusPill>

                <StatusPill
                  v-else
                  class="allocation-status"
                  :tone="STATUS_TONES[record.allocationStatus]"
                >
                  {{ record.allocationStatus }}
                </StatusPill>
              </template>
            </MovementRow>
          </tbody>
        </table>
      </AccountSection>
    </div>
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
  gap: 12px;
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

.remember-message {
  margin: 0.5rem 1rem 0;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

.remember-message.completed {
  color: var(--positive);
}

.remember-message.error {
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

/* =========================================================
   ACCOUNT HEADER
========================================================= */

.spending-view {
  padding-bottom: 1rem;
}

.empty-year {
  margin: 0.75rem 0;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
  text-align: center;
}

.btn-download-card24 {
  background: transparent;
  border: none;
  color: var(--text-soft);
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0 4px;
  margin-left: 6px;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.btn-download-card24:hover {
  opacity: 1;
  color: var(--primary);
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

/* Assez large pour « RELEASED » en majuscules, sans points de suspension. */
.spending-table col.col-status {
  width: 116px;
}

.spending-table col.col-currency {
  width: 50px;
}

.spending-table col.col-amount {
  width: 100px;
}

.spending-table th {
  padding: 8px;
  border-bottom: 1px solid var(--border);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  text-align: center;
}

.spending-table th:nth-child(2),
.spending-table th:nth-child(5) {
  text-align: left;
}

.spending-table th:nth-child(6) {
  text-align: right;
}

/* =========================================================
   STATUS
========================================================= */

.allocation-status {
  margin: 0 auto;
  text-transform: uppercase;
}

/* Libellé « iPhone » tel quel, sans majuscules. */
.mobile-status {
  margin: 0 auto;
}
</style>