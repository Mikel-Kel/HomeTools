<template>
  <div>
    <Title text="Allocation" icon="shopping_cart.png" />
    <div class="record-details">
      <p><strong>Date:</strong> {{ record.date }}</p>
      <p><strong>Party:</strong> {{ record.party }}</p>
      <p><strong>Amount:</strong> {{ formatAmount(record.amount) }}</p>
      <p><strong>ID:</strong> {{ record.id }}</p>
    </div>
    <button @click="closePage">Close</button>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import Title from './Title.vue';
import { useRouter, useRoute } from 'vue-router';

export default defineComponent({
  name: 'Allocation',
  components: {
    Title,
  },
  setup() {
    const route = useRoute();
    const router = useRouter();

    // Extract the record data from query parameters
    const record = {
      date: route.query.date as string,
      party: route.query.party as string,
      amount: parseFloat(route.query.amount as string),
      id: route.query.id as string,
    };

    const closePage = () => {
      router.push('/spending'); // Navigate back to Spending page
    };

    const formatAmount = (amount: number) => {
      return amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    };

    return { record, closePage, formatAmount };
  },
});
</script>

<style scoped>
.record-details {
  background-color: #f8f8f8;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 10px;
  margin: 20px 0;
}

button {
  background-color: #521a1a;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

button:hover {
  background-color: #7c1f1f;
}
</style>