<template>
  <div>
    <Title text="Spending" icon="shopping_cart.png" />  
    <!-- Dynamic tables for each account -->
    <div v-for="(account, index) in accounts" :key="account.AccountID">
      <h2>{{ account.AccountDescription }}</h2>
      <table class="spending-table">
        <thead>
          <tr>
            <th class="fixed-width centered">Date</th>
            <th class="party-column">Party</th>
            <th class="fixed-width right-align">Amount</th>
            <th>Id</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="record in spendingRecords[index]"
            :key="record.id"
            @click="handleRowClick(record)"
          >
            <td class="fixed-width centered">{{ record.date }}</td>
            <td class="party-column">{{ record.party }}</td>
            <td :class="['fixed-width', 'right-align', getAmountClass(record.amount)]">
              {{ formatAmount(record.amount) }}
            </td>
            <td>{{ record.id }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
  
<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue';
import Title from './Title.vue';
import { useRouter } from 'vue-router';
import axios from 'axios';

export default defineComponent({
  name: 'Spending',
  components: {
    Title,
  },
  setup() {
    const router = useRouter(); // Access the router

    interface SpendingRecord {
      date: string;
      party: string;
      amount: number;
      id: string;
    }
    interface Account {
      AccountID: string;
      AccountDescription: string;
    }

    const accounts = ref<Account[]>([]);
    const spendingRecords = ref<SpendingRecord[][]>([]);

    const fetchAccounts = async () => {
      try {
        const response = await axios.get('http://localhost:3000/api/accounts');
        accounts.value = response.data;
        spendingRecords.value = accounts.value.map(() => []);
      } catch (error) {
        console.error('Error fetching accounts:', error);
      }
    };

    const fetchSpendingRecords = async (accountID: string, index: number) => {
      try {
        const response = await axios.get('http://localhost:3000/api/spending', {
          params: { accountID },
        });
        spendingRecords.value[index] = response.data;
      } catch (error) {
        console.error('Error fetching spending data:', error);
      }
    };

    const handleRowClick = (record: SpendingRecord) => {
      // Navigate to the Allocation page, passing the record as a prop
      router.push({
        name: 'allocation',
        params: { record: JSON.stringify(record) }, // Pass the record as part of the route params
      });
    };

    const getAmountClass = (amount: number) => {
      return amount > 0 ? 'positive-amount' : 'negative-amount';
    };

    const formatAmount = (amount: number) => {
      return amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    };

    onMounted(async () => {
      await fetchAccounts();
      accounts.value.forEach((account, index) => {
        fetchSpendingRecords(account.AccountID, index);
      });
    });

    return {
      accounts,
      spendingRecords,
      handleRowClick,
      getAmountClass,
      formatAmount,
    };
  },
});
</script>

<style scoped>
/* General Styles for Table */
.spending-table {
  width: 100%;
  border-collapse: collapse;
  margin: 20px 0;
  table-layout: auto;
}

.spending-table th,
.spending-table td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left; /* Default for td */
}

.spending-table th {
  background-color: #521a1a;
  color: white;
}

/* Column-specific Styles */
.party-column {
  width: auto; 
  min-width: 50px;
  max-width: 250px;
  white-space: nowrap; /* Prevent text wrapping */
  text-overflow: ellipsis; /* Add ellipsis for overflow */
  overflow: hidden; /* Hide overflowed content */
}

.fixed-width {
  width: 70px; /* For Date column */
}

.fixed-width.right-align {
  width: 120px; /* For Amount column */
  text-align: right;
}

.centered {
  text-align: center;
}

/* Sticky column */
.sticky-column {
  position: sticky;
  left: 0;
  background-color: #f9f9f9;
  z-index: 2;
}

/* Positive/Negative Amount Colors */
.positive-amount {
  color: green;
}

.negative-amount {
  color: red;
}

/* Prevent text from wrapping in Party and Id columns */
.spending-table td {
  white-space: nowrap;
}

/* Hide the "Id" column */
.spending-table th:last-child,
.spending-table td:last-child {
  display: none; /* Hide the last column (Id) */
}

</style>