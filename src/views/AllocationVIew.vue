<script setup lang="ts">
import { computed, onMounted, nextTick, ref } from "vue";
import { useRouter } from "vue-router";

import PageHeader from "@/components/PageHeader.vue";
import AppIcon from "@/components/AppIcon.vue";

import { useSpending } from "@/composables/spending/useSpending";
import { useAllocation } from "@/composables/allocations/useAllocation";
import { useCategories } from "@/composables/useCategories";

import type { SpendingRecord } from "@/composables/spending/useSpending";

/* =========================
   Router / Props
========================= */
const router = useRouter();
const props = defineProps<{ id: string }>();

/* =========================
   Stores
========================= */
const spendingStore = useSpending();
const categoriesStore = useCategories();

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

const allocationSafe = computed(() => {
  return allocation.value ?? {
    loading: ref(true),
    busy: ref(false),
    busyAction: ref(null),
  };
});

/* =========================
   Allocation (créé seulement si record existe)
========================= */
const loading = computed(() => allocationSafe.value.loading.value);
const busy = computed(() => allocationSafe.value.busy.value);
const busyAction = computed(() => allocationSafe.value.busyAction.value);

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

/* =========================
   Exposition SAFE pour le template
========================= */
const allocations = computed(() => allocation.value?.allocations.value ?? []);

const categoryID = computed<number | null>({
  get: () => allocation.value?.categoryID.value ?? null,
  set: v => allocation.value && (allocation.value.categoryID.value = v),
});

const subCategoryID = computed<number | null>({
  get: () => allocation.value?.subCategoryID.value ?? null,
  set: v =>
    allocation.value && (allocation.value.subCategoryID.value = v),
});

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

/*const totalAllocated = computed(
  () => allocation.value?.totalAllocated.value ?? 0
);*/
const remainingAmount = computed(
  () => allocation.value?.remainingAmount.value ?? 0
);
const isBalanced = computed(
  () => allocation.value?.isBalanced.value ?? false
);
const canSaveDraft = computed(
  () => allocation.value?.canSaveDraft.value ?? false
);
const canRelease = computed(
  () => allocation.value?.canRelease.value ?? false
);

const busyMessage = computed(() => {
  if (loading.value) return "Loading…";

  switch (busyAction.value) {
    case "save":
      return "Saving…";
    case "release":
      return "Releasing…";
    default:
      return "";
  }
});

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

/*function openDatePicker() {
  if (!dateInput.value) return;

  // API moderne (Chrome, Safari récent, iOS)
  if (typeof dateInput.value.showPicker === "function") {
    dateInput.value.showPicker();
  } else {
    // fallback ancien navigateur
    dateInput.value.focus();
    dateInput.value.click();
  }
}*/

/* =========================
   Lifecycle
========================= */
onMounted(async () => {
  await categoriesStore.load();

  if (allocation.value) {
    await allocation.value.loadDraft();
    // ✅ preset (si pas de draft chargé)
    if (allocation.value.allocations.value.length === 0 && record.value) {
      allocation.value.categoryID.value = record.value.categoryID;
      allocation.value.subCategoryID.value = record.value.subCategoryID;
      allocation.value.comment.value = record.value.allocComment ?? "";
      // tagID : pas encore disponible / visible ici, mais utilisé par useAllocation lors de addAllocation()
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
   Helpers (MANQUANTS AVANT)
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
  if (!allocation.value) return;
  await allocation.value.addAllocation();
  showAllocationDate.value = false;
  await resetAmountToRemaining();
}

async function onSaveDraft() {
  await allocation.value?.saveDraft();
}

async function onRelease() {
  await allocation.value?.release();
  router.push({ name: "spending" });
}

async function onRemoveAllocation(index: number) {
  await allocation.value?.removeAllocation(index);
}

function closeView() {
  if (busy.value) return;
  router.push({ name: "spending" });
}
</script>

<template>
  <PageHeader title="Allocation" icon="shopping_cart" />

  <div v-if="!recordReady" class="loading">
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
        <div class="record-meta">{{ recordSafe.date }}</div>
      </div>

      <div class="record-amounts">
        <div class="amount-box total">
          <div class="amount-label">Total</div>
          <div class="amount-value">
            {{ formatAmount(Math.abs(recordSafe.amount)) }}
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

      <select v-model="categoryID" class="field field-short">
        <option :value="null" disabled>Category</option>
        <option v-for="c in categories" :key="c.id" :value="c.id">
          {{ c.label }}
        </option>
      </select>

      <select
        v-model="subCategoryID"
        :disabled="categoryID === null"
        class="field field-short"
      >
        <option :value="null" disabled>Sub-category</option>
        <option v-for="sc in subCategories" :key="sc.id" :value="sc.id">
          {{ sc.label }}
        </option>
      </select>

      <!-- 🔽 MONTANT + CALENDRIER -->
      <div class="amount-block">
        <div class="amount-row">
          <input
            ref="amountInput"
            v-model="amountDisplay"
            type="text"
            inputmode="decimal"
            class="field field-short amount-input"
          />

          <!-- bouton calendrier -->
          <!--button
            class="icon-button"
            :class="{ active: allocationDate }"
            @click"openDatePicker"
            aria-label="Set allocation date"
          >-->
<label class="date-button">
  <AppIcon name="calendar" :size="32" />

  <input
    ref="dateInput"
    type="date"
    v-model="allocationDate"
    class="date-input-overlay"
    aria-label="Set allocation date"
  />
</label>


          <!-- input date INVISIBLE mais fonctionnel -->
          <!-- <input
            ref="dateInput"
            type="date"
            v-model="allocationDate"
            class="hidden-date-input"
          /> -->
        </div>
      </div> 

      <!-- commentaire + add -->
      <div class="comment-row">
        <input
          v-model="comment"
          class="field field-long"
          placeholder="(optional comment)"
        />
        <button
          class="theme-toggle"
          @click="onAddAllocation"
          :disabled="!categoryID || !subCategoryID || amount === 0"
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
                  {{ a.allocationDate }}
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
          <template v-else-if="canRelease">
            Draft saved ✓
          </template>
          <template v-else>
            Save draft
          </template>
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
.amount-label {
  font-size: 0.85rem;
  opacity: 0.7;
}
.amount-value {
  font-size: 1.2rem;
  font-weight: 600;
}
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
   2. Allocation form - global
========================================================= */
.allocation-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: flex-start;

  /* variables locales */
  --short-w: 200px;
  --long-w: 450px;
  --icon-gap: 0.6rem; /* espace montant ↔ calendrier */
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
}

/* =========================================================
   Allocation date — bouton + popover (à droite)
========================================================= */
.amount-block {
  display: inline-block;
}
.amount-row {
  display: flex;
  align-items: center;
  gap: 0.6rem; /* espace montant ↔ bouton */
}
.date-anchor {
  position: relative; /* 🔑 référence pour le popover */
  display: inline-flex;
  align-items: center;
}
/*.icon-button {
  appearance: none;
  -webkit-appearance: none;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  line-height: 0;
  opacity: 0.7;
}*/
.icon-button:hover {
  opacity: 1;
}
.icon-button.active {
  opacity: 1;
  color: var(--primary);
}

.date-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  opacity: 0.7;
}

.date-button:hover {
  opacity: 1;
}

.date-input-overlay {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.date-popover {
  position: absolute;
  top: 50%;
  left: calc(100% + 10px); /* petit espace à droite du bouton */
  transform: translateY(-50%);

  padding: 10px 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;

  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
  z-index: 50;
  white-space: nowrap; /* évite que ça passe à la ligne */
}
.date-input {
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: 0.9rem;
  outline: none;
}
/* input date invisible mais actif */
/*
.hidden-date-input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
  width: 0;
  height: 0;
}*/

/* =========================================================
   Comment row
========================================================= */
.comment-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.comment-row button {
  appearance: none;
  -webkit-appearance: none;
  background: none;
  border: none;
  box-shadow: none;
  outline: none;
}
.comment-row .field-long {
  flex: 1;
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
/*.allocation-footer {
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
*/
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
}
button.saved {
  background: var(--primary-soft);
  color: var(--positive);
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
   Allocation list — comment + date badge (iOS-like)
========================================================= */

.alloc-topline {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0; /* pour ellipsis */
}

.alloc-comment {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 0.95rem;
  font-weight: 500;

  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.alloc-date-badge {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;

  padding: 2px 8px;
  border-radius: 999px;

  border: 1px solid var(--border);
  background: var(--primary-soft);
  color: var(--primary);

  font-size: 0.75rem;
  font-weight: 800;
  opacity: 1;
  white-space: nowrap;
}

/* =========================================================
   Busy HUD — iOS style
========================================================= */
.busy-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Le panneau flottant */
.busy-box {
  min-width: 160px;
  max-width: 220px;
  padding: 14px 16px;
  border-radius: 14px;

  background: rgba(255, 255, 255, 0.85);
  color: #111;

  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;

  box-shadow:
    0 10px 30px rgba(0, 0, 0, 0.15);

  text-align: center;
}

/* Texte */
.busy-text {
  font-size: 0.85rem;
  font-weight: 500;
  opacity: 0.85;
}

/* Spinner iOS-like */
.spinner {
  width: 22px;
  height: 22px;
  border: 2px solid rgba(0, 0, 0, 0.15);
  border-top-color: rgba(0, 0, 0, 0.6);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

</style>