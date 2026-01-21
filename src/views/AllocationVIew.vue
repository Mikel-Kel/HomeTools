<script setup lang="ts">
import { computed, onMounted } from "vue";
import PageHeader from "@/components/PageHeader.vue";
import { useAllocation } from "@/composables/useAllocation";
import { useCategories } from "@/composables/useCategories";

import type { SpendingRecord } from "@/composables/spending/useSpending";

/* =========================
   Props
========================= */
const props = defineProps<{ record: string }>();
const record: SpendingRecord = JSON.parse(props.record);

/* =========================
   Categories (settings)
========================= */
const categoriesStore = useCategories();

onMounted(async () => {
  await categoriesStore.load();
});

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

  addAllocation,
  removeAllocation,
  saveDraft,
  release,
} = useAllocation(String(record.id), record.amount);

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
    <!-- =========================
         Record summary
    ========================== -->
    <section class="record">
      <div class="record-main">
        <div class="record-party">{{ record.party }}</div>
        <div class="record-meta">{{ record.date }}</div>
      </div>

      <div class="record-amounts">
        <div class="amount-line">
          <span>Total</span>
          <strong>{{ formatAmount(Math.abs(record.amount)) }}</strong>
        </div>

        <div
          class="amount-line remaining"
          :class="{ balanced: isBalanced, unbalanced: !isBalanced }"
        >
          <span>Remaining</span>
          <strong>{{ formatAmount(absRemainingAmount) }}</strong>
        </div>
      </div>

    </section>

    <!-- =========================
         Form
    ========================== -->
    <section class="form">
      <!-- Category / Sub-category -->
      <div class="form-row">
        <select v-model.number="categoryID">
          <option :value="null" disabled>Category</option>
          <option
            v-for="c in categories"
            :key="c.id"
            :value="c.id"
          >
            {{ c.label }}
          </option>
        </select>

        <select
          v-model.number="subCategoryID"
          :disabled="categoryID === null"
        >
          <option :value="null" disabled>Sub-category</option>
          <option
            v-for="sc in subCategories"
            :key="sc.id"
            :value="sc.id"
          >
            {{ sc.label }}
          </option>
        </select>
      </div>

      <!-- Amount FIRST -->
      <div class="form-row">
        <input
          v-model.number="amount"
          type="number"
          step="0.01"
        />

        <button
          @click="addAllocation"
          :disabled="!categoryID || !subCategoryID || amount === 0"
        >
          Add
        </button>
      </div>

      <!-- Comment AFTER -->
      <input
        v-model="comment"
        placeholder="(optional comment)"
      />
    </section>

    <!-- =========================
         Allocations list
    ========================== -->
    <table>
      <tr v-for="a in allocations" :key="a.id">
        <td>{{ a.comment }}</td>
        <td class="right">{{ formatAmount(a.amount) }}</td>
        <td>
          <button @click="removeAllocation(allocations.indexOf(a))">
            ✕
          </button>
        </td>
      </tr>
    </table>

    <!-- =========================
         Footer
    ========================== -->
    <footer>
      <p>Total allocated: {{ formatAmount(totalAllocated) }}</p>

      <button @click="saveDraft">Save draft</button>

      <button
        :disabled="!isBalanced"
        @click="release"
      >
        Release
      </button>
    </footer>
  </div>
</template>

<style scoped>
.allocation-view {
  padding: 1rem;
  background: var(--bg);
  color: var(--text);
}

/* =========================
   Record summary
========================= */
.record {
  background: var(--primary-soft);
  padding: 14px;
  margin-bottom: 16px;
  border-radius: 10px;
}

.record-main {
  margin-bottom: 10px;
}

.record-party {
  font-size: 1.1rem;
  font-weight: 600;
}

.record-meta {
  font-size: 0.85rem;
  opacity: 0.7;
}

.record-amounts {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.amount-line {
  display: flex;
  flex-direction: column;
  font-size: 0.85rem;
}

.amount-line strong {
  font-size: 1.2rem;
}

.amount-line.remaining {
  color: var(--negative); /* rouge par défaut */
}

.amount-line.remaining.balanced {
  color: var(--positive); /* vert quand équilibré */
}

/* =========================
   Form
========================= */
.form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}

.form-row {
  display: flex;
  gap: 8px;
}

.form-row select,
.form-row input {
  flex: 1;
}

input,
select {
  padding: 8px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  font-size: 0.95rem;
}

/* =========================
   Buttons
========================= */
button {
  padding: 8px 14px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  background: var(--primary);
  color: white;
  font-size: 0.95rem;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* =========================
   Table
========================= */
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 8px;
}

td {
  padding: 6px;
  border-bottom: 1px solid var(--border);
  font-size: 0.9rem;
}

.right {
  text-align: right;
}

/* =========================
   Footer
========================= */
footer {
  margin-top: 16px;
  color: var(--text-muted);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

/* =========================
   Responsive
========================= */
@media (max-width: 600px) {
  .form-row {
    flex-direction: column;
  }

  footer {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>