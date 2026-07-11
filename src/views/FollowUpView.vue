<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from "vue";

import { useRouter } from "vue-router";

import PageHeader from "@/components/PageHeader.vue";
import FollowUpBar from "@/components/followup/FollowUpBar.vue";
import CategorySheet from "@/components/followup/CategorySheet.vue";
import FollowUpDetails from "@/components/followup/FollowUpDetails.vue";
import ChipSelector from "@/components/ChipSelector.vue";

import { useStorageAccess } from "@/composables/useStorageAccess";
import { useDriveWatcher } from "@/composables/useDriveWatcher";

import { useAppBootstrap } from "@/composables/useAppBootstrap";
import { useCategories } from "@/composables/useCategories";
import { useAppParameters } from "@/composables/useAppParameters";

import { loadJSONFromFolder } from "@/services/driveAdapter";

import { formatDate } from "@/utils/dateFormat";

import type {
  CategoryNature,
} from "@/composables/useCategories";

/* =========================
   Types
========================= */

type AnalysisScope =
  | "FULL"
  | "MTD"
  | "YTD";

type NatureFilter =
  | "ALL"
  | "I"
  | "E";

/* ---- Follow-up ---- */

interface FollowUpYearItem {
  subCategoryId: number;
  amount: number;
  monthToDate: number;
  amountOffBudget?: number;
  monthToDateOffBudget?: number;
}

interface FollowUpYear {
  year: number;
  items: FollowUpYearItem[];
}

interface FollowUpCategory {
  categoryId: number;
  years: FollowUpYear[];
}

interface FollowUpFile {
  version?: number;
  updatedAt?: string;
  categories: FollowUpCategory[];
}

/* ---- Budget ---- */

interface BudgetItem {
  categoryId: number;
  subCategoryId: number;
  amount: number;
}

interface BudgetMonth {
  year: number;
  month: number;
  items: BudgetItem[];
}

interface BudgetFile {
  version?: number;
  updatedAt?: string;
  budgets: BudgetMonth[];
}

interface FollowUpItem {
  id: string;
  label: string;
  amount: number;
  budget?: number;
}

/* =========================
   Router / Storage
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
   Stores
========================= */

const categoriesStore =
  useCategories();

const {
  appParameters,
} = useAppParameters();

/* =========================
   State
========================= */

const loading =
  ref(false);

const loadError =
  ref<string | null>(null);

const initialized =
  ref(false);

const categorySheetOpen =
  ref(false);

const year =
  ref<number>(
    new Date().getFullYear()
  );

const selectedCategory =
  ref<string>("*");

const selectedSubCategory =
  ref<string | null>(null);

const includeOffBudget =
  ref(true);

const followUpRaw =
  ref<FollowUpFile | null>(
    null
  );

const budgetRaw =
  ref<BudgetFile | null>(
    null
  );

const analysisScope =
  ref<AnalysisScope>("YTD");

const labelFilter =
  ref("");

const filtersOpen =
  ref(true);

const natureFilter =
  ref<NatureFilter>("E");

const showSecondaryCategories =
  ref(false);

const followUpSpreadLimit =
  ref(10);

/* =========================
   Storage watcher
========================= */

const followUpLastModified =
  ref<string | null>(null);

/*
  Le composable garde encore son nom historique
  useDriveWatcher, mais il utilise désormais la
  façade multi-backend pour lire les métadonnées.
*/
useDriveWatcher({
  folderId:
    "allocations/budget",

  fileName:
    "FollowUp.json",

  lastKnownState:
    followUpLastModified,

  onChanged:
    async () => {
      if (!storageReady.value) {
        return;
      }

      await loadFollowUp();
    },
});

/* =========================
   Filters
========================= */

watch(
  natureFilter,
  () => {
    selectedCategory.value =
      "*";

    selectedSubCategory.value =
      null;
  }
);

/* =========================
   Year / scope validity
========================= */

const currentYear =
  new Date().getFullYear();

const isCurrentYear =
  computed(() =>
    year.value === currentYear
  );

watch(
  year,
  () => {
    if (
      !isCurrentYear.value &&
      analysisScope.value !== "FULL"
    ) {
      analysisScope.value =
        "FULL";
    }
  }
);

/* =========================
   Helpers
========================= */

function getMonthIndex():
  number {

  return (
    new Date().getMonth() + 1
  );
}

function fmt(
  value: number
): string {

  return Math
    .round(value)
    .toLocaleString();
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

/* =========================
   Category visibility
========================= */

function isCategoryVisible(
  meta: any
): boolean {

  if (!meta) {
    return false;
  }

  if (
    meta.displayScope === "X"
  ) {
    return false;
  }

  if (
    natureFilter.value !==
      "ALL" &&
    meta.nature !==
      natureFilter.value
  ) {
    return false;
  }

  if (
    meta.displayScope ===
      "S" &&
    !showSecondaryCategories.value
  ) {
    return false;
  }

  return true;
}

/* =========================
   Category chips
========================= */

const categoryChips =
  computed(() => {
    if (!followUpRaw.value) {
      return [];
    }

    return followUpRaw.value
      .categories
      .map(category =>
        categoriesStore
          .getCategory(
            category.categoryId
          )
      )
      .filter(
        (
          meta
        ): meta is NonNullable<
          typeof meta
        > => !!meta
      )
      .filter(
        isCategoryVisible
      )
      .sort(
        (a, b) =>
          a.seq - b.seq
      );
  });

const categoryChipItems =
  computed(() => {
    const base =
      categoryChips.value.map(
        category => ({
          id:
            String(
              category.id
            ),

          label:
            category.label,
        })
      );

    return [
      {
        id: "*",
        label: "All",
      },
      ...base,
      {
        id: "__TOGGLE__",

        label:
          showSecondaryCategories.value
            ? "←"
            : "→",
      },
    ];
  });

/* =========================
   Derived state
========================= */

const availableYears =
  computed(() => {
    if (!followUpRaw.value) {
      return [];
    }

    return followUpRaw.value
      .categories
      .flatMap(category =>
        category.years.map(
          item => item.year
        )
      )
      .filter(
        (
          value,
          index,
          array
        ) =>
          array.indexOf(value) ===
          index
      )
      .sort(
        (a, b) => b - a
      );
  });

const activeCategory =
  computed(() => {
    if (
      selectedCategory.value ===
      "*"
    ) {
      return null;
    }

    return categoriesStore
      .getCategory(
        Number(
          selectedCategory.value
        )
      );
  });

const subCategoryChips =
  computed(() => {
    if (!activeCategory.value) {
      return [];
    }

    return categoriesStore
      .getSubcategories(
        activeCategory.value.id
      )
      .slice()
      .sort(
        (a, b) =>
          a.seq - b.seq
      );
  });

const subCategoryChipItems =
  computed(() => {
    if (!activeCategory.value) {
      return [];
    }

    return [
      {
        id: "*",
        label: "All",
      },

      ...subCategoryChips.value.map(
        subCategory => ({
          id:
            String(
              subCategory.id
            ),

          label:
            subCategory.label,
        })
      ),
    ];
  });

function selectAllCategories() {
  selectedCategory.value =
    "*";

  selectedSubCategory.value =
    null;
}

function selectCategory(
  id: number
) {
  selectedCategory.value =
    String(id);

  selectedSubCategory.value =
    null;
}

function onCategorySelect(
  id: string
) {
  if (id === "__TOGGLE__") {
    showSecondaryCategories.value =
      !showSecondaryCategories.value;

    return;
  }

  if (id === "*") {
    selectAllCategories();
    return;
  }

  selectCategory(
    Number(id)
  );
}

function selectSubCategory(
  id: number
) {
  selectedSubCategory.value =
    String(id);
}

function onSubCategorySelect(
  id: string
) {
  if (id === "*") {
    selectedSubCategory.value =
      null;

    return;
  }

  selectSubCategory(
    Number(id)
  );
}

function analysedValue(
  amount: number,
  offBudget?: number
): number {

  if (
    includeOffBudget.value
  ) {
    return amount;
  }

  return (
    amount -
    (offBudget ?? 0)
  );
}

/* =========================
   Follow-up computation
========================= */

function computeCategoryItems():
  FollowUpItem[] {

  if (!followUpRaw.value) {
    return [];
  }

  const output:
    FollowUpItem[] = [];

  for (
    const category
    of followUpRaw.value.categories
  ) {
    const meta =
      categoriesStore
        .getCategory(
          category.categoryId
        );

    if (!meta) {
      continue;
    }

    if (
      !isCategoryVisible(meta)
    ) {
      continue;
    }

    const yearData =
      category.years.find(
        item =>
          item.year ===
          year.value
      );

    if (!yearData) {
      continue;
    }

    const amount =
      yearData.items.reduce(
        (
          total,
          item
        ) => {
          const base =
            analysisScope.value ===
              "MTD"
              ? item.monthToDate
              : item.amount;

          const offBudget =
            analysisScope.value ===
              "MTD"
              ? item
                  .monthToDateOffBudget
              : item
                  .amountOffBudget;

          return (
            total +
            analysedValue(
              base,
              offBudget
            )
          );
        },
        0
      );

    output.push({
      id:
        String(
          category.categoryId
        ),

      label:
        meta.label,

      amount,
    });
  }

  return output.sort(
    (a, b) =>
      a.label.localeCompare(
        b.label
      )
  );
}

function computeSubCategoryItems():
  FollowUpItem[] {

  if (!followUpRaw.value) {
    return [];
  }

  const categoryId =
    Number(
      selectedCategory.value
    );

  const category =
    followUpRaw.value
      .categories
      .find(
        item =>
          item.categoryId ===
          categoryId
      );

  const meta =
    categoriesStore
      .getCategory(
        categoryId
      );

  if (
    !category ||
    !meta
  ) {
    return [];
  }

  const yearData =
    category.years.find(
      item =>
        item.year ===
        year.value
    );

  if (!yearData) {
    return [];
  }

  const subTotals =
    new Map<
      number,
      number
    >();

  for (
    const item
    of yearData.items
  ) {
    const base =
      analysisScope.value ===
        "MTD"
        ? item.monthToDate
        : item.amount;

    const offBudget =
      analysisScope.value ===
        "MTD"
        ? item
            .monthToDateOffBudget
        : item
            .amountOffBudget;

    const value =
      analysedValue(
        base,
        offBudget
      );

    subTotals.set(
      item.subCategoryId,

      (
        subTotals.get(
          item.subCategoryId
        ) ?? 0
      ) + value
    );
  }

  const output:
    FollowUpItem[] = [];

  const officialSubCategories =
    meta.subcategories
      .slice()
      .sort(
        (a, b) =>
          a.seq - b.seq
      );

  for (
    const subCategory
    of officialSubCategories
  ) {
    if (
      !subTotals.has(
        subCategory.id
      )
    ) {
      continue;
    }

    if (
      selectedSubCategory.value !==
        null &&
      Number(
        selectedSubCategory.value
      ) !== subCategory.id
    ) {
      continue;
    }

    output.push({
      id:
        String(
          subCategory.id
        ),

      label:
        subCategory.label,

      amount:
        subTotals.get(
          subCategory.id
        ) ?? 0,
    });
  }

  return output;
}

const baseItems =
  computed<FollowUpItem[]>(
    () => {
      if (
        selectedCategory.value ===
        "*"
      ) {
        return computeCategoryItems();
      }

      return computeSubCategoryItems();
    }
  );

const items =
  computed<FollowUpItem[]>(
    () => {
      const query =
        normalizeText(
          labelFilter.value
        );

      if (!query) {
        return baseItems.value;
      }

      return baseItems.value
        .filter(item =>
          normalizeText(
            item.label
          ).includes(query)
        );
    }
  );

/* =========================
   Budget computation
========================= */

function displayedBudget(
  item: FollowUpItem
): number | undefined {

  if (!budgetRaw.value) {
    return undefined;
  }

  const currentMonth =
    getMonthIndex();

  const rows =
    budgetRaw.value.budgets
      .filter(row => {
        if (
          row.year !==
          year.value
        ) {
          return false;
        }

        if (
          analysisScope.value ===
          "FULL"
        ) {
          return true;
        }

        if (
          analysisScope.value ===
          "MTD"
        ) {
          return (
            row.month <
            currentMonth
          );
        }

        if (
          analysisScope.value ===
          "YTD"
        ) {
          return (
            row.month <=
            currentMonth
          );
        }

        return false;
      });

  let total = 0;

  if (
    selectedCategory.value ===
    "*"
  ) {
    const categoryId =
      Number(item.id);

    for (
      const row
      of rows
    ) {
      for (
        const budgetItem
        of row.items
      ) {
        if (
          budgetItem.categoryId ===
          categoryId
        ) {
          total +=
            budgetItem.amount;
        }
      }
    }

    return (
      total ||
      undefined
    );
  }

  const categoryId =
    Number(
      selectedCategory.value
    );

  const subCategoryId =
    Number(item.id);

  for (
    const row
    of rows
  ) {
    for (
      const budgetItem
      of row.items
    ) {
      if (
        budgetItem.categoryId ===
          categoryId &&
        budgetItem.subCategoryId ===
          subCategoryId
      ) {
        total +=
          budgetItem.amount;
      }
    }
  }

  return (
    total ||
    undefined
  );
}

function allocatedValue(
  item: FollowUpItem
): number {

  return item.amount;
}

function totalAllocatedValue():
  number {

  return items.value.reduce(
    (
      total,
      item
    ) =>
      total + item.amount,
    0
  );
}

const totalItem =
  computed<
    FollowUpItem | null
  >(() => {
    if (
      !items.value.length
    ) {
      return null;
    }

    const amount =
      totalAllocatedValue();

    const budget =
      items.value
        .map(
          item =>
            displayedBudget(
              item
            ) ?? 0
        )
        .reduce(
          (a, b) => a + b,
          0
        );

    return {
      id: "total",
      label: "Total",
      amount,
      budget,
    };
  });

/* =========================
   Display helpers
========================= */

const currentNature =
  computed<
    CategoryNature | "-"
  >(() => {
    if (
      natureFilter.value ===
      "ALL"
    ) {
      return "-";
    }

    return natureFilter.value;
  });

const scale =
  computed(() => {
    const values =
      items.value.map(
        item =>
          Math.abs(
            item.amount
          )
      );

    const max =
      Math.max(
        ...values,
        1
      );

    return {
      min: 0,
      max,
    };
  });

function allocatedClass(
  amount: number,
  budget?: number
): string {

  const budgetValue =
    budget ?? 0;

  if (
    amount >
    budgetValue
  ) {
    return "allocated-bad";
  }

  if (
    amount <
    budgetValue
  ) {
    return "allocated-good";
  }

  return "allocated-neutral";
}

/* =========================
   Labels
========================= */

const statusAsOfLabel =
  computed(() => {
    if (
      !followUpRaw.value
        ?.updatedAt
    ) {
      return "";
    }

    const date =
      new Date(
        followUpRaw.value
          .updatedAt
      );

    return (
      "as of " +
      formatDate(
        date,
        "text"
      )
    );
  });

const allocatedColumnLabel =
  computed(() => {
    if (
      analysisScope.value ===
      "MTD"
    ) {
      return "MTD";
    }

    if (
      analysisScope.value ===
      "YTD"
    ) {
      return "YTD";
    }

    return "Total";
  });

/* =========================
   Details
========================= */

const showAllocationsDetail =
  computed(() =>
    selectedCategory.value !==
    "*"
  );

const allocationCategoryIds =
  computed(() => {
    if (
      selectedCategory.value ===
      "*"
    ) {
      return [];
    }

    return [
      Number(
        selectedCategory.value
      ),
    ];
  });

const allocationSubCategoryId =
  computed(() => {
    if (
      !selectedSubCategory.value
    ) {
      return null;
    }

    return Number(
      selectedSubCategory.value
    );
  });

const detailsMonthlyBudgetMap =
  computed<
    Record<string, number>
  >(() => {
    if (
      !budgetRaw.value ||
      selectedCategory.value ===
        "*" ||
      !selectedSubCategory.value
    ) {
      return {};
    }

    const categoryId =
      Number(
        selectedCategory.value
      );

    const subCategoryId =
      Number(
        selectedSubCategory.value
      );

    const map:
      Record<
        string,
        number
      > = {};

    for (
      const month
      of budgetRaw.value.budgets
    ) {
      if (
        month.year !==
        year.value
      ) {
        continue;
      }

      const budget =
        month.items
          .filter(item =>
            item.categoryId ===
              categoryId &&
            item.subCategoryId ===
              subCategoryId
          )
          .reduce(
            (
              total,
              item
            ) =>
              total +
              item.amount,
            0
          );

      const key =
        `${month.year}-${String(
          month.month
        ).padStart(2, "0")}`;

      map[key] =
        budget;
    }

    return map;
  });

const detailsNature =
  computed(() => {
    return (
      currentNature.value ===
      "-"
        ? null
        : currentNature.value
    );
  });

const detailsMaxMonth =
  computed<number | null>(
    () => {
      const currentMonth =
        getMonthIndex();

      if (
        analysisScope.value ===
        "FULL"
      ) {
        return null;
      }

      if (
        analysisScope.value ===
        "MTD"
      ) {
        return (
          currentMonth - 1
        );
      }

      if (
        analysisScope.value ===
        "YTD"
      ) {
        return currentMonth;
      }

      return null;
    }
  );

/* =========================
   Loaders
========================= */

async function loadFollowUp() {
  const data =
    await loadJSONFromFolder<
      FollowUpFile
    >(
      "allocations/budget",
      "FollowUp.json"
    );

  if (!data) {
    throw new Error(
      "FollowUp.json not found"
    );
  }

  followUpRaw.value =
    data;
}

async function loadBudget() {
  const data =
    await loadJSONFromFolder<
      BudgetFile
    >(
      "allocations/budget",
      "budget.json"
    );

  if (!data) {
    throw new Error(
      "budget.json not found"
    );
  }

  budgetRaw.value =
    data;
}

async function initializeView() {
  if (loading.value) {
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
    await loadFollowUp();
    await loadBudget();

    followUpSpreadLimit.value =
      appParameters.value
        ?.followUpSpreadLimit ??
      10;

    if (
      availableYears.value.length &&
      !availableYears.value.includes(
        year.value
      )
    ) {
      year.value =
        availableYears.value[0];
    }

    initialized.value =
      true;

  } catch (err) {
    console.error(
      "Follow-up initialization failed",
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

/* =========================
   Storage readiness watcher
========================= */

watch(
  storageReady,
  async ready => {
    if (!ready) {
      initialized.value =
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
  <div
    v-if="!storageReady"
    class="loading"
  >
    <p>
      {{
        storageUnavailableMessage ||
        "Storage not available."
      }}
    </p>
  </div>

  <div
    v-else-if="loading && !initialized"
    class="loading"
  >
    <p>Loading follow-up…</p>
  </div>

  <div
    v-else-if="loadError"
    class="loading error"
  >
    <p>{{ loadError }}</p>
  </div>

  <div v-else>
    <PageHeader
      title="Follow-up"
      icon="followup"
    />

    <!-- =========================
         STICKY STACK
    ========================== -->

    <div
      class="sticky-stack"
      :key="
        selectedCategory +
        '-' +
        selectedSubCategory
      "
    >
      <!-- Filters -->

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
        </header>

        <div
          v-if="filtersOpen"
          class="filters-body"
        >
          <div class="primary-group">
            <div class="year-segmented">
              <button
                v-for="
                  availableYear
                  in availableYears
                "
                :key="
                  availableYear
                "
                class="year-segment"
                :class="{
                  active:
                    year ===
                    availableYear
                }"
                @click="
                  year =
                    availableYear
                "
              >
                {{ availableYear }}
              </button>
            </div>

            <div class="scope-selector">
              <button
                v-for="
                  scope
                  in [
                    'FULL',
                    'MTD',
                    'YTD'
                  ]
                "
                :key="scope"
                class="scope-btn"
                :class="{
                  active:
                    analysisScope ===
                    scope,

                  disabled:
                    !isCurrentYear &&
                    scope !==
                      'FULL'
                }"
                :disabled="
                  !isCurrentYear &&
                  scope !== 'FULL'
                "
                @click="
                  analysisScope =
                    scope as
                      AnalysisScope
                "
              >
                {{ scope }}
              </button>
            </div>

            <div class="scope-selector">
              <button
                class="scope-btn"
                :class="{
                  active:
                    natureFilter ===
                    'ALL'
                }"
                @click="
                  natureFilter =
                    'ALL'
                "
              >
                All
              </button>

              <button
                class="scope-btn"
                :class="{
                  active:
                    natureFilter ===
                    'I'
                }"
                @click="
                  natureFilter =
                    'I'
                "
              >
                Income
              </button>

              <button
                class="scope-btn"
                :class="{
                  active:
                    natureFilter ===
                    'E'
                }"
                @click="
                  natureFilter =
                    'E'
                "
              >
                Expenses
              </button>
            </div>

            <button
              class="scope-btn offbudget-toggle"
              :class="{
                active:
                  includeOffBudget
              }"
              :title="
                includeOffBudget
                  ? 'Off-budget included'
                  : 'Off-budget excluded'
              "
              @click="
                includeOffBudget =
                  !includeOffBudget
              "
            >
              Off-Budget
            </button>
          </div>

          <div class="text-filter-row">
            <input
              v-model="labelFilter"
              class="text-filter"
              type="search"
              placeholder="Search label…"
              autocomplete="off"
            />
          </div>

          <div class="category-block">
            <ChipSelector
              label="Category"
              :items="
                categoryChipItems
              "
              :model-value="
                selectedCategory
              "
              :align-with-content="
                false
              "
              @update:model-value="
                onCategorySelect
              "
            />

            <ChipSelector
              v-if="activeCategory"
              label=""
              :items="
                subCategoryChipItems
              "
              :model-value="
                selectedSubCategory ??
                '*'
              "
              :align-with-content="
                false
              "
              @update:model-value="
                onSubCategorySelect
              "
            />
          </div>
        </div>
      </section>

      <!-- Header -->

      <div class="followup-header-wrapper">
        <div class="followup-grid followup-header">
          <div class="col-label">
            Categories
          </div>

          <div class="col-chart centered">
            <span class="status-pill">
              {{ statusAsOfLabel }}
            </span>
          </div>

          <div class="col-allocated">
            {{ allocatedColumnLabel }}
          </div>

          <div class="col-budget">
            Budget
          </div>
        </div>
      </div>

      <!-- Total -->

      <div
        v-if="totalItem"
        class="followup-total-wrapper"
      >
        <div class="followup-grid followup-row total">
          <div class="label">
            {{ totalItem.label }}
          </div>

          <div class="chart">
            <FollowUpBar
              :amount="
                totalItem.amount
              "
              :budget="
                totalItem.budget
              "
              :scale="scale"
              :spread-limit="
                followUpSpreadLimit
              "
              :nature="
                currentNature ===
                  '-'
                  ? null
                  : currentNature
              "
            />
          </div>

          <div
            class="allocated"
            :class="
              allocatedClass(
                totalAllocatedValue(),
                totalItem.budget
              )
            "
          >
            {{
              fmt(
                totalAllocatedValue()
              )
            }}
          </div>

          <div class="budget">
            <span
              v-if="
                totalItem.budget !==
                undefined
              "
            >
              {{
                fmt(
                  totalItem.budget
                )
              }}
            </span>

            <span
              v-else
              class="muted"
            >
              —
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- =========================
         CONTENT
    ========================== -->

    <div class="followup-table">
      <div
        v-for="item in items"
        v-if="
          selectedSubCategory ===
          null
        "
        :key="item.id"
        class="followup-grid followup-row"
      >
        <div class="label">
          {{ item.label }}
        </div>

        <div class="chart">
          <FollowUpBar
            :amount="item.amount"
            :budget="
              displayedBudget(
                item
              ) ?? 0
            "
            :scale="scale"
            :spread-limit="
              followUpSpreadLimit
            "
            :nature="
              currentNature ===
                '-'
                ? null
                : currentNature
            "
          />
        </div>

        <div
          class="allocated"
          :class="
            allocatedClass(
              allocatedValue(item),
              displayedBudget(
                item
              )
            )
          "
        >
          {{
            fmt(
              allocatedValue(item)
            )
          }}
        </div>

        <div class="budget">
          <span
            v-if="
              displayedBudget(
                item
              ) !== undefined
            "
          >
            {{
              fmt(
                displayedBudget(
                  item
                )!
              )
            }}
          </span>

          <span
            v-else
            class="muted"
          >
            —
          </span>
        </div>
      </div>
    </div>

    <CategorySheet
      v-model="
        selectedCategory
      "
      :open="
        categorySheetOpen
      "
      :categories="[]"
      @close="
        categorySheetOpen =
          false
      "
    />

    <FollowUpDetails
      v-if="
        showAllocationsDetail
      "
      :year="year"
      :category-ids="
        allocationCategoryIds
      "
      :sub-category-id="
        allocationSubCategoryId
      "
      :monthly-budget-map="
        detailsMonthlyBudgetMap
      "
      :nature="
        detailsNature
      "
      :max-month="
        detailsMaxMonth
      "
      :include-off-budget="
        includeOffBudget
      "
      :label-filter="
        labelFilter
      "
    />
  </div>
</template>

<style scoped>
/* =========================================================
   1. STICKY STACK
========================================================= */

.sticky-stack {
  position: sticky;
  top: 0;
  z-index: 200;

  background:
    color-mix(
      in srgb,
      var(--bg) 92%,
      transparent
    );

  transform:
    translateZ(0);
}

/* =========================================================
   2. FILTERS
========================================================= */

.filters {
  font-size:
    var(--font-size-sm);

  background:
    var(--bg);
}

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

.filters-header h2 {
  margin:
    0;

  font-size:
    var(--font-size-sm);

  font-weight:
    600;

  color:
    var(--text-soft);
}

.filters-body {
  padding:
    0 8px 10px;
}

.filter-row.with-label {
  display:
    flex;

  align-items:
    center;

  gap:
    0.75rem;

  flex-wrap:
    wrap;

  margin-top:
    6px;
}

.filter-label {
  width:
    90px;

  font-size:
    0.85rem;

  font-weight:
    500;

  color:
    var(--text-soft);
}

.category-block {
  display:
    flex;

  flex-direction:
    column;

  gap:
    6px;
}

.subcategory-row {
  margin-top:
    6px;

  padding-left:
    110px;
}

.primary-group {
  display:
    flex;

  align-items:
    center;

  gap:
    1.5rem;

  flex-wrap:
    wrap;

  padding:
    8px 0;
}

.offbudget-toggle {
  margin-left:
    4px;
}

.text-filter-row {
  padding:
    4px 0 8px;
}

.text-filter {
  width:
    100%;

  max-width:
    360px;

  padding:
    7px 12px;

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
    var(--font-size-sm);

  font-weight:
    500;
}

.text-filter::placeholder {
  color:
    var(--text-soft);

  opacity:
    0.6;
}

/* =========================================================
   3. HEADER BAND
========================================================= */

.followup-header-wrapper {
  background:
    var(--bg-soft);

  border-top:
    1px solid
    var(--border);

  border-bottom:
    1px solid
    var(--border);

  padding:
    0 12px;

  margin-top:
    10px;
}

.followup-header {
  padding:
    10px 0;

  font-size:
    var(--font-size-xs);

  font-weight:
    700;

  text-transform:
    uppercase;

  letter-spacing:
    0.04em;

  color:
    var(--text-soft);
}

/* =========================================================
   4. TOTAL
========================================================= */

.followup-total-wrapper {
  background:
    var(--bg);

  border-bottom:
    1px solid
    var(--border);
}

.followup-row.total {
  font-weight:
    700;

  padding:
    10px 12px;

  margin:
    0;
}

/* =========================================================
   5. TABLE & GRID
========================================================= */

.followup-table {
  padding:
    0 12px;

  display:
    flex;

  flex-direction:
    column;

  gap:
    10px;
}

.followup-grid {
  display:
    grid;

  grid-template-columns:
    220px
    1fr
    90px
    90px;

  align-items:
    center;

  column-gap:
    16px;
}

.label {
  font-size:
    0.85rem;

  font-weight:
    500;

  white-space:
    nowrap;

  overflow:
    hidden;

  text-overflow:
    ellipsis;
}

.chart {
  height:
    20px;
}

.col-chart.centered {
  text-align:
    center;
}

.col-allocated,
.col-budget,
.allocated,
.budget {
  text-align:
    right;

  font-size:
    0.85rem;

  font-weight:
    600;

  white-space:
    nowrap;
}

.muted {
  opacity:
    0.4;
}

/* =========================================================
   6. CONTROLS
========================================================= */

.year-segmented {
  display:
    inline-flex;

  padding:
    2px;

  gap:
    2px;

  background:
    var(--bg-soft);

  border-radius:
    999px;

  border:
    1px solid
    var(--border);
}

.year-segment {
  padding:
    6px 16px;

  border-radius:
    999px;

  border:
    none;

  background:
    transparent;

  font-size:
    var(--font-size-xs);

  font-weight:
    600;

  color:
    var(--text-soft);

  opacity:
    0.6;

  cursor:
    pointer;

  user-select:
    none;

  transition:
    all 0.15s ease;
}

.year-segment.active {
  background:
    var(--primary-soft);

  border:
    1px solid
    var(--primary);

  color:
    var(--primary);

  opacity:
    1;

  box-shadow:
    var(--shadow-sm);
}

.scope-selector {
  display:
    inline-flex;

  gap:
    4px;

  padding:
    2px;

  background:
    var(--bg-soft);

  border-radius:
    999px;
}

.scope-btn {
  padding:
    6px 14px;

  border-radius:
    999px;

  border:
    1px solid
    transparent;

  font-size:
    var(--font-size-xs);

  font-weight:
    600;

  color:
    var(--text-soft);

  background:
    transparent;

  opacity:
    0.6;

  cursor:
    pointer;

  user-select:
    none;

  transition:
    all 0.15s ease;
}

.scope-btn.active {
  background:
    var(--primary-soft);

  border-color:
    var(--primary);

  color:
    var(--primary);

  opacity:
    1;

  box-shadow:
    var(--shadow-sm);
}

.scope-btn.disabled {
  opacity:
    0.35;

  cursor:
    not-allowed;
}

/* =========================================================
   7. STATUS & STATES
========================================================= */

.status-pill {
  display:
    inline-flex;

  align-items:
    center;

  padding:
    4px 12px;

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

  white-space:
    nowrap;
}

.allocated-good {
  color:
    var(--positive);
}

.allocated-bad {
  color:
    var(--negative);

  font-weight:
    700;
}

.allocated-neutral {
  color:
    var(--primary);
}

.loading {
  padding:
    1rem;

  color:
    var(--text-soft);
}

.error {
  color:
    var(--negative);
}
</style>