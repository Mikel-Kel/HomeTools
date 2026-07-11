<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  ref,
} from "vue";

import { useRouter } from "vue-router";

import PageHeader from "@/components/PageHeader.vue";
import AppIcon from "@/components/AppIcon.vue";
import ChipSelector from "@/components/ChipSelector.vue";
import DateChip from "@/components/DateChip.vue";

import { useStorageAccess } from "@/composables/useStorageAccess";

import { useAppBootstrap } from "@/composables/useAppBootstrap";
import { useSpending } from "@/composables/spending/useSpending";
import { useAllocation } from "@/composables/allocations/useAllocation";
import { useCategories } from "@/composables/useCategories";
import { useAllocationTags } from "@/composables/allocations/useAllocationTags";
import { useAmountInput } from "@/composables/useAmountInput";

import { formatDate } from "@/utils/dateFormat";
import { formatAmount } from "@/utils/amountFormat";

import type {
  SpendingRecord,
} from "@/composables/spending/useSpending";

/* =========================
   Router / Props
========================= */

const router = useRouter();

const props =
  defineProps<{
    id: string;
  }>();

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

/* =========================
   Record
========================= */

const record =
  computed<SpendingRecord | null>(() => {
    return (
      spendingStore.records.value.find(
        item => item.id === props.id
      ) ?? null
    );
  });

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

const canSaveDraft =
  computed(() =>
    allocation.value
      ?.canSaveDraft.value ??
    false
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
    SpendingView alimente normalement le store avant
    l'ouverture d'une allocation.

    En cas de rechargement direct de l'URL, on revient
    vers SpendingView afin qu'il recharge spending.json.
  */
  if (!record.value) {
    await router.replace({
      name: "spending",
    });

    return;
  }

  await loadSettings();

  if (!allocation.value) {
    return;
  }

  await allocation.value.loadDraft();

  if (
    allocation.value.allocations.value.length === 0 &&
    record.value
  ) {
    allocation.value.categoryID.value =
      record.value.categoryID;

    allocation.value.subCategoryID.value =
      record.value.subCategoryID;

    allocation.value.comment.value =
      record.value.allocComment ?? "";
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
          allowedNature.value
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
      .getSubcategories(
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
   Labels
========================= */

function categoryLabel(
  id: number | null
): string {
  if (id == null) {
    return "";
  }

  return (
    categoriesStore
      .getCategory(id)
      ?.label ??
    ""
  );
}

function subCategoryLabel(
  currentCategoryID:
    number | null,

  currentSubCategoryID:
    number | null
): string {
  if (
    currentCategoryID == null ||
    currentSubCategoryID == null
  ) {
    return "";
  }

  return (
    categoriesStore
      .getSubcategories(
        currentCategoryID
      )
      .find(
        subCategory =>
          subCategory.id ===
          currentSubCategoryID
      )
      ?.label ??
    ""
  );
}

function tagLabel(
  id: number | null
): string {
  if (!id) {
    return "";
  }

  return (
    tagsStore
      .getTag(id)
      ?.tagName ??
    ""
  );
}

/* =========================
   Actions
========================= */

async function onAddAllocation() {
  if (!allocation.value) {
    return;
  }

  await allocation.value
    .addAllocation();

  showAllocationDate.value =
    false;

  if (
    allocation.value
      .isBalanced.value
  ) {
    await router.push({
      name: "spending",
    });

    return;
  }

  await resetAmountToRemaining();
}

async function onSaveDraft() {
  if (!allocation.value) {
    return;
  }

  await allocation.value
    .saveDraft();

  await router.push({
    name: "spending",
  });
}

async function onRemoveAllocation(
  index: number
) {
  await allocation.value
    ?.removeAllocation(index);
}

async function closeView() {
  if (busy.value) {
    return;
  }

  if (
    allocation.value
      ?.hasUnsavedChanges.value
  ) {
    const confirmed =
      confirm(
        "Discard unsaved allocation changes?"
      );

    if (!confirmed) {
      return;
    }
  }

  await router.push({
    name: "spending",
  });
}
</script>

<template>
  <PageHeader
    title="Allocation"
    icon="spending"
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
          {{ recordSafe.party }}
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
          class="field field-long"
          placeholder="(optional comment)"
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
            amount === 0
          "
          aria-label="Add allocation"
          @click="onAddAllocation"
        >
          <AppIcon
            name="add"
            :size="24"
          />
        </button>
      </div>
    </section>

    <div class="allocation-separator"></div>

    <!-- =========================
         Allocations list
    ========================== -->

    <section class="allocation-list">
      <table>
        <tbody>
          <tr
            v-for="(
              allocationItem,
              index
            ) in allocations"
            :key="allocationItem.id"
          >
            <td class="alloc-text">
              <div class="alloc-comment-row">
                <span class="alloc-comment">
                  {{
                    allocationItem.comment ||
                    "(no comment)"
                  }}
                </span>

                <span
                  v-if="
                    allocationItem.allocationDate &&
                    allocationItem.allocationDate !==
                      recordSafe.date
                  "
                  class="alloc-date-badge"
                  :title="
                    allocationItem.allocationDate
                  "
                >
                  {{
                    formatDate(
                      allocationItem.allocationDate,
                      "short"
                    )
                  }}
                </span>

                <span
                  v-if="
                    allocationItem.allocatedTagID
                  "
                  class="alloc-tag-chip"
                >
                  {{
                    tagLabel(
                      allocationItem.allocatedTagID
                    )
                  }}
                </span>
              </div>

              <div class="alloc-category">
                {{
                  categoryLabel(
                    allocationItem.categoryID
                  )
                }}

                <span
                  v-if="
                    allocationItem.subCategoryID
                  "
                >
                  ›
                  {{
                    subCategoryLabel(
                      allocationItem.categoryID,
                      allocationItem.subCategoryID
                    )
                  }}
                </span>
              </div>
            </td>

            <td class="right alloc-amount">
              {{
                formatAmount(
                  allocationItem.amount
                )
              }}
            </td>

            <td class="alloc-action">
              <button
                type="button"
                :disabled="isLocked"
                @click="
                  onRemoveAllocation(index)
                "
              >
                ✕
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- =========================
         Footer
    ========================== -->

    <footer class="allocation-footer">
      <div class="footer-actions">
        <button
          type="button"
          :disabled="
            busy ||
            !canSaveDraft
          "
          @click="onSaveDraft"
        >
          <template
            v-if="
              busy &&
              busyAction === 'save'
            "
          >
            Saving…
          </template>

          <template v-else>
            Save draft
          </template>
        </button>

        <button
          type="button"
          class="secondary"
          :disabled="busy"
          @click="closeView"
        >
          Close
        </button>
      </div>
    </footer>
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
  font-size: 0.9rem;
}

:deep(.allocation-form .chip-selector) {
  width: min(650px, 100%);
  max-width: 100%;
}

:deep(.field-short) {
  width: var(--short-w) !important;
  max-width: var(--short-w) !important;
}

:deep(.field-long) {
  width: var(--long-w) !important;
  max-width: var(--long-w) !important;
}

/* =========================
   Rows
========================= */

.allocation-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.allocation-label {
  width: 60px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-soft);
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

/* =========================================================
   Allocation list
========================================================= */

.allocation-list table {
  width: 100%;
  border-collapse: collapse;
}

.allocation-list td {
  padding: 6px 4px;
  border-bottom: 1px solid var(--border);
  font-size: 0.9rem;
}

.allocation-list td.right {
  text-align: right;
}

.allocation-list button {
  background: none;
  border: none;
  color: var(--negative);
}

.allocation-row:hover {
  background: var(--surface-3);
}

/* =========================================================
   Text hierarchy
========================================================= */

.alloc-comment-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.alloc-comment {
  font-size: 0.95rem;
  font-weight: 500;
}

.alloc-date-badge,
.alloc-tag-chip {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface-soft);
  color: var(--text-soft);
  font-size: 0.68rem;
  font-weight: 600;
  white-space: nowrap;
}

.alloc-tag-chip {
  font-weight: 700;
}

.alloc-category {
  font-size: 0.75rem;
  color: var(--text-soft);
}

.alloc-amount {
  font-weight: 500;
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
   Footer
========================================================= */

.footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
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