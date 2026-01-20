<script setup lang="ts">
import { computed, onMounted, watch } from "vue";

import PageHeader from "@/components/PageHeader.vue";
import { useAllocation } from "@/composables/useAllocation";
import { useCategories } from "@/composables/useCategories";

import type { SpendingRecord } from "@/composables/spending/useSpending";

/* =========================
   Props (route-safe)
========================= */
const props = defineProps<{
  record: string;
}>();

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
  isBalanced,

  addAllocation,
  removeAllocation,
  saveDraft,
  release,
} = useAllocation(String(record.id), record.amount);

/* =========================
   Category nature (I / E)
========================= */
const expectedNature = computed<"I" | "E">(() =>
  record.amount >= 0 ? "I" : "E"
);

/* =========================
   Remaining amount
========================= */
const remainingAmount = computed(() =>
  record.amount - totalAllocated.value
);

/* =========================
   Auto-fill amount
========================= */
watch(categoryID, (newVal) => {
  if (newVal !== null) {
    amount.value = Math.abs(remainingAmount.value);
  }
});

/* =========================
   Computed bindings
========================= */
const categories = computed(() => {
  const cats = categoriesStore.categories.value;
  if (!Array.isArray(cats)) return [];
  return cats.filter(c => c.nature === expectedNature.value);
});

const subCategories = computed(() =>
  typeof categoryID.value === "number"
    ? categoriesStore.getSubcategories(categoryID.value)
    : []
);

/* =========================
   Utils
========================= */
function formatAmount(amount: number): string {
  return amount.toLocaleString(undefined, {
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
      <p><strong>Date:</strong> {{ record.date }}</p>
      <p><strong>Party:</strong> {{ record.party }}</p>
      <p>
        <strong>Amount:</strong>
        {{ formatAmount(Math.abs(record.amount)) }}
      </p>
    </section>

    <!-- =========================
         Form
    ========================== -->
    <section class="form">
      <!-- Category -->
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

      <!-- Sub-category -->
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

      <!-- Comment -->
      <input v-model="comment" placeholder="Comment" />

      <!-- Amount (auto-filled) -->
      <input
        v-model.number="amount"
        type="number"
        step="0.01"
        placeholder="Amount"
      />

      <button @click="addAllocation">
        Add
      </button>
    </section>

    <!-- =========================
         Allocations list
    ========================== -->
    <table>
      <tr v-for="(a, i) in allocations" :key="i">
        <td>{{ a.comment }}</td>
        <td class="right">{{ formatAmount(a.amount) }}</td>
        <td>
          <button @click="removeAllocation(i)">✕</button>
        </td>
      </tr>
    </table>

    <!-- =========================
         Footer
    ========================== -->
    <footer>
      <p>
        Total: {{ formatAmount(totalAllocated) }}
        <span v-if="!isBalanced">
          (remaining {{ formatAmount(Math.abs(remainingAmount)) }})
        </span>
      </p>

      <button @click="saveDraft">
        Save draft
      </button>

      <button
        :disabled="!isBalanced"
        @click="release"
      >
        Release
      </button>
    </footer>
  </div>
</template>