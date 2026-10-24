<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from "vue";

import { useRouter } from "vue-router";

import PageHeader from "@/components/PageHeader.vue";
import ChipSelector from "@/components/ChipSelector.vue";
import PillButton from "@/components/ui/PillButton.vue";
import SegmentedControl from "@/components/ui/SegmentedControl.vue";
import StatusPill from "@/components/ui/StatusPill.vue";

import { useStorageAccess } from "@/composables/useStorageAccess";
import { useAppBootstrap } from "@/composables/useAppBootstrap";
import { useRemoteJson } from "@/composables/useRemoteJson";

import {
  useCategories,
  type CategoryNature,
} from "@/composables/useCategories";

import {
  BUDGET_FILE,
  BUDGET_FOLDER,
  readBudgetYears,
  type BudgetLine,
} from "@/contracts/budget";

import { formatInteger } from "@/utils/amountFormat";

/* =========================
   Page Budget (Mac uniquement)

   Budget mensuel par sous-catégorie, lu dans budget.json.
   Contrat : src/contracts/budget.ts.

   « Open » : montants encore à confirmer. Ces lignes sont
   mises en évidence ; « Open only » ne montre qu'elles.
========================= */

type NatureFilter =
  | "-"
  | "I"
  | "E";

interface BudgetRow {
  line: BudgetLine;
  label: string;
  seq: number;
  total: number;
}

interface BudgetGroup {
  categoryId: number;
  label: string;
  months: number[];
  total: number;
  rows: BudgetRow[];
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const natureOptions: {
  value: NatureFilter;
  label: string;
}[] = [
  { value: "-", label: "All" },
  { value: "I", label: "Income" },
  { value: "E", label: "Expenses" },
];

/* =========================
   Storage / bootstrap
========================= */

const router =
  useRouter();

const {
  storageReady,
  ensureStorageReady,
} = useStorageAccess();

const {
  loadSettings,
} = useAppBootstrap();

const categoriesStore =
  useCategories();

const bootstrapping =
  ref(false);

const bootstrapped =
  ref(false);

const bootstrapError =
  ref<string | null>(null);

/*
  Budget de toutes les années exportées, relu dès que
  budget.json change sur le stockage.
*/
const budgetFile =
  useRemoteJson({
    folder:
      BUDGET_FOLDER,

    file:
      BUDGET_FILE,

    read:
      readBudgetYears,
  });

const loading =
  computed(() =>
    bootstrapping.value ||
    budgetFile.loading.value
  );

const loadError =
  computed(() =>
    bootstrapError.value ??
    budgetFile.error.value
  );

const initialized =
  computed(() =>
    bootstrapped.value &&
    budgetFile.data.value !== null
  );

/* =========================
   Filters
========================= */

const year =
  ref<number>(
    new Date().getFullYear()
  );

const nature =
  ref<NatureFilter>("-");

const categoryId =
  ref<number | null>(null);

const openOnly =
  ref(false);

const budgetYears =
  computed(() =>
    budgetFile.data.value ?? []
  );

const yearOptions =
  computed(() =>
    budgetYears.value.map(
      item => ({
        value: item.year,
        label: String(item.year),
      })
    )
  );

/*
  L'année affichée doit exister dans le fichier : l'année
  en cours si possible, sinon la plus récente.
*/
watch(
  budgetYears,

  years => {
    if (
      years.length &&
      !years.some(
        item => item.year === year.value
      )
    ) {
      year.value =
        years[0].year;
    }
  }
);

/* =========================
   Rows
========================= */

/*
  Catégorie et sous-catégorie de chaque ligne, depuis
  settings/categories.json.
*/
const subCategoryIndex =
  computed(() => {
    const index =
      new Map<number, {
        categoryId: number;
        categoryLabel: string;
        categorySeq: number;
        nature: CategoryNature;
        label: string;
        seq: number;
      }>();

    for (const category of categoriesStore.categories.value) {
      for (const sub of category.subcategories) {
        index.set(
          sub.id,
          {
            categoryId: category.id,
            categoryLabel: category.label,
            categorySeq: category.seq,
            nature: category.nature,
            label: sub.label,
            seq: sub.seq,
          }
        );
      }
    }

    return index;
  });

const yearLines =
  computed(() =>
    budgetYears.value.find(
      item => item.year === year.value
    )?.lines ?? []
  );

function natureOf(
  line: BudgetLine
): CategoryNature | null {
  return (
    subCategoryIndex.value.get(
      line.subCategoryId
    )?.nature ??
    null
  );
}

function sum(
  values: number[]
): number {
  return values.reduce(
    (total, value) => total + value,
    0
  );
}

/*
  Lignes de l'année après les filtres nature et « Open
  only », regroupées par catégorie (avant le filtre de
  catégorie, qui s'applique ensuite).
*/
const allGroups =
  computed<BudgetGroup[]>(() => {
    const groups =
      new Map<number, BudgetGroup & { seq: number }>();

    for (const line of yearLines.value) {
      const meta =
        subCategoryIndex.value.get(
          line.subCategoryId
        );

      if (
        nature.value !== "-" &&
        meta?.nature !== nature.value
      ) {
        continue;
      }

      if (openOnly.value && !line.open) {
        continue;
      }

      const groupId =
        meta?.categoryId ?? line.categoryId;

      let group =
        groups.get(groupId);

      if (!group) {
        group = {
          categoryId: groupId,
          label: meta?.categoryLabel ?? `#${groupId}`,
          seq: meta?.categorySeq ?? Number.MAX_SAFE_INTEGER,
          months: Array(12).fill(0),
          total: 0,
          rows: [],
        };

        groups.set(groupId, group);
      }

      const total =
        sum(line.months);

      group.rows.push({
        line,
        label: meta?.label ?? `#${line.subCategoryId}`,
        seq: meta?.seq ?? Number.MAX_SAFE_INTEGER,
        total,
      });

      line.months.forEach(
        (amount, index) => {
          group.months[index] += amount;
        }
      );

      group.total += total;
    }

    return [...groups.values()]
      .sort((a, b) => a.seq - b.seq)
      .map(group => ({
        ...group,
        rows: group.rows.sort(
          (a, b) => a.seq - b.seq
        ),
      }));
  });

const categoryItems =
  computed(() =>
    allGroups.value.map(
      group => ({
        id: group.categoryId,
        label: group.label,
      })
    )
  );

/*
  Une catégorie qui disparaît de la liste (autre année,
  autre nature) ramène le filtre à « All ».
*/
watch(
  categoryItems,

  items => {
    if (
      categoryId.value !== null &&
      !items.some(
        item => item.id === categoryId.value
      )
    ) {
      categoryId.value =
        null;
    }
  }
);

const groups =
  computed(() =>
    categoryId.value === null
      ? allGroups.value
      : allGroups.value.filter(
          group =>
            group.categoryId ===
            categoryId.value
        )
  );

/* =========================
   Summary

   Toute l'année, indépendamment des filtres.
========================= */

const summary =
  computed(() => {
    const income =
      Array(12).fill(0);

    const expenses =
      Array(12).fill(0);

    for (const line of yearLines.value) {
      const lineNature =
        natureOf(line);

      const target =
        lineNature === "I"
          ? income
          : lineNature === "E"
            ? expenses
            : null;

      line.months.forEach(
        (amount, index) => {
          if (target) {
            target[index] += amount;
          }
        }
      );
    }

    const balance =
      income.map(
        (amount, index) =>
          amount - expenses[index]
      );

    return [
      { label: "Income", months: income, total: sum(income), signed: false },
      { label: "Expenses", months: expenses, total: sum(expenses), signed: false },
      { label: "Balance", months: balance, total: sum(balance), signed: true },
    ];
  });

/*
  Matrice creuse : les montants nuls ne sont pas affichés.
*/
function formatCell(
  value: number
): string {
  return value === 0
    ? ""
    : formatInteger(value);
}

function balanceClass(
  value: number
): string {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "";
}

/* =========================
   Initialization
========================= */

async function initializeView() {
  if (bootstrapping.value) {
    return;
  }

  bootstrapping.value =
    true;

  bootstrapError.value =
    null;

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

    bootstrapped.value =
      true;

  } catch (err) {
    console.error(
      "Budget initialization failed",
      err
    );

    bootstrapError.value =
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

  async ready => {
    if (!ready) {
      bootstrapped.value =
        false;

      return;
    }

    await initializeView();
  },

  {
    immediate: true,
  }
);
</script>

<template>
  <PageHeader
    title="Budget"
    icon="budget"
  />

  <div
    v-if="loading && !initialized"
    class="state-message"
  >
    Loading budget…
  </div>

  <div
    v-else-if="loadError"
    class="state-message error"
  >
    {{ loadError }}
  </div>

  <div
    v-else-if="!budgetYears.length"
    class="state-message"
  >
    No budget published yet — run “Export settings” from the Housekeeping page.
  </div>

  <main
    v-else
    class="budget-view"
  >
    <!-- Filters -->

    <section class="filters">
      <div class="filter-line">
        <SegmentedControl
          v-model="year"
          :options="yearOptions"
        />

        <SegmentedControl
          v-model="nature"
          :options="natureOptions"
        />

        <PillButton
          :active="openOnly"
          @click="openOnly = !openOnly"
        >
          Open only
        </PillButton>
      </div>

      <ChipSelector
        v-model="categoryId"
        label="Category"
        :items="categoryItems"
      />
    </section>

    <!-- Summary -->

    <section class="table-wrapper">
      <table class="budget-table summary-table">
        <colgroup>
          <col class="col-label" />
          <col class="col-open" />
          <col
            v-for="month in MONTH_LABELS"
            :key="month"
          />
          <col class="col-total" />
        </colgroup>

        <thead>
          <tr>
            <th class="label-cell">
              {{ year }}
            </th>

            <th class="open-cell"></th>

            <th
              v-for="month in MONTH_LABELS"
              :key="month"
            >
              {{ month }}
            </th>

            <th>Total</th>
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="row in summary"
            :key="row.label"
            :class="{ 'balance-row': row.signed }"
          >
            <th class="label-cell">
              {{ row.label }}
            </th>

            <td class="open-cell"></td>

            <td
              v-for="(amount, index) in row.months"
              :key="index"
              :class="row.signed ? balanceClass(amount) : ''"
            >
              {{ formatCell(amount) }}
            </td>

            <td
              class="total-cell"
              :class="row.signed ? balanceClass(row.total) : ''"
            >
              {{ formatCell(row.total) }}
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Matrix -->

    <section class="table-wrapper">
      <table class="budget-table">
        <colgroup>
          <col class="col-label" />
          <col class="col-open" />
          <col
            v-for="month in MONTH_LABELS"
            :key="month"
          />
          <col class="col-total" />
        </colgroup>

        <thead>
          <tr>
            <th class="label-cell">
              Sub-category
            </th>

            <th class="open-cell">Status</th>

            <th
              v-for="month in MONTH_LABELS"
              :key="month"
            >
              {{ month }}
            </th>

            <th>Total</th>
          </tr>
        </thead>

        <tbody
          v-for="group in groups"
          :key="group.categoryId"
        >
          <tr class="category-row">
            <th
              class="label-cell"
              colspan="2"
            >
              {{ group.label }}
            </th>

            <td
              v-for="(amount, index) in group.months"
              :key="index"
            >
              {{ formatCell(amount) }}
            </td>

            <td class="total-cell">
              {{ formatCell(group.total) }}
            </td>
          </tr>

          <tr
            v-for="row in group.rows"
            :key="row.line.subCategoryId"
            :class="{ 'to-confirm': row.line.open }"
          >
            <th class="label-cell">
              {{ row.label }}
            </th>

            <td class="open-cell">
              <StatusPill
                v-if="row.line.open"
                tone="warning"
              >
                Open
              </StatusPill>

              <span
                v-else
                class="confirmed-mark"
                title="Confirmed"
              >
                ✓
              </span>
            </td>

            <td
              v-for="(amount, index) in row.line.months"
              :key="index"
            >
              {{ formatCell(amount) }}
            </td>

            <td class="total-cell">
              {{ formatCell(row.total) }}
            </td>
          </tr>
        </tbody>

        <tbody v-if="!groups.length">
          <tr>
            <td
              class="empty-cell"
              colspan="15"
            >
              No sub-category matches the filters.
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </main>
</template>

<style scoped>
.budget-view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;

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
  gap: 0.75rem;
}

.filter-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem 1.5rem;
}

/* =========================
   Tables
========================= */

.table-wrapper {
  overflow-x: auto;

  border: 1px solid var(--border);
  border-radius: 12px;

  background: var(--surface);
}

/*
  Mêmes colonnes pour le résumé et la matrice : les mois
  restent alignés d'un tableau à l'autre.
*/
.budget-table {
  width: 100%;
  min-width: 1100px;
  table-layout: fixed;
  border-collapse: collapse;

  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
}

.budget-table th,
.budget-table td {
  padding: 6px 10px;

  border-bottom: 1px solid var(--border);

  text-align: right;
  white-space: nowrap;
}

.budget-table thead th {
  position: sticky;
  top: 0;

  background: var(--surface-soft);
  color: var(--text-soft);

  font-size: var(--font-size-xs);
  font-weight: 700;
}

/*
  Colonnes de libellé fixes au défilement horizontal.
*/
.label-cell {
  position: sticky;
  left: 0;
  z-index: 1;

  overflow: hidden;
  text-overflow: ellipsis;

  background: var(--surface);

  text-align: left !important;
  font-weight: 600;
}

.col-label {
  width: 220px;
}

.col-open {
  width: 5.5rem;
}

.col-total {
  width: 6.5rem;
}

.open-cell {
  text-align: center !important;
}

.confirmed-mark {
  color: var(--positive);
  font-weight: 700;
}

.budget-table thead .label-cell {
  background: var(--surface-soft);
}

.total-cell {
  font-weight: 700;
}

.category-row th,
.category-row td {
  background: var(--bg-soft);
  color: var(--text);

  font-weight: 700;
}

/*
  Montants à confirmer : à revoir en priorité.
*/
tr.to-confirm th,
tr.to-confirm td {
  background: color-mix(in srgb, var(--warning) 8%, var(--surface));
}

tr.to-confirm .label-cell {
  box-shadow: inset 3px 0 0 var(--warning);
}

.balance-row th,
.balance-row td {
  border-bottom: none;
}

.positive {
  color: var(--positive);
}

.negative {
  color: var(--negative);
}

.empty-cell {
  padding: 1.5rem;

  color: var(--text-soft);
  text-align: center !important;
}
</style>
