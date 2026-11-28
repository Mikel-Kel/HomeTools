<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  ref,
  watch,
} from "vue";

import { useRoute, useRouter } from "vue-router";

import PageHeader from "@/components/PageHeader.vue";
import AppIcon from "@/components/AppIcon.vue";
import ChipSelector from "@/components/ChipSelector.vue";
import DateChip from "@/components/DateChip.vue";
import RememberRule from "@/components/allocation/RememberRule.vue";
import AllocationSuggestions from "@/components/allocation/AllocationSuggestions.vue";
import SuggestionSource from "@/components/allocation/SuggestionSource.vue";
import AllocationLines from "@/components/allocation/AllocationLines.vue";
import LastAllocationOption from "@/components/allocation/LastAllocationOption.vue";
import MobileExpenseLink from "@/components/allocation/MobileExpenseLink.vue";

import { useStorageAccess } from "@/composables/useStorageAccess";

import { useAppBootstrap } from "@/composables/useAppBootstrap";
import { useSpending } from "@/composables/spending/useSpending";
import { useMovementLabel } from "@/composables/spending/useMovementLabel";
import {
  COMMENT_MAX_LENGTH,
  useAllocation,
} from "@/composables/allocations/useAllocation";
import { useCategories } from "@/composables/useCategories";
import { useAllocationTags } from "@/composables/allocations/useAllocationTags";
import {
  useLastAllocation,
  type LastAllocation,
} from "@/composables/allocations/useLastAllocation";
import { useAmountInput } from "@/composables/useAmountInput";
import { useRemoteJson } from "@/composables/useRemoteJson";

import { formatDate } from "@/utils/dateFormat";
import { formatAmount } from "@/utils/amountFormat";

import { hasCapability } from "@/services/environment/environmentState";

import type {
  SpendingRecord,
} from "@/composables/spending/useSpending";

import type {
  AllocationSuggestion,
} from "@/contracts/spending";

import {
  readSpending,
  SPENDING_FILE,
  SPENDING_FOLDER,
} from "@/contracts/spending";

/* =========================
   Router / Props
========================= */

const router = useRouter();

const route = useRoute();

const props =
  defineProps<{
    id: string;
  }>();

/*
  Page à retrouver après l'allocation : nom de route passé
  par ?from= (vue d'origine), Spending par défaut.
*/
const returnRouteName =
  computed(() => {
    const from =
      route.query.from;

    return typeof from === "string" &&
      router.hasRoute(from)
      ? from
      : "spending";
  });

/* =========================
   Storage access
========================= */

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

const spendingStore =
  useSpending();

const categoriesStore =
  useCategories();

const tagsStore =
  useAllocationTags();

const movementLabel =
  useMovementLabel();

/* =========================
   Record
========================= */

/*
  Mouvement pris dans le store de Spending ; absent (URL
  rechargée, ouverture depuis une autre vue), il est cherché
  dans spending.json, chargé ici à la demande.
*/
const spendingNeeded =
  ref(false);

const spendingFile =
  useRemoteJson({
    folder:
      SPENDING_FOLDER,

    file:
      () =>
        spendingNeeded.value
          ? SPENDING_FILE
          : null,

    read:
      readSpending,

    watchRemote:
      false,
  });

const record =
  computed<SpendingRecord | null>(() => {
    return (
      spendingStore.records.value.find(
        item => item.id === props.id
      ) ??
      spendingFile.data.value?.records.find(
        item => item.id === props.id
      ) ??
      null
    );
  });

/* Attend la fin du chargement de spending.json. */
function spendingFileSettled(): Promise<void> {
  return new Promise(resolve => {
    const stop =
      watch(
        () =>
          spendingFile.data.value !== null ||
          spendingFile.error.value !== null,

        settled => {
          if (settled) {
            stop();
            resolve();
          }
        },

        {
          immediate: true,
        }
      );
  });
}

const recordReady =
  computed(() =>
    record.value !== null
  );

const recordSafe =
  computed<SpendingRecord>(() => {
    return (
      record.value ??
      ({} as SpendingRecord)
    );
  });

/* =========================
   Allocation
========================= */

const allocation =
  computed(() => {
    if (!record.value) {
      return null;
    }

    return useAllocation(
      record.value.id,
      record.value.amount,
      record.value.partyID,
      record.value.date
    );
  });

const allocationSafe =
  computed(() => {
    return (
      allocation.value ?? {
        loading: ref(true),
        busy: ref(false),
        busyAction: ref(null),
      }
    );
  });

const loading =
  computed(() =>
    allocationSafe.value.loading.value
  );

const busy =
  computed(() =>
    allocationSafe.value.busy.value
  );

const busyAction =
  computed(() =>
    allocationSafe.value.busyAction.value
  );

/* =========================
   Allocation state
========================= */

const allocations =
  computed(() =>
    allocation.value
      ?.allocations.value ??
    []
  );

const categoryID =
  computed<number | null>({
    get: () =>
      allocation.value
        ?.categoryID.value ??
      null,

    set: value => {
      if (!allocation.value) {
        return;
      }

      if (
        allocation.value.categoryID.value !==
        value
      ) {
        allocation.value.categoryID.value =
          value;

        allocation.value.subCategoryID.value =
          null;

        allocation.value.allocatedTagID.value =
          null;
      }
    },
  });

const subCategoryID =
  computed<number | null>({
    get: () =>
      allocation.value
        ?.subCategoryID.value ??
      null,

    set: value => {
      if (!allocation.value) {
        return;
      }

      if (
        allocation.value.subCategoryID.value !==
        value
      ) {
        allocation.value.subCategoryID.value =
          value;

        allocation.value.allocatedTagID.value =
          null;
      }
    },
  });

const allocatedTagID =
  computed<number | null>({
    get: () =>
      allocation.value
        ?.allocatedTagID.value ??
      null,

    set: value => {
      if (!allocation.value) {
        return;
      }

      allocation.value.allocatedTagID.value =
        value;
    },
  });

const comment =
  computed<string>({
    get: () =>
      allocation.value
        ?.comment.value ??
      "",

    set: value => {
      if (!allocation.value) {
        return;
      }

      allocation.value.comment.value =
        value;
    },
  });

const amount =
  computed<number>({
    get: () =>
      allocation.value
        ?.amount.value ??
      0,

    set: value => {
      if (!allocation.value) {
        return;
      }

      allocation.value.amount.value =
        value;
    },
  });

const allocationDate =
  computed<string | null>({
    get: () =>
      allocation.value
        ?.allocationDate
        ?.value ??
      null,

    set: value => {
      if (!allocation.value) {
        return;
      }

      allocation.value.allocationDate.value =
        value;
    },
  });

const showAllocationDate =
  ref(false);

/*
  Allocation en cours de modification : ses valeurs sont
  reprises dans le formulaire, qui propose alors de la
  remplacer ou d’ajouter une nouvelle allocation.
*/
const editingAllocationId =
  computed(() =>
    allocation.value
      ?.editingAllocationId.value ??
    null
  );

const remainingAmount =
  computed(() =>
    allocation.value
      ?.remainingAmount.value ??
    0
  );

const isBalanced =
  computed(() =>
    allocation.value
      ?.isBalanced.value ??
    false
  );

const isLocked =
  computed(() => {
    const state =
      allocation.value?.state.value;

    return (
      state === "BUSY" ||
      state === "READONLY"
    );
  });

/* =========================
   Commentaire (mvtallocation.Comment)

   50 caractères au plus : une release plus longue échoue à
   l'import. La saisie est limitée ; un commentaire repris
   d'une suggestion ou de « Same as last », ou une ligne
   déjà dans le draft, est signalé et bloque l'ajout.
========================= */

const commentTooLong =
  computed(() =>
    comment.value.trim().length > COMMENT_MAX_LENGTH
  );

const longCommentLines =
  computed(() =>
    allocations.value.filter(
      line => line.comment.trim().length > COMMENT_MAX_LENGTH
    ).length
  );

/*
  Échec de la dernière sauvegarde automatique du draft.
*/
const saveError =
  computed(() =>
    allocation.value
      ?.saveError.value ??
    null
  );

/* =========================
   Amount input
========================= */

const {
  input: amountInputStr,
  onFocus: onAmountFocus,
  onInput: onAmountInput,
  onBlur: onAmountBlur,
} = useAmountInput(
  computed({
    get: () =>
      amount.value,

    set: value => {
      amount.value =
        value ?? 0;
    },
  })
);

/* =========================
   Busy display
========================= */

const busyMessage =
  computed(() => {
    if (loading.value) {
      return "Loading…";
    }

    switch (busyAction.value) {
      case "save":
        return "Saving…";

      default:
        return "";
    }
  });

/* =========================
   Focus
========================= */

const amountInput =
  ref<HTMLInputElement | null>(
    null
  );

async function resetAmountToRemaining() {
  await nextTick();

  amount.value =
    Math.abs(
      remainingAmount.value
    );

  amountInput.value?.focus();
}

/* =========================
   Lifecycle
========================= */

onMounted(async () => {
  const ready =
    await ensureStorageReady();

  if (!ready) {
    await router.replace({
      name: "authentication",
    });

    return;
  }

  /*
    Mouvement absent du store : spending.json est relu. S'il
    n'y figure pas (déjà alloué, fichier illisible), retour
    à la vue d'origine.
  */
  if (!record.value) {
    spendingNeeded.value = true;

    await spendingFileSettled();
  }

  if (!record.value) {
    await router.replace({
      name: returnRouteName.value,
    });

    return;
  }

  await loadSettings();

  await movementLabel.load();

  if (!allocation.value) {
    return;
  }

  await allocation.value.loadDraft();

  /* En arrière-plan : la page n'attend pas la lecture des drafts. */
  void lastAllocation.load(record.value.id);

  if (
    allocation.value.allocations.value.length === 0 &&
    record.value
  ) {
    const [principal] =
      record.value.suggestions;

    if (principal) {
      applySuggestion(principal);
    } else {
      allocation.value.categoryID.value =
        record.value.categoryID;

      allocation.value.subCategoryID.value =
        record.value.subCategoryID;

      allocation.value.comment.value =
        record.value.allocComment ?? "";
    }
  }

  await resetAmountToRemaining();
});

/* =========================
   Derived data
========================= */

const absRemainingAmount =
  computed(() =>
    Math.abs(
      remainingAmount.value
    )
  );

const allowedNature =
  computed(() => {
    if (!record.value) {
      return "E";
    }

    return (
      record.value.amount >= 0
        ? "I"
        : "E"
    );
  });

const categories =
  computed(() =>
    categoriesStore.categories.value
      .filter(
        category =>
          category.nature ===
            allowedNature.value &&
          categoriesStore
            .getActiveSubcategories(category.id)
            .length > 0
      )
  );

const subCategories =
  computed(() => {
    if (
      typeof categoryID.value !==
      "number"
    ) {
      return [];
    }

    return categoriesStore
      .getActiveSubcategories(
        categoryID.value
      );
  });

const canSelectTag =
  computed(() =>
    categoryID.value !== null &&
    subCategoryID.value !== null
  );

const tags =
  computed(() =>
    tagsStore.tags.value
  );

/* =========================
   Chip items
========================= */

const categoryItems =
  computed(() =>
    categories.value.map(
      category => ({
        id: category.id,
        label: category.label,
      })
    )
  );

const subCategoryItems =
  computed(() =>
    subCategories.value.map(
      subCategory => ({
        id: subCategory.id,
        label: subCategory.label,
      })
    )
  );

const tagItems =
  computed(() =>
    tags.value.map(
      tag => ({
        id: tag.id,
        label: tag.tagName,
      })
    )
  );

/* =========================
   Currency display
========================= */

const currencyAmount =
  computed(() => {
    const foreignAmount =
      recordSafe.value.foreignAmount;

    if (
      foreignAmount != null &&
      foreignAmount !== 0 &&
      recordSafe.value.currency
    ) {
      return {
        amount: foreignAmount,
        code:
          recordSafe.value.currency,
      };
    }

    return null;
  });

/* =========================
   Suggestions

   Candidats de spending.json (contrat des règles
   d'allocation, § 12 et § 19), affichés par
   AllocationSuggestions.vue. La suggestion principale est
   appliquée à l'ouverture d'un mouvement sans draft ; un
   candidat choisi remplit partie, catégorie, sous-catégorie,
   commentaire, tag et date d'allocation. Proposés tant
   qu'aucune allocation n'est enregistrée (la partie vaut
   pour tout le draft). Mouvement sans candidats :
   comportement d'avant (catégorie, sous-catégorie et
   commentaire suggérés).

   Candidats relus après « Not this expense » : gardés ici,
   le mouvement du store reste le même (un nouveau mouvement
   recréerait l'allocation et son draft).
========================= */

const appliedSuggestion =
  ref<AllocationSuggestion | null>(null);

const refreshedSuggestions =
  ref<AllocationSuggestion[] | null>(null);

const suggestions =
  computed<AllocationSuggestion[]>(() =>
    refreshedSuggestions.value ??
    recordSafe.value.suggestions ??
    []
  );

function applySuggestion(
  suggestion: AllocationSuggestion
) {
  if (!allocation.value) {
    return;
  }

  allocation.value.applySuggestion(
    suggestion
  );

  appliedSuggestion.value =
    suggestion;

  showAllocationDate.value =
    allocation.value
      .allocationDate.value !==
    null;
}

const showSuggestions =
  computed(() =>
    suggestions.value.length > 0 &&
    allocations.value.length === 0 &&
    editingAllocationId.value === null
  );

/* =========================
   Saisie de l'iPhone

   Candidat mobile (capacité mobileExpense,
   ../Backend/docs/mobile-expense-contract.md, § 7) : bandeau
   MobileExpenseLink.vue, affiché tant que le mouvement est
   lié, même après des allocations. Liaison défaite : le Mac
   a republié spending.json, relu ici ; la suggestion
   principale suivante remplace le candidat mobile s'il était
   appliqué et qu'aucune allocation n'est enregistrée.
========================= */

const mobileExpenseId =
  computed(() =>
    hasCapability("mobileExpense")
      ? suggestions.value.find(
          suggestion =>
            suggestion.source === "mobile" &&
            suggestion.mobileExpenseId
        )?.mobileExpenseId ?? null
      : null
  );

/* Commerçant tapé sur l'iPhone sans partie correspondante (contrat 0.9). */
const mobilePartyName =
  computed(() =>
    mobileExpenseId.value
      ? suggestions.value.find(
          suggestion =>
            suggestion.mobileExpenseId === mobileExpenseId.value
        )?.mobilePartyName ?? null
      : null
  );

/* Partie créée depuis le bandeau : elle devient celle de l'allocation. */
async function onMobilePartyCreated(
  partyId: number
) {
  if (!allocation.value || isLocked.value) {
    return;
  }

  await allocation.value.setParty(partyId);
}

async function onMobileUnlinked() {
  const unlinkedId =
    mobileExpenseId.value;

  if (spendingNeeded.value) {
    await spendingFile.reload();
  } else {
    spendingNeeded.value = true;
    await spendingFileSettled();
  }

  const fresh =
    spendingFile.data.value?.records.find(
      item => item.id === props.id
    )?.suggestions ?? suggestions.value;

  refreshedSuggestions.value =
    fresh.filter(
      suggestion =>
        suggestion.source !== "mobile" ||
        suggestion.mobileExpenseId !== unlinkedId
    );

  if (
    appliedSuggestion.value?.source === "mobile" &&
    allocations.value.length === 0 &&
    editingAllocationId.value === null
  ) {
    const [principal] =
      refreshedSuggestions.value;

    if (principal) {
      applySuggestion(principal);
    } else {
      appliedSuggestion.value = null;
    }
  }
}

/* =========================
   Same as last

   Les deux dernières allocations distinctes, tirées des
   drafts du stockage (useLastAllocation) : catégorie,
   sous-catégorie, tag et commentaire tel quel ; montant,
   partie et date d'allocation inchangés. Proposées, comme
   les suggestions, tant qu'aucune allocation n'est
   enregistrée, et seulement si leur catégorie convient au
   mouvement (nature, sous-catégorie active). Choisie, l'une
   remplace la suggestion appliquée, qui revient dans la liste.
========================= */

const MAX_LAST_OPTIONS = 2;

const lastAllocation =
  useLastAllocation();

function fitsMovement(
  last: LastAllocation
): boolean {
  return (
    categories.value.some(category => category.id === last.categoryID) &&
    categoriesStore
      .getActiveSubcategories(last.categoryID)
      .some(subCategory => subCategory.id === last.subCategoryID)
  );
}

const lastOptions =
  computed<LastAllocation[]>(() =>
    allocations.value.length > 0 || editingAllocationId.value !== null
      ? []
      : lastAllocation.recent.value
          .filter(fitsMovement)
          .slice(0, MAX_LAST_OPTIONS)
  );

/* Panneau affiché s'il a au moins une proposition. */
const hasProposals =
  computed(() =>
    lastOptions.value.length > 0 ||
    (
      showSuggestions.value &&
      suggestions.value.some(
        suggestion => suggestion !== appliedSuggestion.value
      )
    )
  );

function applyLast(
  last: LastAllocation
) {
  if (!allocation.value) {
    return;
  }

  allocation.value.categoryID.value = last.categoryID;
  allocation.value.subCategoryID.value = last.subCategoryID;
  allocation.value.allocatedTagID.value = last.allocatedTagID;
  allocation.value.comment.value = last.comment;

  appliedSuggestion.value = null;
}

/* =========================
   Remember

   Case, règle et envoi : RememberRule.vue.
========================= */

const rememberRule =
  ref<InstanceType<typeof RememberRule> | null>(null);

const allocPartyID =
  computed(() =>
    allocation.value?.allocPartyID.value ?? null
  );

/* Une seule ligne : montant entier, aucune ligne enregistrée ni modifiée. */
const isSingleLine =
  computed(() =>
    allocations.value.length === 0 &&
    editingAllocationId.value === null &&
    Number(amount.value.toFixed(2)) ===
      Number(Math.abs(recordSafe.value.amount ?? 0).toFixed(2))
  );

/* =========================
   Actions
========================= */

async function onAddAllocation() {
  await commitAllocation(false);
}

async function onReplaceAllocation() {
  await commitAllocation(true);
}

async function commitAllocation(
  replaceEdited: boolean
) {
  if (!allocation.value) {
    return;
  }

  /* Demande Remember lue avant que le formulaire ne se vide. */
  const sendRemember =
    replaceEdited || !record.value
      ? null
      : rememberRule.value?.capture(
          comment.value.trim(),
          allocationDate.value?.trim() || record.value.date
        ) ?? null;

  if (replaceEdited) {
    await allocation.value
      .replaceAllocation();
  } else {
    await allocation.value
      .addAllocation();
  }

  showAllocationDate.value =
    false;

  /* Allocation enregistrée sur une seule ligne : la règle part aussi. */
  if (
    sendRemember &&
    allocation.value.isBalanced.value &&
    allocation.value.allocations.value.length === 1
  ) {
    /* Écriture impossible : le message reste affiché sur la page. */
    if (!(await sendRemember())) {
      return;
    }
  }

  if (
    allocation.value
      .isBalanced.value
  ) {
    await router.push({
      name: returnRouteName.value,
    });

    return;
  }

  await resetAmountToRemaining();
}

async function onRemoveAllocation(
  index: number
) {
  await allocation.value
    ?.removeAllocation(index);

  if (
    editingAllocationId.value ===
    null
  ) {
    showAllocationDate.value =
      false;
  }
}

/*
  Un second appui sur la même allocation annule la
  modification.
*/
function onEditAllocation(
  index: number
) {
  if (!allocation.value) {
    return;
  }

  const item =
    allocations.value[index];

  if (
    item?.id ===
    editingAllocationId.value
  ) {
    allocation.value
      .cancelEdit();

    showAllocationDate.value =
      false;

    return;
  }

  allocation.value
    .editAllocation(index);

  showAllocationDate.value =
    allocation.value
      .allocationDate.value !==
    null;
}
</script>

<template>
  <PageHeader
    title="Allocation"
    icon="creditcard"
  />

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
    v-else-if="!recordReady"
    class="loading"
  >
    <p>Loading allocation…</p>
  </div>

  <div
    v-else
    class="allocation-view"
  >
    <!-- Busy overlay -->

    <div
      v-if="loading || busy"
      class="busy-overlay"
    >
      <div class="busy-box">
        <div class="spinner"></div>

        <div class="busy-text">
          {{ busyMessage }}
        </div>
      </div>
    </div>

    <!-- =========================
         Record summary
    ========================== -->

    <section class="allocation-record">
      <div class="record-main">
        <div class="record-party">
          {{ movementLabel.label(recordSafe) }}
        </div>

        <div
          v-if="movementLabel.secondLine(recordSafe)"
          class="record-bank"
        >
          {{ movementLabel.secondLine(recordSafe) }}
        </div>

        <div class="record-meta">
          {{
            formatDate(
              recordSafe.date,
              "compact"
            )
          }}
        </div>
      </div>

      <div class="record-amounts">
        <div class="amount-box total">
          <div class="amount-label">
            Total
          </div>

          <div
            class="amount-value amount-with-currency"
          >
            <span>
              {{
                formatAmount(
                  Math.abs(
                    recordSafe.amount
                  )
                )
              }}
            </span>

            <span
              v-if="currencyAmount"
              class="currency-amount"
            >
              {{
                formatAmount(
                  Math.abs(
                    currencyAmount.amount
                  )
                )
              }}
              {{ currencyAmount.code }}
            </span>
          </div>
        </div>

        <div
          class="amount-box remaining"
          :class="{
            balanced: isBalanced,
            unbalanced: !isBalanced
          }"
        >
          <div class="amount-label">
            Remaining
          </div>

          <div class="amount-value">
            {{
              formatAmount(
                absRemainingAmount
              )
            }}
          </div>
        </div>
      </div>
    </section>

    <!-- =========================
         Allocation form
    ========================== -->

    <section class="allocation-form">
      <ChipSelector
        v-model="categoryID"
        label="Category"
        :items="categoryItems"
        :show-all="false"
        :align-with-content="true"
        :disabled="isLocked"
      />

      <ChipSelector
        v-if="categoryID"
        v-model="subCategoryID"
        label="Sub"
        :items="subCategoryItems"
        :show-all="false"
        :align-with-content="true"
        :disabled="isLocked"
      />

      <div class="amount-block">
        <div class="amount-row">
          <input
            ref="amountInput"
            :value="amountInputStr"
            type="text"
            inputmode="decimal"
            class="field field-short amount-input"
            :disabled="isLocked"
            @input="
              onAmountInput(
                (
                  $event.target as
                    HTMLInputElement
                ).value
              )
            "
            @focus="onAmountFocus($event)"
            @blur="onAmountBlur"
          />

          <button
            type="button"
            class="date-icon-btn"
            :disabled="isLocked"
            @click="
              showAllocationDate =
                !showAllocationDate
            "
          >
            <AppIcon
              name="calendar"
              :size="32"
            />
          </button>

          <transition name="fade-slide">
            <DateChip
              v-if="showAllocationDate"
              v-model="allocationDate"
              class="inline-date-chip"
            />
          </transition>
        </div>
      </div>

      <ChipSelector
        v-model="allocatedTagID"
        label="Tag"
        :items="tagItems"
        :show-all="true"
        :align-with-content="true"
        :disabled="
          !canSelectTag ||
          isLocked
        "
      />

      <div class="comment-row">
        <input
          v-model="comment"
          type="text"
          autocomplete="off"
          class="field field-long"
          :class="{ invalid: commentTooLong }"
          placeholder="(optional comment)"
          :maxlength="COMMENT_MAX_LENGTH"
          :disabled="
            isLocked ||
            !categoryID ||
            !subCategoryID ||
            amount === 0
          "
        />

        <button
          type="button"
          class="theme-toggle"
          :disabled="
            isLocked ||
            !categoryID ||
            !subCategoryID ||
            amount === 0 ||
            commentTooLong
          "
          aria-label="Add allocation"
          :title="
            editingAllocationId
              ? 'Add as a new allocation'
              : 'Add allocation'
          "
          @click="onAddAllocation"
        >
          <AppIcon
            name="add_element"
            :size="24"
          />
        </button>

        <button
          v-if="editingAllocationId"
          type="button"
          class="theme-toggle"
          :disabled="
            isLocked ||
            !categoryID ||
            !subCategoryID ||
            amount === 0 ||
            commentTooLong
          "
          aria-label="Replace the edited allocation"
          title="Replace the edited allocation"
          @click="onReplaceAllocation"
        >
          <AppIcon
            name="update_element"
            :size="24"
          />
        </button>
      </div>

      <p
        v-if="commentTooLong"
        class="comment-error"
      >
        At most {{ COMMENT_MAX_LENGTH }} characters ({{ comment.trim().length }}): shorten the comment.
      </p>

      <RememberRule
        ref="rememberRule"
        :record="recordSafe"
        :alloc-party-id="allocPartyID"
        :sub-category-id="subCategoryID"
        :tag-id="allocatedTagID"
        :single-line="isSingleLine"
        :has-lines="allocations.length > 0"
        :disabled="isLocked"
      />

      <SuggestionSource
        v-if="showSuggestions && appliedSuggestion"
        :applied="appliedSuggestion"
      />

      <MobileExpenseLink
        v-if="mobileExpenseId"
        :key="mobileExpenseId"
        :expense-id="mobileExpenseId"
        :party-name="mobilePartyName"
        :disabled="isLocked"
        @unlinked="onMobileUnlinked"
        @party-created="onMobilePartyCreated"
      />

      <!-- Propositions : autres suggestions et dernières allocations, à part du formulaire. -->
      <div
        v-if="hasProposals"
        class="proposals"
      >
        <AllocationSuggestions
          v-if="showSuggestions"
          :suggestions="suggestions"
          :applied="appliedSuggestion"
          :value-date="recordSafe.date"
          :disabled="isLocked"
          @apply="applySuggestion"
        />

        <LastAllocationOption
          v-for="(last, index) in lastOptions"
          :key="index"
          :last="last"
          :rank="index"
          :disabled="isLocked"
          @apply="applyLast"
        />
      </div>
    </section>

    <div class="allocation-separator"></div>

    <!-- =========================
         Allocations list
    ========================== -->

    <section class="allocation-list">
      <AllocationLines
        :lines="allocations"
        :value-date="recordSafe.date"
        editable
        :editing-id="editingAllocationId"
        :disabled="isLocked"
        @edit="onEditAllocation"
        @remove="onRemoveAllocation"
      />

      <p
        v-if="longCommentLines"
        class="lines-error"
      >
        {{ longCommentLines }} line{{ longCommentLines === 1 ? "" : "s" }} with a comment over
        {{ COMMENT_MAX_LENGTH }} characters: edit {{ longCommentLines === 1 ? "it" : "them" }}, the release would fail.
      </p>
    </section>

    <!-- =========================
         Save error
    ========================== -->

    <p
      v-if="saveError"
      class="save-error"
    >
      Draft not saved: {{ saveError }}
    </p>
  </div>
</template>

<style scoped>
/* =========================================================
   Base container
========================================================= */

.allocation-view {
  position: relative;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  background: var(--bg);
  color: var(--text);
}

/* =========================
   Record summary
========================= */

.allocation-record {
  padding: 14px;
  margin-bottom: 16px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface-2);
}

.record-main {
  margin-bottom: 12px;
}

.record-party {
  font-size: 1.1rem;
  font-weight: 600;
}

.record-bank {
  font-size: 0.85rem;
  color: var(--text-soft);
  overflow-wrap: anywhere;
}

.record-meta {
  font-size: 0.85rem;
  color: var(--text-soft);
}

/* =========================
   Amount boxes
========================= */

.record-amounts {
  display: flex;
  justify-content: space-between;
  gap: 24px;
}

.amount-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.amount-label {
  font-size: 0.85rem;
  color: var(--text-soft);
}

.amount-value {
  font-size: 1.2rem;
  font-weight: 600;
}

.amount-with-currency {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.amount-input {
  text-align: right;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

.currency-amount {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--primary);
  white-space: nowrap;
}

.amount-box.remaining.unbalanced {
  color: var(--negative);
}

.amount-box.remaining.balanced {
  color: var(--positive);
}

/* =========================================================
   Allocation form
========================================================= */

.allocation-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: flex-start;

  --short-w: 200px;
  --long-w: 450px;
}

.field {
  box-sizing: border-box;

  padding: 6px 10px;

  border: 1px solid var(--input-border);
  border-radius: 8px;

  font: inherit;
  font-size: 0.9rem;
}

.field:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary-soft);
}

.field:disabled {
  opacity: 0.6;
}

:deep(.allocation-form .chip-selector) {
  width: 100%;
}

:deep(.field-short) {
  width: var(--short-w) !important;
  max-width: var(--short-w) !important;
}

:deep(.field-long) {
  width: var(--long-w) !important;
  max-width: var(--long-w) !important;
}

/* =========================================================
   Proposals
========================================================= */

.proposals {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  box-sizing: border-box;
  width: 100%;
  max-width: 664px;
  margin-top: 0.75rem;
  padding: 10px 12px;

  border: 1px solid var(--proposals-border);
  border-radius: 10px;

  background: var(--proposals-bg);
}

/* =========================================================
   Comment row
========================================================= */

.comment-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.comment-row button {
  background: none;
  border: none;
}

.comment-row .field-long {
  flex: 1;
}

/* =========================
   Amount/date row
========================= */

.amount-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.date-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 36px;
  height: 36px;

  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);

  cursor: pointer;
  transition: all 0.15s ease;
}

.date-icon-btn:hover:not(:disabled) {
  background: var(--primary-soft);
}

.inline-date-chip {
  margin-left: 4px;
}

.date-row {
  margin-top: 6px;
}

/* =========================================================
   Save error
========================================================= */

.save-error {
  margin: 0.75rem 0 0;

  color: var(--negative);
  font-size: var(--font-size-sm);
}

.comment-error {
  margin: -0.4rem 0 0;

  color: var(--negative);
  font-size: var(--font-size-sm);
}

.lines-error {
  margin: 0.5rem 0 0;

  color: var(--negative);
  font-size: var(--font-size-sm);
}

.comment-row .field-long.invalid {
  border-color: var(--negative);
}

/* =========================================================
   Busy HUD
========================================================= */

.busy-overlay {
  position: absolute;
  inset: 0;
  z-index: 999;

  display: flex;
  align-items: center;
  justify-content: center;
}

.busy-box {
  padding: 14px 16px;
  border-radius: 14px;
  background: var(--surface-2);
  color: var(--text);
  box-shadow: var(--shadow-md);
}

.busy-text {
  font-size: 0.85rem;
  color: var(--text-soft);
}

.spinner {
  width: 22px;
  height: 22px;

  border: 2px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;

  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>