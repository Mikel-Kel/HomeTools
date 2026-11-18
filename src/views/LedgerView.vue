<script setup lang="ts">
import {
  computed,
  onMounted,
  ref,
} from "vue";

import { useRouter } from "vue-router";

import PageHeader from "@/components/PageHeader.vue";
import PillButton from "@/components/ui/PillButton.vue";
import StatusPill from "@/components/ui/StatusPill.vue";
import AccountSection from "@/components/spending/AccountSection.vue";
import MovementRow from "@/components/spending/MovementRow.vue";
import MovementFilters from "@/components/spending/MovementFilters.vue";

import { useStorageAccess } from "@/composables/useStorageAccess";
import { useAppBootstrap } from "@/composables/useAppBootstrap";
import { useRemoteJson } from "@/composables/useRemoteJson";
import { usePersistentRef } from "@/composables/usePersistentRef";
import { useMovementLabel } from "@/composables/spending/useMovementLabel";
import { useMovementFilters } from "@/composables/spending/useMovementFilters";
import { useLedgerMovements } from "@/composables/ledger/useLedgerMovements";

import {
  LEDGER_FOLDER,
  LEDGER_INDEX_FILE,
  readLedgerIndex,
  type BalanceSource,
  type LedgerAccount,
  type LedgerMovement,
} from "@/contracts/ledger";

import { formatAmount } from "@/utils/amountFormat";
import { formatDate } from "@/utils/dateFormat";

/* =========================
   Ledger : vue comptable des mouvements

   Contrat : ../Backend/docs/ledger-contract.md. Tous les
   mouvements, par compte, du plus récent au plus ancien,
   avec le solde après chaque mouvement. Seul le solde de fin
   de journée est exact (ordre des mouvements d'un jour
   inconnu) : les autres sont affichés comme indicatifs. Par
   compte : source du solde, solde du relevé, soldes
   d'ouverture.

   Filtres communs avec Spending (useMovementFilters), sans
   le statut d'allocation ; années proposées : celles de
   l'index. Seuls les fichiers des années choisies sont
   chargés (« All » : toutes).
========================= */

const router =
  useRouter();

const {
  storageReady,
  storageUnavailableMessage,
  ensureStorageReady,
} = useStorageAccess();

const {
  loadSettings,
} = useAppBootstrap();

const movementLabel =
  useMovementLabel();

/* =========================
   View state
========================= */

/* Connexion au stockage et référentiels communs. */
const bootstrapping =
  ref(false);

const bootstrapped =
  ref(false);

const bootstrapError =
  ref<string | null>(null);

/* Comptes, soldes et années exportées. */
const indexFile =
  useRemoteJson({
    folder: LEDGER_FOLDER,
    file: LEDGER_INDEX_FILE,
    read: readLedgerIndex,
  });

const indexYears =
  computed(() =>
    indexFile.data.value?.years ?? []
  );

/* =========================
   Filters
========================= */

const LEDGER_FILTERS_KEY =
  "ledgerFilters";

/*
  Seconde ligne des écritures (texte de la banque) :
  préférence d'affichage de l'appareil, hors des filtres.
*/
const showBankText =
  usePersistentRef("ledger.showBankText", true);

const movementFilters =
  useMovementFilters<LedgerMovement>({
    records:
      () => ledger.movements.value,

    loaded:
      () =>
        indexFile.data.value !== null &&
        ledger.loaded.value,

    sessionKey:
      LEDGER_FILTERS_KEY,

    years:
      () => indexYears.value.map(String),
  });

const {
  applyFilters,
  selectedYearEmpty,
  yearFilter,
} = movementFilters;

/*
  Années à charger : celle du filtre si l'index la connaît,
  toutes pour « All » ; aucune avant l'index. Les filtres,
  créés avant, ne lisent les mouvements qu'à l'usage.
*/
const wantedYears =
  computed(() => {
    const year =
      yearFilter.value;

    if (year === null) {
      return indexYears.value;
    }

    return indexYears.value.includes(Number(year))
      ? [Number(year)]
      : [];
  });

const ledger =
  useLedgerMovements(wantedYears);

/* =========================
   Load states
========================= */

const loading =
  computed(() =>
    bootstrapping.value ||
    indexFile.loading.value ||
    ledger.loading.value
  );

const loadError =
  computed(() =>
    bootstrapError.value ??
    indexFile.error.value ??
    ledger.error.value
  );

const initialized =
  computed(() =>
    bootstrapped.value &&
    indexFile.data.value !== null &&
    ledger.loaded.value
  );

/* =========================
   Accounts
========================= */

const accounts =
  computed<LedgerAccount[]>(() =>
    indexFile.data.value?.accounts ?? []
  );

const collapsedAccounts =
  ref<Set<string>>(new Set());

function toggleAccount(
  id: string
) {
  const next =
    new Set(collapsedAccounts.value);

  if (!next.delete(id)) {
    next.add(id);
  }

  collapsedAccounts.value = next;
}

/* Mouvements filtrés par compte, le plus récent en premier. */
const movementsByAccount =
  computed(() => {
    const groups =
      new Map<string, LedgerMovement[]>();

    for (const movement of applyFilters(ledger.movements.value)) {
      const group =
        groups.get(movement.accountId);

      if (group) {
        group.push(movement);
      } else {
        groups.set(movement.accountId, [movement]);
      }
    }

    for (const group of groups.values()) {
      group.reverse();
    }

    return groups;
  });

function movementsFor(
  accountId: string
): LedgerMovement[] {
  return movementsByAccount.value.get(accountId) ?? [];
}

function totalFor(
  accountId: string
): number {
  return movementsFor(accountId).reduce(
    (total, movement) => total + movement.amount,
    0
  );
}

const BALANCE_SOURCE_LABELS: Record<BalanceSource, string> = {
  statement: "From statement",
  initial: "From initial balance",
  computed: "Computed from movements",
};

const BALANCE_SOURCE_TITLES: Record<BalanceSource, string> = {
  statement: "Balances anchored on the last statement balance of the bank",
  initial: "Balances accumulated from the initial balance movement",
  computed: "Balances accumulated from zero: exact only if the history is complete",
};

/* Soldes d'ouverture affichés : l'année choisie, ou toutes. */
function openingsFor(
  account: LedgerAccount
): { year: string; amount: number }[] {
  return Object.entries(account.openings)
    .filter(([year]) =>
      yearFilter.value === null ||
      year === yearFilter.value
    )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, amount]) => ({ year, amount }));
}

/* =========================
   Rows
========================= */

function markerOf(
  movement: LedgerMovement
): { label: string; tone: "warning" | "primary" | "neutral"; title: string } | null {
  if (movement.pending) {
    return {
      label: "Pending",
      tone: "primary",
      title: "Re-allocation in progress",
    };
  }

  if (!movement.allocated) {
    return {
      label: "Unallocated",
      tone: "warning",
      title: "Not yet allocated",
    };
  }

  if (movement.excluded) {
    return {
      label: "Excluded",
      tone: "neutral",
      title: "Excluded from spending, counted in the balance",
    };
  }

  return null;
}

const INDICATIVE_BALANCE_TITLE =
  "Indicative: the order of the movements within a day is unknown; the end-of-day balance is exact";

/* =========================
   Initialization
========================= */

async function initializeView() {
  if (bootstrapping.value) {
    return;
  }

  bootstrapping.value = true;
  bootstrapError.value = null;

  try {
    const ready =
      await ensureStorageReady();

    if (!ready) {
      await router.replace({
        name: "authentication",
      });

      return;
    }

    await loadSettings();
    await movementLabel.load();

    bootstrapped.value = true;

  } catch (err) {
    console.error("Ledger initialization failed", err);

    bootstrapError.value =
      err instanceof Error
        ? err.message
        : String(err);

  } finally {
    bootstrapping.value = false;
  }
}

onMounted(initializeView);
</script>

<template>
  <PageHeader
    title="Ledger"
    icon="book"
  />

  <div
    v-if="!storageReady"
    class="loading-state"
  >
    {{ storageUnavailableMessage || "Storage not available." }}
  </div>

  <div
    v-else-if="loadError"
    class="loading-state error"
  >
    {{ loadError }}
  </div>

  <div
    v-else-if="loading && !initialized"
    class="loading-state"
  >
    Loading ledger…
  </div>

  <div
    v-else
    class="ledger-scroll"
  >
    <div class="sticky-zone">
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
      </MovementFilters>
    </div>

    <div class="ledger-view">
      <p
        v-if="selectedYearEmpty"
        class="empty-year"
      >
        No movements
      </p>

      <AccountSection
        v-for="account in accounts"
        :key="account.id"
        :label="account.label"
        :count="movementsFor(account.id).length"
        :total="totalFor(account.id)"
        :collapsed="collapsedAccounts.has(account.id)"
        @toggle="toggleAccount(account.id)"
      >
        <div class="account-balance">
          <span
            v-if="account.balance !== null"
            class="balance-main"
          >
            Balance {{ formatAmount(account.balance) }} {{ account.currency }}
            <template v-if="account.balanceDate">
              on {{ formatDate(account.balanceDate, "compact") }}
            </template>
          </span>

          <span
            v-if="account.statementBalance !== null"
          >
            Statement {{ formatAmount(account.statementBalance) }}
            <template v-if="account.statementDate">
              on {{ formatDate(account.statementDate, "compact") }}
            </template>
          </span>

          <span
            v-for="opening in openingsFor(account)"
            :key="opening.year"
          >
            Opening {{ opening.year }}: {{ formatAmount(opening.amount) }}
          </span>

          <StatusPill
            tone="neutral"
            :title="BALANCE_SOURCE_TITLES[account.balanceSource]"
          >
            {{ BALANCE_SOURCE_LABELS[account.balanceSource] }}
          </StatusPill>

          <StatusPill
            v-if="!account.active"
            tone="neutral"
            dashed
          >
            Closed
          </StatusPill>
        </div>

        <table class="ledger-table">
          <colgroup>
            <col class="col-date">
            <col class="col-party">
            <col class="col-owner">
            <col class="col-status">
            <col class="col-currency">
            <col class="col-amount">
            <col class="col-balance">
          </colgroup>

          <thead>
            <tr>
              <th>Date</th>
              <th>Party</th>
              <th>Owner</th>
              <th>Status</th>
              <th></th>
              <th>Amount</th>
              <th>Balance</th>
            </tr>
          </thead>

          <tbody>
            <MovementRow
              v-for="movement in movementsFor(account.id)"
              :key="movement.id"
              :record="movement"
              :show-bank-text="showBankText"
            >
              <template #status>
                <StatusPill
                  v-if="markerOf(movement)"
                  class="movement-marker"
                  :tone="markerOf(movement)!.tone"
                  :title="markerOf(movement)!.title"
                >
                  {{ markerOf(movement)!.label }}
                </StatusPill>
              </template>

              <template #after>
                <td
                  class="balance-cell"
                  :class="{ indicative: !movement.endOfDay }"
                  :title="movement.endOfDay ? 'End-of-day balance' : INDICATIVE_BALANCE_TITLE"
                >
                  {{ formatAmount(movement.balance) }}
                </td>
              </template>
            </MovementRow>
          </tbody>
        </table>
      </AccountSection>
    </div>
  </div>
</template>

<style scoped>
.loading-state {
  padding: 1rem;
  color: var(--text-soft);
}

.loading-state.error {
  color: var(--negative);
}

.ledger-scroll {
  height: calc(100vh - 64px);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  background: var(--bg);
}

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

  border-bottom: 1px solid var(--border);
}

.ledger-view {
  padding-bottom: 1rem;
}

.empty-year {
  margin: 0.75rem 0;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
  text-align: center;
}

.account-balance {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem 1rem;

  padding: 0.4rem 0.5rem;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

.balance-main {
  color: var(--text);
  font-weight: 600;
}

.ledger-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: var(--font-size-md);
}

.ledger-table col.col-date {
  width: 110px;
}

.ledger-table col.col-party {
  width: auto;
}

.ledger-table col.col-owner {
  width: 110px;
}

/* Assez large pour « UNALLOCATED » en majuscules. */
.ledger-table col.col-status {
  width: 130px;
}

.ledger-table col.col-currency {
  width: 50px;
}

.ledger-table col.col-amount,
.ledger-table col.col-balance {
  width: 110px;
}

.ledger-table th {
  padding: 8px;
  border-bottom: 1px solid var(--border);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  text-align: center;
}

.ledger-table th:nth-child(2),
.ledger-table th:nth-child(5) {
  text-align: left;
}

.ledger-table th:nth-child(6),
.ledger-table th:nth-child(7) {
  text-align: right;
}

.movement-marker {
  margin: 0 auto;
  text-transform: uppercase;
}

.balance-cell {
  padding: 8px;
  border-bottom: 1px solid var(--border);
  overflow: hidden;
  white-space: nowrap;
  text-align: right;
}

.balance-cell.indicative {
  color: var(--text-soft);
  font-style: italic;
}
</style>
