<script setup lang="ts">
import { computed, onMounted, nextTick, ref } from "vue";
import { useRouter } from "vue-router";

import PageHeader from "@/components/PageHeader.vue";
import { useAllocation } from "@/composables/allocations/useAllocation";
import { useCategories } from "@/composables/useCategories";

import type { SpendingRecord } from "@/composables/spending/useSpending";

/* =========================
   Router
========================= */
const router = useRouter();

/* =========================
   Props
========================= */
const props = defineProps<{ record: string }>();
const record: SpendingRecord = JSON.parse(props.record);

/* =========================
   Categories
========================= */
const categoriesStore = useCategories();

/* =========================
   Allocation logic
========================= */
const {
  allocations,
  categoryID,
  subCategoryID,
  comment,
  amount,

  totalAllocated,
  remainingAmount,
  isBalanced,
  canSaveDraft,
  canRelease,
  busy,
  busyAction,

  loadDraft,
  addAllocation,
  removeAllocation,
  saveDraft,
  release,
} = useAllocation(String(record.id), record.amount);

/* =========================
   Focus
========================= */
const amountInput = ref<HTMLInputElement | null>(null);

async function resetAmountToRemaining() {
  await nextTick();
  amount.value = Math.abs(remainingAmount.value);
  amountInput.value?.focus();
}

/* =========================
   Lifecycle
========================= */
onMounted(async () => {
  await categoriesStore.load();
  await loadDraft();
  await resetAmountToRemaining();
});

/* =========================
   Computed
========================= */
const absRemainingAmount = computed(() =>
  Math.abs(remainingAmount.value)
);

/* =========================
   Category filtering by sign
========================= */
const allowedNature = computed(() =>
  record.amount >= 0 ? "I" : "E"
);

const categories = computed(() =>
  categoriesStore.categories.value.filter(
    c => c.nature === allowedNature.value
  )
);

const subCategories = computed(() =>
  typeof categoryID.value === "number"
    ? categoriesStore.getSubcategories(categoryID.value)
    : []
);

/* =========================
   Category helpers
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

function formatAmount(a: number) {
  return a.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/* =========================
   Actions
========================= */
async function onAddAllocation() {
  await addAllocation();
  await resetAmountToRemaining();
}

async function onSaveDraft() {
  await saveDraft();
}

async function onRelease() {
  await release();
  router.push({ name: "spending" });
}

async function onRemoveAllocation(index: number) {
  await removeAllocation(index);
}

function closeView() {
  if (busy.value) return;
  router.push({ name: "spending" });
}
</script>

<template>
  <PageHeader title="Allocation" icon="shopping_cart" />

  <div class="allocation-view">
    <!-- Busy overlay -->
    <div v-if="busy" class="busy-overlay">
      <div class="busy-box">
        <div class="spinner"></div>
        <div class="busy-text">
          {{ busyAction === "release"
            ? "Releasing… please wait"
            : "Saving… please wait" }}
        </div>
      </div>
    </div>

    <!-- =========================
         1. Record summary
    ========================== -->
    <section class="allocation-record">
      <div class="record-main">
        <div class="record-party">{{ record.party }}</div>
        <div class="record-meta">{{ record.date }}</div>
      </div>

      <div class="record-amounts">
        <div class="amount-box total">
          <div class="amount-label">Total</div>
          <div class="amount-value">
            {{ formatAmount(Math.abs(record.amount)) }}
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
      <div class="form-row">
        <select v-model="categoryID">
          <option :value="null" disabled>Category</option>
          <option v-for="c in categories" :key="c.id" :value="c.id">
            {{ c.label }}
          </option>
        </select>

        <select v-model="subCategoryID" :disabled="categoryID === null">
          <option :value="null" disabled>Sub-category</option>
          <option v-for="sc in subCategories" :key="sc.id" :value="sc.id">
            {{ sc.label }}
          </option>
        </select>
      </div>

      <div class="form-row">
        <input
          ref="amountInput"
          v-model.number="amount"
          type="number"
          step="0.01"
        />
        <button
          class="primary"
          @click="onAddAllocation"
          :disabled="!categoryID || !subCategoryID || amount === 0"
        >
          Add
        </button>
      </div>

      <input
        v-model="comment"
        class="comment"
        placeholder="(optional comment)"
      />
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
              <div class="alloc-comment">
                {{ a.comment || "(no comment)" }}
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
              <button @click="onRemoveAllocation(allocations.indexOf(a))">
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
      <div class="footer-total">
        Total allocated: {{ formatAmount(totalAllocated) }}
      </div>

      <div class="footer-actions">
        <!-- Save Draft -->
        <button
          @click="onSaveDraft"
          :disabled="busy || !canSaveDraft"
        >
          <template v-if="busy && busyAction === 'save'">
            Saving…
          </template>

          <template v-else-if="canRelease">
            Draft saved ✓
          </template>

          <template v-else>
            Save draft
          </template>
        </button>
        <!-- Release -->
        <button
          @click="onRelease"
          :disabled="busy || !canRelease"
        >
          {{ busy && busyAction === "release"
            ? "Releasing…"
            : "Release" }}
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
  background: var(--primary-soft);
  padding: 14px;
  margin-bottom: 16px;
  border-radius: 10px;
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
  opacity: 0.7;
}

/* =========================
   Amount boxes (Total / Remaining)
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

/* libellé au-dessus */
.amount-label {
  font-size: 0.85rem;
  opacity: 0.7;
}

/* valeur principale */
.amount-value {
  font-size: 1.2rem;
  font-weight: 600;
}

/* couleurs */
.amount-box.total {
  color: var(--text);
}

.amount-box.remaining.unbalanced {
  color: var(--negative);
}

.amount-box.remaining.balanced {
  color: var(--positive);
}

/* =========================================================
   2. Allocation form
========================================================= */
.allocation-form {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.allocation-form select,
.allocation-form input {
  font-size: 0.9rem;
}

.form-row button {
  min-width: 70px;
  font-weight: 600;
}
.form-row {
  display: flex;
  gap: 0.6rem;
}

.form-row select,
.form-row input {
  flex: 1;
}

.allocation-form .comment {
  width: 100%;
}

/* =========================================================
   3. Allocations list
========================================================= */
.allocation-list table {
  width: 100%;
  border-collapse: collapse;
}

.allocation-list td {
  padding: 6px 4px;
  border-bottom: 1px solid var(--border);
  font-size: 0.9rem;
  vertical-align: middle;
}

.allocation-list td:first-child {
  opacity: 0.85;
}

.allocation-list button {
  background: none;
  border: none;
  color: var(--negative);
  font-size: 1rem;
  cursor: pointer;
}

.allocation-list td.right {
  text-align: right;
}

/* =========================================================
   4. Footer actions
========================================================= */
.allocation-footer {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.footer-total {
  text-align: right;
  font-size: 0.85rem;
  opacity: 0.75;
}

.footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.footer-actions button {
  font-weight: 600;
}

/* action secondaire */
.footer-actions .secondary {
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
}
button.saved {
  background: var(--primary-soft);
  color: var(--positive);
  border: 1px solid var(--positive-soft);
}

button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* =========================================================
   Allocation list – readability (2.2)
========================================================= */
.allocation-row {
  transition: background 0.15s ease;
}

.allocation-row:hover {
  background: var(--primary-soft);
}

.allocation-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* Catégorie / sous-catégorie = info principale */
.allocation-category {
  font-weight: 600;
  font-size: 0.8rem;
}

/* Commentaire = secondaire */
.allocation-comment {
  font-size: 0.95rem;
  opacity: 0.7;
}

/* Montant */
.allocation-amount {
  font-weight: 600;
  white-space: nowrap;
}
/* =========================================================
   Allocation list — text hierarchy
========================================================= */
.alloc-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* commentaire = élément principal */
.alloc-comment {
  font-size: 0.95rem;
  font-weight: 500;
}

/* catégorie / sous-catégorie = secondaire */
.alloc-category {
  font-size: 0.75rem;
  opacity: 0.7;
  white-space: nowrap;
}

/* montant bien aligné */
.alloc-amount {
  font-weight: 500;
  white-space: nowrap;
}

/* bouton delete discret mais clair */
.alloc-action button {
  background: none;
  border: none;
  color: var(--negative);
  font-size: 1rem;
  cursor: pointer;
}

/* Suppression rassurante */
.allocation-action .remove {
  background: none;
  border: none;
  color: var(--negative);
  opacity: 0.5;
  font-size: 1rem;
  cursor: pointer;
}

.allocation-action .remove:hover {
  opacity: 1;
}

.allocation-separator {
  height: 1px;
  background: var(--border);
  margin: 0.75rem 0;
}
/* =========================================================
   Busy overlay (inchangé mais positionné)
========================================================= */
.busy-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
}</style>