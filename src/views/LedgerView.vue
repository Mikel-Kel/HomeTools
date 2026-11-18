<script setup lang="ts">
import {
  computed,
  onMounted,
  ref,
  watch,
} from "vue";

import { useRouter } from "vue-router";

import PageHeader from "@/components/PageHeader.vue";
import ChipSelector from "@/components/ChipSelector.vue";
import PillButton from "@/components/ui/PillButton.vue";
import StatusPill from "@/components/ui/StatusPill.vue";
import AccountSection from "@/components/spending/AccountSection.vue";
import MovementRow from "@/components/spending/MovementRow.vue";
import MovementFilters from "@/components/spending/MovementFilters.vue";
import AllocationLines, { type AllocationLine } from "@/components/allocation/AllocationLines.vue";

import { useStorageAccess } from "@/composables/useStorageAccess";
import { useCategories } from "@/composables/useCategories";
import { useAppBootstrap } from "@/composables/useAppBootstrap";
import { useRemoteJson } from "@/composables/useRemoteJson";
import { usePersistentRef } from "@/composables/usePersistentRef";
import { useMovementLabel } from "@/composables/spending/useMovementLabel";
import { useMovementFilters } from "@/composables/spending/useMovementFilters";
import { useLedgerMovements } from "@/composables/ledger/useLedgerMovements";
import { useImportDeleteRequest } from "@/composables/ledger/useImportDeleteRequest";

import {
  LEDGER_FOLDER,
  LEDGER_INDEX_FILE,
  readLedgerIndex,
  type BalanceSource,
  type LedgerAccount,
  type LedgerMovement,
} from "@/contracts/ledger";

import { confirmDialog } from "@/services/dialog/appDialog";

import { formatAmount } from "@/utils/amountFormat";
import { formatDate } from "@/utils/dateFormat";

/* =========================
   Ledger : vue comptable des mouvements

   Contrat : ../Backend/docs/ledger-contract.md. Tous les
   mouvements, par compte, du plus récent au plus ancien,
   avec le solde après chaque mouvement. Seul le solde de fin
   de journée est exact (ordre des mouvements d'un jour
   inconnu) : les autres sont affichés comme indicatifs, et
   tous ceux d'un compte sans solde de relevé. En-tête du
   compte : solde courant et sa source (relevé, report et sa
   date, aucune). Un report (type 998) est
   une ligne de solde : montant en gras, hors du total.

   Filtres communs avec Spending (useMovementFilters), sans
   le statut d'allocation ; années proposées : celles de
   l'index. Seuls les fichiers des années choisies sont
   chargés (« All » : toutes), un par compte et par année.

   Sous chaque mouvement, au choix (exclusifs) : « Allocations »
   (par défaut) ou « Bank text » ; le premier montre les lignes
   d'allocation en lecture, ou « Unallocated » en jaune (et
   report, exclusion, ré-allocation). Pas de colonne de
   statut. Un mouvement à allouer ouvre la page Allocation
   (suggestions lues dans spending.json), avec retour au
   Ledger.

   Filtre « Import » : mouvements arrivés à une date d'import
   (toutes années : Period passe à All). Sur le dernier
   import d'un compte, « Delete import » envoie
   IMPORT_DELETED (contrat § 8) : seuls les mouvements sans
   allocation sont effacés par le Mac.
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

const categoriesStore =
  useCategories();

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

const accounts =
  computed<LedgerAccount[]>(() =>
    indexFile.data.value?.accounts ?? []
  );

/* =========================
   Filters
========================= */

const LEDGER_FILTERS_KEY =
  "ledgerFilters";

/*
  Sous chaque mouvement, au choix : ses allocations (par
  défaut), le texte de la banque, ou rien. Préférence de
  l'appareil.
*/
type SecondLine =
  | "allocations"
  | "bankText"
  | "none";

const secondLine =
  usePersistentRef<SecondLine>("ledger.secondLine", "allocations");

const showAllocations =
  computed(() =>
    secondLine.value === "allocations"
  );

const showBankText =
  computed(() =>
    secondLine.value === "bankText"
  );

/* Un second appui sur le choix actif n'affiche plus rien. */
function toggleSecondLine(
  choice: SecondLine
) {
  secondLine.value =
    secondLine.value === choice
      ? "none"
      : choice;
}

/* Date d'import choisie (filtre propre au Ledger) ; null : toutes. */
const importFilter =
  ref<string | null>(null);

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

    extension: {
      matches:
        movement =>
          importFilter.value === null ||
          movement.importDate === importFilter.value,

      reset: () => {
        importFilter.value = null;
      },

      snapshot: () => ({
        importDate: importFilter.value,
      }),

      restore: saved => {
        importFilter.value =
          typeof saved.importDate === "string"
            ? saved.importDate
            : null;
      },
    },
  });

const {
  applyFilters,
  selectedYearEmpty,
  yearFilter,
  ownerFilter,
  currencyFilter,
  minAmount,
  maxAmount,
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

/* Fichiers à charger : ceux des années voulues, par compte puis année croissante. */
const wantedFiles =
  computed(() =>
    accounts.value.flatMap(account =>
      account.files
        .filter(file => wantedYears.value.includes(file.year))
        .sort((a, b) => a.year - b.year)
    )
  );

const ledger =
  useLedgerMovements(wantedFiles);

/*
  Un import peut porter des mouvements de l'année précédente :
  choisir un import affiche toutes les années.
*/
watch(
  importFilter,
  importDate => {
    if (importDate !== null) {
      yearFilter.value = null;
    }
  }
);

/* Dates d'import proposées : les plus récentes, tous comptes confondus. */
const IMPORT_CHOICES =
  12;

const importItems =
  computed(() => {
    const dates =
      new Set(
        accounts.value.flatMap(account =>
          account.imports.map(item => item.importDate)
        )
      );

    const recent =
      [...dates]
        .sort()
        .reverse()
        .slice(0, IMPORT_CHOICES);

    if (importFilter.value !== null && !recent.includes(importFilter.value)) {
      recent.push(importFilter.value);
    }

    return recent.map(date => ({
      id: date,
      label: formatDate(date, "compact"),
    }));
  });

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

/*
  Mouvements filtrés par compte, le plus récent en premier.
  Un report (type 998) reste toujours affiché, quels que
  soient les filtres.
*/
const movementsByAccount =
  computed(() => {
    const groups =
      new Map<string, LedgerMovement[]>();

    const matching =
      new Set(applyFilters(ledger.movements.value));

    const shown =
      ledger.movements.value.filter(movement =>
        movement.carried || matching.has(movement)
      );

    for (const movement of shown) {
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

/*
  Solde à la fin de la période affichée : celui du mouvement
  affiché le plus récent ; null sans mouvement affiché.
*/
function periodBalanceFor(
  accountId: string
): number | null {
  return movementsFor(accountId)
    .find(movement => movement.balance !== null)
    ?.balance ?? null;
}

/*
  Filtre qui ne garde qu'une partie des mouvements (porteur,
  devise, import, montant) : les soldes du compte n'ont plus
  de sens. On affiche alors le total des mouvements affichés
  et, ligne à ligne, leur cumul depuis 0. La période et les
  dates ne changent rien aux soldes.
*/
const subsetFiltered =
  computed(() =>
    ownerFilter.value.size > 0 ||
    currencyFilter.value.size > 0 ||
    importFilter.value !== null ||
    minAmount.value !== null ||
    maxAmount.value !== null
  );

/*
  Cumul des mouvements affichés, du plus ancien au plus
  récent, depuis 0. Un report (998) n'est pas un flux : ni
  compté, ni cumulé.
*/
const runningTotals =
  computed(() => {
    const totals =
      new Map<LedgerMovement, number>();

    for (const group of movementsByAccount.value.values()) {
      let total = 0;

      for (let index = group.length - 1; index >= 0; index--) {
        const movement =
          group[index];

        if (!movement.carried) {
          total += movement.amount;
          totals.set(movement, total);
        }
      }
    }

    return totals;
  });

/* Total des mouvements affichés (le cumul du plus récent). */
function filteredTotalFor(
  accountId: string
): number {
  const latest =
    movementsFor(accountId).find(movement => !movement.carried);

  return latest
    ? runningTotals.value.get(latest) ?? 0
    : 0;
}

const FILTERED_TOTAL_TITLE =
  "Filtered: total of the movements shown (carried balances excluded)";

const RUNNING_TOTAL_TITLE =
  "Filtered: running total of the movements shown, starting from zero";

/* Cellule de solde d'une ligne : solde du compte, ou cumul filtré. */
function balanceCellOf(
  account: LedgerAccount,
  movement: LedgerMovement
): { value: number | null; indicative: boolean; filtered: boolean; title: string } {
  if (subsetFiltered.value) {
    return {
      value: runningTotals.value.get(movement) ?? null,
      indicative: false,
      filtered: true,
      title: movement.carried ? "" : RUNNING_TOTAL_TITLE,
    };
  }

  return {
    value: movement.balance,
    indicative: !movement.endOfDay || !hasStatement(account),
    filtered: false,
    title: balanceTitle(account, movement),
  };
}

const BALANCE_SOURCE_TITLES: Record<BalanceSource, string> = {
  statement: "Balances anchored on the last statement balance received with an import",
  carried: "Balances anchored on the latest carried balance (transfer type 998)",
  none: "No statement nor carried balance: each year starts from zero",
};

/*
  En-tête du compte : « Balance on 16.11.2026: 1'150.00 »,
  puis la source entre parenthèses (en jaune sans relevé) :
  « from statement », « carried on from 19.10.2026 » ou
  « no known balance, running total since 1 January ».
*/
function balanceText(
  account: LedgerAccount
): string {
  const date =
    account.balanceDate
      ? ` on ${formatDate(account.balanceDate, "compact")}`
      : "";

  return `Balance${date}: ${formatAmount(account.balance)}`;
}

function balanceSourceText(
  account: LedgerAccount
): string {
  switch (account.balanceSource) {
    case "statement":
      return "from statement";

    case "carried":
      return account.carriedDate
        ? `carried on from ${formatDate(account.carriedDate, "compact")}`
        : "carried on";

    case "none":
      return "no known balance, running total since 1 January";
  }
}

/* Compte sans solde de relevé : tous ses soldes sont indicatifs. */
function hasStatement(
  account: LedgerAccount
): boolean {
  return account.balanceSource === "statement";
}

const NO_STATEMENT_TITLE =
  "Indicative: no statement balance known for this account";


/* =========================
   Delete last import
========================= */

const importDelete =
  useImportDeleteRequest();

/* Dernier import du compte, s'il est celui du filtre. */
function deletableImport(
  account: LedgerAccount
) {
  const last =
    account.imports.find(item => item.last);

  return last && last.importDate === importFilter.value
    ? last
    : null;
}

async function deleteImport(
  account: LedgerAccount
) {
  const target =
    deletableImport(account);

  if (!target || importDelete.inProgress.value) {
    return;
  }

  const confirmed =
    await confirmDialog({
      title: `Delete the import of ${formatDate(target.importDate, "compact")}?`,
      message:
        `${account.label}: ${target.movements} movement(s). ` +
        "Movements already allocated, or with an allocation in progress " +
        "(draft, partial), are kept. Deleted movements come back only " +
        "by importing the bank file again.",
      confirmLabel: "Delete",
      destructive: true,
    });

  if (!confirmed) {
    return;
  }

  await importDelete.send(
    account.accountId,
    target.importDate
  );
}

/* =========================
   Rows
========================= */

/*
  Mention sous le mouvement, en mode Allocations, à la place
  ou en plus de ses lignes d'allocation. Un mouvement exclu
  des dépenses n'est jamais à allouer (absent de
  spending.json).
*/
function markerOf(
  movement: LedgerMovement
): { label: string; tone: "warning" | "primary" | "neutral"; title: string } | null {
  if (movement.carried) {
    return {
      label: "Carried balance",
      tone: "neutral",
      title: "Carried balance: balance at the end of this date, not a movement",
    };
  }

  if (movement.pending) {
    return {
      label: "Re-allocation pending",
      tone: "primary",
      title: "Re-allocation in progress",
    };
  }

  if (movement.excluded) {
    return {
      label: "Excluded from spending",
      tone: "neutral",
      title: "Excluded from spending, counted in the balance",
    };
  }

  if (!movement.allocated) {
    return {
      label: "Unallocated",
      tone: "warning",
      title: "Not yet allocated: click to allocate",
    };
  }

  return null;
}

/* À allouer depuis le Ledger : non alloué, ni report, ni exclu, ni en ré-allocation. */
function canAllocate(
  movement: LedgerMovement
): boolean {
  return (
    !movement.carried &&
    !movement.allocated &&
    !movement.pending &&
    !movement.excluded
  );
}

async function openAllocation(
  movement: LedgerMovement
) {
  await router.push({
    name: "allocation",
    params: {
      id: movement.id,
    },
    query: {
      from: "ledger",
    },
  });
}

/* Lignes d'allocation affichées, catégorie déduite de la sous-catégorie. */
function allocationLinesOf(
  movement: LedgerMovement
): AllocationLine[] {
  return movement.allocations.map(allocation => ({
    id: `${movement.id}-${allocation.nb}`,
    categoryID:
      allocation.subCategoryID === null
        ? null
        : categoriesStore.getCategoryIdOfSubcategory(allocation.subCategoryID),
    subCategoryID: allocation.subCategoryID,
    comment: allocation.comment,
    amount: allocation.amount,
    allocationDate: allocation.allocationDate,
    allocatedTagID: allocation.tagID || null,
    partyID: allocation.partyID,
  }));
}

const INDICATIVE_BALANCE_TITLE =
  "Indicative: the order of the movements within a day is unknown; the end-of-day balance is exact";

function balanceTitle(
  account: LedgerAccount,
  movement: LedgerMovement
): string {
  if (!hasStatement(account)) {
    return NO_STATEMENT_TITLE;
  }

  return movement.endOfDay
    ? "End-of-day balance"
    : INDICATIVE_BALANCE_TITLE;
}

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
    <p
      v-if="importDelete.message.value"
      class="request-message"
      :class="importDelete.tone.value"
    >
      {{ importDelete.message.value }}
    </p>

    <div class="sticky-zone">
      <MovementFilters :filters="movementFilters">
        <template #header>
          <PillButton
            :active="showAllocations"
            title="Under each movement: its allocations, or whether it is still to allocate"
            @click="toggleSecondLine('allocations')"
          >
            Allocations
          </PillButton>

          <PillButton
            :active="showBankText"
            title="Second line of each movement: the bank text"
            @click="toggleSecondLine('bankText')"
          >
            Bank text
          </PillButton>
        </template>

        <template #selectors>
          <ChipSelector
            v-model="importFilter"
            label="Import"
            :items="importItems"
            :show-all="true"
            :align-with-content="true"
          />
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
        :total="subsetFiltered ? filteredTotalFor(account.id) : periodBalanceFor(account.id)"
        :total-is-balance="!subsetFiltered"
        :total-indicative="!subsetFiltered && !hasStatement(account)"
        :total-filtered="subsetFiltered"
        :total-title="subsetFiltered
          ? FILTERED_TOTAL_TITLE
          : hasStatement(account) ? 'Balance after the last movement shown' : NO_STATEMENT_TITLE"
        :collapsed="collapsedAccounts.has(account.id)"
        @toggle="toggleAccount(account.id)"
      >
        <template
          v-if="deletableImport(account)"
          #actions
        >
          <PillButton
            variant="danger"
            :disabled="importDelete.inProgress.value"
            title="Delete the movements of this import that have no allocation"
            @click="deleteImport(account)"
          >
            Delete import
          </PillButton>
        </template>

        <template #details>
          <span
            v-if="account.balance !== null"
            :title="BALANCE_SOURCE_TITLES[account.balanceSource]"
          >
            {{ balanceText(account) }}

            <span :class="{ 'no-statement': !hasStatement(account) }">
              ({{ balanceSourceText(account) }})
            </span>
          </span>

          <StatusPill
            v-if="!account.active"
            tone="neutral"
            dashed
          >
            Closed
          </StatusPill>
        </template>

        <table class="ledger-table">
          <colgroup>
            <col class="col-date">
            <col class="col-party">
            <col class="col-owner">
            <col class="col-currency">
            <col class="col-amount">
            <col class="col-balance">
          </colgroup>

          <thead>
            <tr>
              <th>Date</th>
              <th>Party</th>
              <th>Owner</th>
              <th></th>
              <th>Amount</th>
              <th>Balance</th>
            </tr>
          </thead>

          <tbody>
            <template
              v-for="movement in movementsFor(account.id)"
              :key="movement.id"
            >
              <MovementRow
                :record="movement"
                :show-bank-text="showBankText"
                :openable="canAllocate(movement)"
                :amount-is-balance="movement.carried"
                @open="openAllocation(movement)"
              >
                <template #after>
                  <td
                    v-for="cell in [balanceCellOf(account, movement)]"
                    :key="movement.id"
                    class="balance-cell"
                    :class="{ indicative: cell.indicative, filtered: cell.filtered }"
                    :title="cell.title"
                  >
                    {{ cell.value === null ? "" : formatAmount(cell.value) }}
                  </td>
                </template>
              </MovementRow>

              <tr
                v-if="showAllocations && (movement.allocations.length || markerOf(movement))"
                class="allocation-row"
                :class="{ openable: canAllocate(movement) }"
                @click="canAllocate(movement) && openAllocation(movement)"
              >
                <td></td>

                <td colspan="5">
                  <AllocationLines
                    v-if="movement.allocations.length"
                    :lines="allocationLinesOf(movement)"
                    :value-date="movement.date"
                  />

                  <p
                    v-if="markerOf(movement)"
                    class="allocation-note"
                    :class="markerOf(movement)!.tone"
                    :title="markerOf(movement)!.title"
                  >
                    {{ markerOf(movement)!.label }}
                  </p>
                </td>
              </tr>
            </template>
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

.request-message {
  margin: 0.5rem 1rem 0;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

.request-message.completed {
  color: var(--positive);
}

.request-message.error {
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
.ledger-table th:nth-child(4) {
  text-align: left;
}

.ledger-table th:nth-child(5),
.ledger-table th:nth-child(6) {
  text-align: right;
}

.no-statement {
  color: var(--warning);
  font-weight: 600;
}

.allocation-row.openable {
  cursor: pointer;
}

.allocation-note {
  margin: 2px 4px 0;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

.allocation-note.warning {
  color: var(--warning);
  font-weight: 600;
}

.allocation-note.primary {
  color: var(--primary);
}

.balance-cell {
  padding: 8px;
  border-bottom: 1px solid var(--border);
  overflow: hidden;
  white-space: nowrap;
  text-align: right;
}

.allocation-row td {
  padding: 0 8px 6px;
  border-bottom: 1px solid var(--border);
}

.allocation-row :deep(.allocation-lines td) {
  padding: 3px 4px;
  border-bottom: none;
  font-size: var(--font-size-sm);
}

.balance-cell.indicative {
  color: var(--text-soft);
  font-style: italic;
}

/* Cumul des mouvements filtrés : distinct d'un solde. */
.balance-cell.filtered {
  color: var(--primary);
}
</style>
