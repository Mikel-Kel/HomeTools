<template>
  <div>
    <AppTitle text="Spending" icon="shopping_cart.png" />

    <section
      v-for="(account, index) in accounts"
      :key="account.id"
      class="account"
    >
      <h2>{{ account.label }}</h2>

      <table class="spending-table">
        <thead>
          <tr>
            <th class="center">Date</th>
            <th>Party</th>
            <th class="right">Amount</th>
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="record in getRecordsForAccount(index)"
            :key="record.id"
            class="clickable"
            @click="openAllocation(record)"
          >
            <td class="center">{{ record.date }}</td>
            <td>{{ record.party }}</td>
            <td
              class="right"
              :class="record.amount >= 0 ? 'positive' : 'negative'"
            >
              {{ formatAmount(record.amount) }}
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

import AppTitle from '@/components/AppTitle.vue'
import { useSpending, type SpendingRecord } from '@/composables/useSpending'

/* =========================
   State
========================= */
const router = useRouter()
const {
  accounts,
  getRecordsForAccount,
  load,
} = useSpending()

/* =========================
   Navigation
========================= */
function openAllocation(record: SpendingRecord) {
  router.push({
    name: 'allocation',
    params: {
      record: JSON.stringify(record),
    },
  })
}

/* =========================
   Utils
========================= */
function formatAmount(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

onMounted(load)
</script>

<style scoped>
.account {
  margin-bottom: 32px;
}

.spending-table {
  width: 100%;
  border-collapse: collapse;
}

.spending-table th,
.spending-table td {
  border: 1px solid #ddd;
  padding: 8px;
}

.center {
  text-align: center;
}

.right {
  text-align: right;
}

.clickable {
  cursor: pointer;
}

.positive {
  color: green;
}

.negative {
  color: red;
}
</style>