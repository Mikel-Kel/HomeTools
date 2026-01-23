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
   Categories (settings)
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
   Focus management
========================= */
const amountInput = ref<HTMLInputElement | null>(null);

/* =========================
   Helper — set Amount = Remaining (INTENTIONNEL)
========================= */
async function resetAmountToRemaining(focus = true) {
  await nextTick();
  amount.value = Math.abs(remainingAmount.value);
  if (focus) amountInput.value?.focus();
}

/* =========================
   Lifecycle
========================= */
onMounted(async () => {
  await categoriesStore.load();
  await loadDraft();

  // ✅ 1️⃣ premier affichage → Remaining par défaut
  await resetAmountToRemaining(true);
});

/* =========================
   Computed
========================= */
const absRemainingAmount = computed(() =>
  Math.abs(remainingAmount?.value ?? 0)
);

/* =========================
   Category filtering by sign
========================= */
const allowedNature = computed(() =>
  record.amount >= 0 ? "I" : "E"
);

const categories = computed(() =>
  categoriesStore.categories.value.filter(
    (c) => c.nature === allowedNature.value
  )
);

const subCategories = computed(() =>
  typeof categoryID.value === "number"
    ? categoriesStore.getSubcategories(categoryID.value)
    : []
);

/* =========================
   Actions
========================= */
async function onAddAllocation() {
  addAllocation();

  // ✅ 2️⃣ après chaque ajout → nouveau Remaining
  await resetAmountToRemaining(true);
}

async function onSaveDraft() {
  await saveDraft();
}

async function onRelease() {
  try {
    await release();
    router.push({ name: "spending" });
  } catch (err) {
    console.error("Release failed", err);
  }
}

function closeView() {
  if (busy.value) return;
  router.push({ name: "spending" });
}

/* =========================
   Utils
========================= */
function formatAmount(a: number) {
  return a.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

    <!-- =========================
         3. Allocations list
    ========================== -->
    <section class="allocation-list">
      <table>
        <tbody>
          <tr v-for="a in allocations" :key="a.id">
            <td>{{ a.comment }}</td>
            <td class="right">{{ formatAmount(a.amount) }}</td>
            <td>
              <button @click="removeAllocation(allocations.indexOf(a))">
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
        <button
          @click="onSaveDraft"
          :disabled="busy || !canSaveDraft"
        >
          {{ busy && busyAction === "save"
              ? "Saving…"
              : "Save draft" }}
        </button>

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

button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
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