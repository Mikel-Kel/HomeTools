<script setup lang="ts">
import { computed, onMounted, nextTick, ref, watch } from "vue";
import { useRouter } from "vue-router";

import PageHeader from "@/components/PageHeader.vue";
import AppIcon from "@/components/AppIcon.vue";

import { useDrive } from "@/composables/useDrive";

import { useAppBootstrap } from "@/composables/useAppBootstrap"
const { loadSettings } = useAppBootstrap()

import { useSpending } from "@/composables/spending/useSpending";
import { useAllocation } from "@/composables/allocations/useAllocation";
import { useCategories } from "@/composables/useCategories";
import { useAllocationTags } from "@/composables/allocations/useAllocationTags" 

import DateChip from "@/components/DateChip.vue"
import { formatDate } from "@/utils/dateFormat";
import { formatAmount } from "@/utils/amountFormat"

import type { SpendingRecord } from "@/composables/spending/useSpending";

/* =========================
   Router / Props
========================= */
const router = useRouter();
const props = defineProps<{ id: string }>();

/* =========================
   Drive guard (AJOUT MINIMAL)
========================= */
const { driveStatus } = useDrive();

/* 🔐 Si session perdue → retour authentication */
watch(driveStatus, (status) => {
  if (status !== "CONNECTED") {
    router.replace({ name: "authentication" });
  }
});

/* =========================
   Stores
========================= */
const spendingStore = useSpending();
const categoriesStore = useCategories();

/* =========================
   TAG store
========================= */
const tagsStore = useAllocationTags()

/* =========================
   Auto-close arming
========================= */
const autoCloseArmed = ref<boolean>(false);
const hasAutoClosed = ref<boolean>(false);

/* =========================
   Record (nullable)
========================= */
const record = computed<SpendingRecord | null>(() =>
  spendingStore.records.value.find(r => r.id === props.id) ?? null
);

const recordReady = computed(() => record.value !== null);

/* ✅ Alias NON NULL pour le template */
const recordSafe = computed<SpendingRecord>(() => {
  return record.value ?? ({} as SpendingRecord);
});

/* =========================
   Allocation (créé seulement si record existe)
========================= */
const allocation = computed(() =>
  record.value
    ? useAllocation(
        record.value.id,
        record.value.amount,
        record.value.partyID,
        record.value.date
      )
    : null
);

/* SAFE fallback */
const allocationSafe = computed(() => {
  return allocation.value ?? {
    loading: ref(true),
    busy: ref(false),
    busyAction: ref(null),
  };
});

const loading = computed(() => allocationSafe.value.loading.value);
const busy = computed(() => allocationSafe.value.busy.value);
const busyAction = computed(() => allocationSafe.value.busyAction.value);

/* =========================
   Exposition SAFE pour le template
========================= */
const allocations = computed(() => allocation.value?.allocations.value ?? []);

const categoryID = computed<number | null>({
  get: () => allocation.value?.categoryID.value ?? null,
  set: v => {
    if (!allocation.value) return

    if (allocation.value.categoryID.value !== v) {
      allocation.value.categoryID.value = v
      allocation.value.subCategoryID.value = null
      allocation.value.allocatedTagID.value = null
    }
  },
});

const subCategoryID = computed<number | null>({
  get: () => allocation.value?.subCategoryID.value ?? null,
  set: v => {
    if (!allocation.value) return

    if (allocation.value.subCategoryID.value !== v) {
      allocation.value.subCategoryID.value = v
      allocation.value.allocatedTagID.value = null
    }
  },
});

const allocatedTagID = computed<number | null>({
  get: () => allocation.value?.allocatedTagID.value ?? null,
  set: v => {
    if (allocation.value) {
      allocation.value.allocatedTagID.value = v
    }
  }
})

const comment = computed<string>({
  get: () => allocation.value?.comment.value ?? "",
  set: v => allocation.value && (allocation.value.comment.value = v),
});

const amount = computed<number>({
  get: () => allocation.value?.amount.value ?? 0,
  set: v => allocation.value && (allocation.value.amount.value = v),
});


const amountDisplay = computed<string>({
  get: () => amount.value.toFixed(2),
  set: (v) => {
    const normalized = v.replace(",", ".");
    const n = Number(normalized);
    if (Number.isFinite(n)) {
      amount.value = Number(n.toFixed(2));
    }
  },
});

const allocationDate = computed<string | null>({
  get: () => allocation.value?.allocationDate?.value ?? null,
  set: v => allocation.value && (allocation.value.allocationDate.value = v),
});

const showAllocationDate = ref(false);

const remainingAmount = computed(
  () => allocation.value?.remainingAmount.value ?? 0
);

const isBalanced = computed(
  () => allocation.value?.isBalanced.value ?? false
);

const isLocked = computed(() =>
  allocation?.value?.state.value === "DRAFTED" ||
  allocation?.value?.state.value === "BUSY" ||
  allocation?.value?.state.value === "READONLY"
)

const canSaveDraft = computed(
  () => allocation.value?.canSaveDraft.value ?? false
);

const busyMessage = computed(() => {
  if (loading.value) return "Loading…";

  switch (busyAction.value) {
    case "save":
      return "Saving…";
    default:
      return "";
  }
});

/* =========================
   Auto-close when balanced
========================= */
watch(
  [isBalanced, busy],
  ([balanced, isBusy]) => {
    if (
      autoCloseArmed.value &&
      balanced &&
      !isBusy &&
      !hasAutoClosed.value
    ) {
      hasAutoClosed.value = true;
      router.push({ name: "spending" });
    }
  }
);

/* =========================
   Focus
========================= */
const amountInput = ref<HTMLInputElement | null>(null);

async function resetAmountToRemaining() {
  await nextTick();
  amount.value = Math.abs(remainingAmount.value);
  amountInput.value?.focus();
}

const dateInput = ref<HTMLInputElement | null>(null);

/* =========================
   Lifecycle
========================= */
onMounted(async () => {
  /* 🔐 sécurité supplémentaire */
  if (driveStatus.value !== "CONNECTED") {
    router.replace({ name: "authentication" });
    return;
  }

  /* 🔎 Si record absent → retour spending */
  if (!record.value) {
    router.replace({ name: "spending" });
    return;
  }

  await loadSettings()
  
  if (allocation.value) {
    await allocation.value.loadDraft();

    if (allocation.value.allocations.value.length === 0 && record.value) {
      allocation.value.categoryID.value = record.value.categoryID;
      allocation.value.subCategoryID.value = record.value.subCategoryID;
      allocation.value.comment.value = record.value.allocComment ?? "";
    }

    await resetAmountToRemaining();
  }
});

/* =========================
   Derived
========================= */
const absRemainingAmount = computed(() =>
  Math.abs(remainingAmount.value)
);

const allowedNature = computed(() =>
  record.value && record.value.amount >= 0 ? "I" : "E"
);

const categories = computed(() =>
  categoriesStore.categories.value
    .filter(c => c.nature === allowedNature.value)
);

const subCategories = computed(() =>
  typeof categoryID.value === "number"
    ? categoriesStore
        .getSubcategories(categoryID.value)
    : []
);

const canSelectTag = computed(() =>
  categoryID.value !== null &&
  subCategoryID.value !== null
)

const tags = computed(() =>
  tagsStore.tags.value
)

/* =========================
   Currency display (if present)
========================= */
const currencyAmount = computed(() => {
  const foreignAmount = recordSafe.value.foreignAmount;
  if (
    foreignAmount != null &&
    foreignAmount !== 0 &&
    recordSafe.value.currency
  ) {
    return {
      amount: foreignAmount,
      code: recordSafe.value.currency,
    };
  }
  return null;
});

/* =========================
   Helpers
========================= */
function categoryLabel(id: number | null) {
  return id == null
    ? ""
    : categoriesStore.getCategory(id)?.label ?? "";
}

function subCategoryLabel(
  categoryID: number | null,
  subCategoryID: number | null
) {
  if (categoryID == null || subCategoryID == null) return "";
  return (
    categoriesStore
      .getSubcategories(categoryID)
      .find(sc => sc.id === subCategoryID)?.label ?? ""
  );
}

function tagLabel(id: number | null) {
  if (!id) return ""
  return tagsStore.getTag(id)?.tagName ?? ""
}

/* =========================
   Actions
========================= */
async function onAddAllocation() {
  if (!allocation.value) return;

  autoCloseArmed.value = true;
  await allocation.value.addAllocation();
  showAllocationDate.value = false;
  await resetAmountToRemaining();
}

async function onSaveDraft() {
  if (!allocation.value) return;
  await allocation.value.saveDraft();
}

async function onRemoveAllocation(index: number) {
  autoCloseArmed.value = true;
  await allocation.value?.removeAllocation(index);
}

function closeView() {
  if (busy.value) return;
  router.push({ name: "spending" });
}
</script>

<template>
  <PageHeader title="Allocation" icon="spending" />

  <div v-if="driveStatus !== 'CONNECTED'" class="loading">
    <p>Drive session not available.</p>
  </div>

  <div v-else-if="!recordReady" class="loading">
    <p>Loading allocation...</p>
  </div>

  <div v-else class="allocation-view">

    <!-- Busy overlay -->
    <div v-if="loading || busy" class="busy-overlay">
      <div class="busy-box">
        <div class="spinner"></div>
        <div class="busy-text">
          {{ busyMessage }}
        </div>
      </div>
    </div>

    <!-- =========================
        1. Record summary
    ========================== -->
    <section class="allocation-record">
      <div class="record-main">
        <div class="record-party">{{ recordSafe.party }}</div>
        <div class="record-meta">{{ formatDate(recordSafe.date, "compact") }}</div>
      </div>

      <div class="record-amounts">
        <div class="amount-box total">
          <div class="amount-label">Total</div>
          <div class="amount-value amount-with-currency">
            <span>
              {{ formatAmount(Math.abs(recordSafe.amount)) }}
            </span>
            <span
              v-if="currencyAmount"
              class="currency-amount"
            >
              {{ formatAmount(Math.abs(currencyAmount.amount)) }} {{ currencyAmount.code }}
            </span>
          </div>
        </div>

        <div
          class="amount-box remaining"
          :class="{ balanced: isBalanced, unbalanced: !isBalanced }"
        >
          <div class="amount-label">Remaining</div>
          <div class="amount-value">
            {{ formatAmount(absRemainingAmount) }}
          </div>
        </div>
      </div>
    </section>

    <!-- =========================
        2. Allocation form
    ========================== -->
    <section class="allocation-form">
      <!-- CATEGORY -->
      <div class="allocation-row">
        <div class="allocation-label">
          Category
        </div>
        <div class="allocation-chip-scroll">
          <button
            v-for="c in categories"
            :key="c.id"
            class="allocation-chip"
            :class="{ active: categoryID === c.id }"
            @click="categoryID = c.id"
            :disabled="allocation?.state.value === 'DRAFTED'
                      || allocation?.state.value === 'BUSY'
                      || allocation?.state.value === 'READONLY'"
          >
            {{ c.label }}
          </button>
        </div>
      </div>
      <!-- SUBCATEGORY -->
      <div class="allocation-row" v-if="categoryID">
        <div class="allocation-label">
          Sub
        </div>
        <div class="allocation-chip-scroll">
          <button
            v-for="sc in subCategories"
            :key="sc.id"
            class="allocation-chip"
            :class="{ active: subCategoryID === sc.id }"
            @click="subCategoryID = sc.id"
            :disabled="allocation?.state.value === 'DRAFTED'
                      || allocation?.state.value === 'BUSY'
                      || allocation?.state.value === 'READONLY'"
          >
            {{ sc.label }}
          </button>
        </div>
      </div>
      <!-- 🔽 MONTANT + CALENDRIER -->
      <div class="amount-block">
        <div class="amount-row">
          <input
            ref="amountInput"
            v-model="amountDisplay"
            type="text"
            inputmode="decimal"
            class="field field-short amount-input"
            :disabled="isLocked"
          />

          <!-- 📅 bouton -->
          <button
            class="date-icon-btn"
            @click="showAllocationDate = !showAllocationDate"
            :disabled="isLocked"
          >
            <AppIcon name="calendar" :size="32" />
          </button>

          <!-- 📅 chip INLINE -->
          <transition name="fade-slide">
            <DateChip
              v-if="showAllocationDate"
              v-model="allocationDate"
              class="inline-date-chip"
            />
          </transition>
        </div>
      </div> 

      <div class="allocation-row">
        <div class="allocation-label">
          Tag
        </div>
        <div
          class="tag-scroll"
          :class="{ disabled: !categoryID || !subCategoryID }"
        >
          <button
            v-for="t in tags"
            :key="t.id"
            class="tag-chip"
            :class="{
              active: allocatedTagID === t.id,
              disabled: !categoryID || !subCategoryID
            }"
            :disabled="!categoryID || !subCategoryID"
            @click="allocatedTagID = allocatedTagID === t.id ? null : t.id"
          >
            {{ t.tagName }}
          </button>
        </div>
      </div>
      <!-- commentaire + add -->
      <div class="comment-row">
        <input v-model="comment"
          class="field field-long"
          placeholder="(optional comment)"
          :disabled="allocation?.state.value === 'DRAFTED'
                    || allocation?.state.value === 'BUSY'
                    || allocation?.state.value === 'READONLY'
                    || !categoryID
                    || !subCategoryID
                    || amount === 0"
        />
        <button
          class="theme-toggle"
          @click="onAddAllocation"
          :disabled="allocation?.state.value === 'DRAFTED'
                    || allocation?.state.value === 'BUSY'
                    || allocation?.state.value === 'READONLY'
                    || !categoryID
                    || !subCategoryID
                    || amount === 0"
          aria-label="Add allocation"
        >
          <AppIcon name="add" :size="24" />
        </button>
      </div>
    </section>
    
    <div class="allocation-separator"></div>

    <!-- =========================
        3. Allocations list
    ========================== -->
    <section class="allocation-list">
      <table>
        <tbody>
          <tr v-for="a in allocations" :key="a.id">

            <td class="alloc-text">
              <div class="alloc-comment-row">
                <span class="alloc-comment">
                  {{ a.comment || "(no comment)" }}
                </span>

                <!-- 🗓 BADGE DATE (affiché seulement si ≠ date du spending) -->
                <span
                  v-if="a.allocationDate && a.allocationDate !== recordSafe.date"
                  class="alloc-date-badge"
                  :title="a.allocationDate"
                >
                  {{ formatDate(a.allocationDate, "short") }}
                </span>
                <!-- 🏷 TAG -->
                <span
                  v-if="a.allocatedTagID"
                  class="alloc-tag"
                >
                  {{ tagLabel(a.allocatedTagID) }}
                </span>
              </div>
              <div class="alloc-category">
                {{ categoryLabel(a.categoryID) }}
                <span v-if="a.subCategoryID">
                  › {{ subCategoryLabel(a.categoryID, a.subCategoryID) }}
                </span>
              </div>
            </td>
            <td class="right alloc-amount">
              {{ formatAmount(a.amount) }}
            </td>
            <td class="alloc-action">
              <button
                @click="onRemoveAllocation(allocations.indexOf(a))"
                :disabled="allocation?.state.value === 'BUSY'
                          || allocation?.state.value === 'READONLY'"
              >
                ✕
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- =========================
        4. Footer actions
    ========================== -->
    <footer class="allocation-footer">
      <!--
      <div class="footer-total">
        Total allocated: {{ formatAmount(totalAllocated) }}
      </div>*/
      -->
      <div class="footer-actions">
        <button
          @click="onSaveDraft"
          :disabled="busy || !canSaveDraft"
        >
          <template v-if="busy && busyAction === 'save'">
            Saving…
          </template>
          <template v-else>
            Save draft
          </template>
        </button>

        <button class="secondary" @click="closeView" :disabled="busy">
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
  background: var(--surface-2); /* FIX dark mode */
  padding: 14px;
  margin-bottom: 16px;
  border-radius: 10px;
  border: 1px solid var(--border);
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

:deep(.field-short) {
  width: var(--short-w) !important;
  max-width: var(--short-w) !important;
}

:deep(.field-long) {
  width: var(--long-w) !important;
  max-width: var(--long-w) !important;
}

.amount-input {
  text-align: right;
  color: var(--text);
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
   Chips
========================================================= */
.allocation-chip-scroll {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
  position: relative;
  max-width: 420px;
}

.allocation-chip-scroll::-webkit-scrollbar {
  display: none;
}

.allocation-chip {
  flex: 0 0 auto;
  padding: 8px 10px;
  border-radius: 999px;
  border: 1px solid var(--chip-border);
  background: var(--chip-bg);
  color: var(--text);
  font-size: var(--font-size-xs);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  opacity: 0.7;
}

.allocation-chip.active {
  opacity: 1;
  background: var(--chip-active-bg);
  border-color: var(--chip-active-border);
}

.allocation-chip-scroll::after {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  width: 40px;
  height: 100%;
  pointer-events: none;
  background: linear-gradient(to right, transparent, var(--bg));
}

/* =========================================================
   Tags
========================================================= */
.tag-scroll {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
  max-width: 320px;
}

.tag-scroll::-webkit-scrollbar {
  display: none;
}

.tag-chip {
  flex: 0 0 auto;
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 0.7rem;
  cursor: pointer;
  white-space: nowrap;

  background: var(--chip-bg);
  border: 1px solid var(--chip-border);
  color: var(--text);
}

.tag-chip.active {
  background: var(--primary-soft);
  border-color: var(--primary);
}

.tag-chip.disabled {
  opacity: 0.35;
  cursor: default;
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

/* hover FIX */
.allocation-row:hover {
  background: var(--surface-3);
}

/* =========================================================
   Text hierarchy
========================================================= */
.alloc-comment {
  font-size: 0.95rem;
  font-weight: 500;
}

.alloc-category {
  font-size: 0.75rem;
  color: var(--text-soft);
}

.alloc-amount {
  font-weight: 500;
}
/* ligne montant + icône */
.amount-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* bouton calendrier */
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

.date-icon-btn:hover {
  background: var(--primary-soft);
}

/* chip inline */
.inline-date-chip {
  margin-left: 4px;
}

/* ligne du DateChip */
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