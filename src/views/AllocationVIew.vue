<template>
  <div>
    <AppTitle text="Allocation" icon="shopping_cart.png" />

    <!-- Record summary -->
    <section class="record">
      <p><strong>Date:</strong> {{ record.date }}</p>
      <p><strong>Party:</strong> {{ record.party }}</p>
      <p>
        <strong>Amount:</strong>
        {{ formatAmount(Math.abs(record.amount)) }}
      </p>
    </section>

    <!-- Form -->
    <section class="form">
      <select v-model="categoryID">
        <option disabled value="">Category</option>
        <option v-for="c in categories" :key="c.id" :value="c.id">
          {{ c.label }}
        </option>
      </select>

      <select v-model="subCategoryID" :disabled="!categoryID">
        <option disabled value="">Sub-category</option>
        <option
          v-for="sc in filteredSubCategories"
          :key="sc.id"
          :value="sc.id"
        >
          {{ sc.label }}
        </option>
      </select>

      <select v-model="payeeID">
        <option disabled value="">Payee</option>
        <option v-for="p in payees" :key="p.id" :value="p.id">
          {{ p.label }}
        </option>
      </select>

      <input v-model="comment" placeholder="Comment" />

      <input
        v-model.number="amount"
        type="number"
        step="0.01"
        placeholder="Amount"
      />

      <button @click="addAllocation">Add</button>
    </section>

    <!-- List -->
    <table>
      <tr v-for="(a, i) in allocations" :key="i">
        <td>{{ a.comment }}</td>
        <td class="right">{{ formatAmount(a.amount) }}</td>
        <td>
          <button @click="removeAllocation(i)">✕</button>
        </td>
      </tr>
    </table>

    <!-- Footer -->
    <footer>
      <p>Total: {{ formatAmount(totalAllocated) }}</p>
      <button :disabled="!isBalanced" @click="save">
        Save
      </button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import AppTitle from '@/components/AppTitle.vue'
import { useAllocation } from '@/composables/useAllocation'

/* =========================
   Route data
========================= */
const route = useRoute()
const record = JSON.parse(route.params.record as string)

/* =========================
   Allocation logic
========================= */
const {
  allocations,
  categories,
  subCategories,
  payees,

  categoryID,
  subCategoryID,
  payeeID,
  comment,
  amount,

  filteredSubCategories,
  totalAllocated,
  isBalanced,

  addAllocation,
  removeAllocation,
  save,
} = useAllocation(record.id, record.amount)

/* =========================
   Utils
========================= */
function formatAmount(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
</script>

<style scoped>
.record {
  background: #f2f2f2;
  padding: 12px;
  margin-bottom: 16px;
}

.form {
  display: grid;
  gap: 8px;
  margin-bottom: 16px;
}

.right {
  text-align: right;
}

footer {
  margin-top: 16px;
  text-align: right;
}
</style>