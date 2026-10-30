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
import PillButton from "@/components/ui/PillButton.vue";
import StatusPill from "@/components/ui/StatusPill.vue";
import SegmentedControl from "@/components/ui/SegmentedControl.vue";
import BudgetMemoSheet from "@/components/budget/BudgetMemoSheet.vue";
import MemoTooltip from "@/components/budget/MemoTooltip.vue";
import { useMemoTooltip } from "@/composables/useMemoTooltip";

import { useStorageAccess } from "@/composables/useStorageAccess";
import { useRemoteJson } from "@/composables/useRemoteJson";

import { useAppBootstrap } from "@/composables/useAppBootstrap";
import { useCategories } from "@/composables/useCategories";
import { useAllocationTags } from "@/composables/allocations/useAllocationTags";
import { useAppParameters } from "@/composables/useAppParameters";

import {
  BUDGET_FILE,
  FOLLOW_UP_FILE,
  FOLLOW_UP_FOLDER,
  readBudget,
  readFollowUp,
} from "@/contracts/followUp";

import { formatDate } from "@/utils/dateFormat";
import { formatAmount, formatInteger } from "@/utils/amountFormat";

import type {
  CategoryNature,
  SubCategory,
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

/*
  Connexion au stockage et référentiels communs.
*/
const bootstrapping =
  ref(false);

const bootstrapped =
  ref(false);

const bootstrapError =
  ref<string | null>(null);

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

/*
  Agrégats et budget, relus dès qu’ils changent sur le
  stockage. Contrat : src/contracts/followUp.ts.
*/
const followUp =
  useRemoteJson({
    folder:
      FOLLOW_UP_FOLDER,

    file:
      FOLLOW_UP_FILE,

    read:
      readFollowUp,
  });

const budget =
  useRemoteJson({
    folder:
      FOLLOW_UP_FOLDER,

    file:
      BUDGET_FILE,

    read:
      readBudget,
  });

const followUpRaw =
  followUp.data;

const budgetRaw =
  budget.data;

const loading =
  computed(() =>
    bootstrapping.value ||
    followUp.loading.value ||
    budget.loading.value
  );

const loadError =
  computed(() =>
    bootstrapError.value ??
    followUp.error.value ??
    budget.error.value
  );

const initialized =
  computed(() =>
    bootstrapped.value &&
    followUpRaw.value !== null &&
    budgetRaw.value !== null
  );

const analysisScope =
  ref<AnalysisScope>("YTD");

const labelFilter =
  ref("");

const pendingOnly =
  ref(false);

/*
  Tags retenus pour les allocations : vide = tous.
*/
const tagFilter =
  ref<number[]>([]);

const {
  tags: allocationTags,
} = useAllocationTags();

const tagChipItems =
  computed(() =>
    allocationTags.value.map(
      tag => ({
        id: tag.id,
        label: tag.tagName,
      })
    )
  );

const filtersOpen =
  ref(true);

const natureFilter =
  ref<NatureFilter>("E");

const followUpSpreadLimit =
  ref(10);

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

const yearOptions =
  computed(() =>
    availableYears.value.map(
      availableYear => ({
        value: availableYear,
        label: String(availableYear),
      })
    )
  );

/*
  MTD et YTD n’ont de sens que pour l’année en cours.
*/
const scopeOptions =
  computed(() =>
    (["FULL", "MTD", "YTD"] as AnalysisScope[]).map(
      scope => ({
        value: scope,
        label: scope,
        disabled:
          !isCurrentYear.value &&
          scope !== "FULL",
      })
    )
  );

const natureOptions: {
  value: NatureFilter;
  label: string;
}[] = [
  { value: "ALL", label: "All" },
  { value: "I", label: "Income" },
  { value: "E", label: "Expenses" },
];

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

/*
  Montant de la ligne Total : arrondi, sauf lorsque des
  allocations sont listées en dessous (sous-catégorie
  sélectionnée ou recherche transversale), où il s’aligne
  sur leurs montants à deux décimales.
*/
function fmtTotal(
  value: number
): string {

  return selectedSubCategory.value !==
      null ||
    crossSearchActive.value
    ? formatAmount(value)
    : formatInteger(value);
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

/*
  Sous-catégories de la catégorie choisie qui ont un montant
  dans l'année : une sous-catégorie clôturée n'est affichée
  (pastille et barre) que si elle en a un.
*/
const subCategoriesWithAmount =
  computed(() => {
    const ids =
      new Set<number>();

    const category =
      followUpRaw.value?.categories.find(
        item =>
          item.categoryId ===
          activeCategory.value?.id
      );

    const yearData =
      category?.years.find(
        item =>
          item.year ===
          year.value
      );

    for (const item of yearData?.items ?? []) {
      if (
        item.amount ||
        item.amountOffBudget
      ) {
        ids.add(item.subCategoryId);
      }
    }

    return ids;
  });

function isSubCategoryShown(
  subCategory: SubCategory
): boolean {
  return (
    subCategory.status === "A" ||
    subCategoriesWithAmount.value.has(
      subCategory.id
    )
  );
}

const subCategoryChips =
  computed(() => {
    if (!activeCategory.value) {
      return [];
    }

    return categoriesStore
      .getSubcategories(
        activeCategory.value.id
      )
      .filter(
        isSubCategoryShown
      )
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
      ) ||
      !isSubCategoryShown(
        subCategory
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

const items =
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

/* =========================
   Allocation search
========================= */

/*
  Le libellé recherché, les tags et le filtre Pending
  portent sur les allocations, jamais sur les libellés de
  catégories.

  - Sous-catégorie sélectionnée : le détail par mois
    est filtré.
  - Sinon : recherche transversale. Les barres laissent
    la place aux allocations trouvées dans le périmètre
    sélectionné, regroupées par sous-catégorie.
*/
const allocationSearchActive =
  computed(() =>
    pendingOnly.value ||
    tagFilter.value.length > 0 ||
    normalizeText(
      labelFilter.value
    ) !== ""
  );

const crossSearchActive =
  computed(() =>
    allocationSearchActive.value &&
    selectedSubCategory.value ===
      null
  );

/* =========================
   Reset
========================= */

function resetFilters() {
  year.value =
    currentYear;

  analysisScope.value =
    "YTD";

  natureFilter.value =
    "E";

  includeOffBudget.value =
    true;

  labelFilter.value =
    "";

  pendingOnly.value =
    false;

  tagFilter.value =
    [];

  selectedCategory.value =
    "*";

  selectedSubCategory.value =
    null;
}

/* =========================
   Budget computation
========================= */

/*
  Mémo budget d'une sous-catégorie pour l'année affichée
  (lignes de sous-catégories seulement).
*/
function budgetMemoOf(
  item: FollowUpItem
): string | null {
  if (
    selectedCategory.value === "*" ||
    !budgetRaw.value
  ) {
    return null;
  }

  const subCategoryId =
    Number(item.id);

  return (
    budgetRaw.value.memos.find(
      memo =>
        memo.year === year.value &&
        memo.subCategoryId === subCategoryId
    )?.memo ??
    null
  );
}

/*
  Mémo au survol du libellé de la sous-catégorie (Mac),
  ou au toucher (iPad).
*/
const memoTooltip =
  useMemoTooltip();

const shownMemo =
  ref<{
    title: string;
    subtitle: string;
    memo: string;
  } | null>(null);

function showBudgetMemo(
  item: FollowUpItem
) {
  const memo =
    budgetMemoOf(item);

  if (!memo) {
    return;
  }

  memoTooltip.hide();

  const categoryLabel =
    categoriesStore.getCategory(
      Number(selectedCategory.value)
    )?.label ?? "";

  shownMemo.value = {
    title: item.label,
    subtitle: `Budget memo · ${categoryLabel} · ${year.value}`,
    memo,
  };
}

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

/*
  Pendant une recherche d’allocations, le montant de la
  ligne Total est celui des allocations retenues,
  transmis par FollowUpDetails : les agrégats ignorent
  ce filtre.
*/
const detailsFilteredTotal =
  ref(0);

function totalAllocatedValue():
  number {

  if (allocationSearchActive.value) {
    return detailsFilteredTotal.value;
  }

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

    /*
      En recherche transversale, les allocations trouvées
      ne sont pas comparées au budget entier du périmètre.
    */
    const budget =
      crossSearchActive.value
        ? undefined
        : items.value
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

/*
  FollowUpDetails est toujours monté : il n’affiche le
  détail que pour une sous-catégorie ou une recherche,
  mais il fournit en permanence le nombre d’écritures en
  pending du périmètre courant.

  Sans catégorie sélectionnée, ce périmètre est celui des
  catégories visibles avec les filtres courants.
*/
const pendingCount =
  ref(0);

const allocationCategoryIds =
  computed(() => {
    if (
      selectedCategory.value ===
      "*"
    ) {
      return categoryChips.value.map(
        category =>
          category.id
      );
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
        name:
          "authentication",
      });

      return;
    }

    await loadSettings();

    followUpSpreadLimit.value =
      appParameters.value
        ?.followUpSpreadLimit ??
      10;

    bootstrapped.value =
      true;

  } catch (err) {
    console.error(
      "Follow-up initialization failed",
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

/*
  Au premier chargement des agrégats, l’année affichée doit
  exister dans le fichier.
*/
watch(
  followUpRaw,

  (current, previous) => {
    if (
      current &&
      !previous &&
      availableYears.value.length &&
      !availableYears.value.includes(
        year.value
      )
    ) {
      year.value =
        availableYears.value[0];
    }
  }
);

/* =========================
   Storage readiness watcher
========================= */

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
          <div class="primary-group">
            <SegmentedControl
              v-model="year"
              :options="yearOptions"
            />

            <SegmentedControl
              v-model="analysisScope"
              :options="scopeOptions"
            />

            <SegmentedControl
              v-model="natureFilter"
              :options="natureOptions"
            />

            <PillButton
              class="offbudget-toggle"
              :active="includeOffBudget"
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
            </PillButton>
          </div>

          <div class="text-filter-row">
            <input
              v-model="labelFilter"
              class="text-filter"
              type="search"
              placeholder="Search label…"
              autocomplete="off"
            />

            <PillButton
              :active="pendingOnly"
              :title="
                pendingOnly
                  ? 'Only pending reallocations'
                  : 'Show only pending reallocations'
              "
              @click="
                pendingOnly =
                  !pendingOnly
              "
            >
              {{
                pendingCount === 0
                  ? "Pending"
                  : pendingCount === 1
                    ? "1 pending"
                    : `${pendingCount} pendings`
              }}
            </PillButton>
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

            <ChipSelector
              v-model="tagFilter"
              label="Tag"
              :items="tagChipItems"
              :multiple="true"
              :show-all="true"
              :align-with-content="
                false
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
            <StatusPill tone="primary">
              {{ statusAsOfLabel }}
            </StatusPill>
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
              fmtTotal(
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
                formatInteger(
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
            null &&
          !crossSearchActive
        "
        :key="item.id"
        class="followup-grid followup-row"
      >
        <div
          class="label"
          :class="{
            'memo-corner has-memo':
              budgetMemoOf(item)
          }"
          @mouseenter="
            memoTooltip.show(
              $event,
              budgetMemoOf(item)
            )
          "
          @mouseleave="memoTooltip.hide()"
          @click="showBudgetMemo(item)"
        >
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
            formatInteger(
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
              formatInteger(
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

    <MemoTooltip :tooltip="memoTooltip.tooltip.value" />

    <BudgetMemoSheet
      v-if="shownMemo"
      :title="shownMemo.title"
      :subtitle="shownMemo.subtitle"
      :memo="shownMemo.memo"
      @close="shownMemo = null"
    />

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
      :pending-only="
        pendingOnly
      "
      :tag-ids="
        tagFilter
      "
      :group-by-sub-category="
        crossSearchActive
      "
      @filtered-total="
        detailsFilteredTotal = $event
      "
      @pending-count="
        pendingCount = $event
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
  display:
    flex;

  align-items:
    center;

  gap:
    1.5rem;

  flex-wrap:
    wrap;

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
.label.has-memo {
  position: relative;
  padding-right: 12px;

  cursor: pointer;
}

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

/* =========================================================
   7. STATUS & STATES
========================================================= */

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