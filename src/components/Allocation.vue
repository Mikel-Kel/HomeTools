<template>
  <div>
    <Title text="Allocation" icon="shopping_cart.png" />

    <!-- Display Spending Record Details -->
    <div class="record-details">
      <p><strong>Date:</strong> {{ parsedRecord.date }}</p>
      <p><strong>Party:</strong> {{ parsedRecord.party }}</p>
      <p><strong>Amount:</strong> {{ formatAmount(parsedRecord.amount) }}</p>
    </div>


    <!-- Allocation Table -->
    <table class="allocation-table">
      <thead>
        <tr>
          <th>Category</th>
          <th>Sub-category</th>
          <th>Payee</th>
          <th>Comment</th>
          <th>Amount</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(allocation, index) in allocations" :key="index">
          <td>
            <select v-model="allocation.categoryID" @change="allocation.categoryID !== null && updateSubCategories(allocation.categoryID, index)">
              <option value="" disabled>Select Category</option>
              <option v-for="category in categories" :key="category.CategoryID" :value="category.CategoryID">
                {{ category.CategoryDesc }}
              </option>
            </select>
          </td>
          <td>
            <select v-model="allocation.subCategoryID">
              <option value="" disabled>Select Sub-category</option>
              <option
                v-for="subCategory in filteredSubCategories[index] || []"
                :key="subCategory.SubCategoryID"
                :value="subCategory.SubCategoryID"
              >
                {{ subCategory.SubCategoryDesc }}
              </option>
            </select>
          </td>
          <td>
            <select v-model="allocation.payeeID">
              <option value="" disabled>Select Payee</option>
              <option v-for="payee in payees" :key="payee.PartyID" :value="payee.PartyID">
                {{ payee.PartyName }}
              </option>
            </select>
          </td>
          <td>
            <input type="text" v-model="allocation.comment" placeholder="Comment" />
          </td>
          <td>
            <input type="number" v-model="allocation.amount" placeholder="Amount" />
          </td>
          <td>
            <button @click="removeAllocation(index)">Delete</button>
          </td>
        </tr>
      </tbody>
    </table>

    <button @click="addAllocation">Add Allocation</button>

    <!-- Summary and Save Button -->
    <div class="allocation-summary">
      <p><strong>Total Allocated:</strong> {{ formatAmount(totalAllocated) }}</p>
      <button :disabled="!parsedRecord || totalAllocated !== parsedRecord.amount" @click="saveAllocations">Save Allocations</button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType, ref, onMounted, reactive, computed } from 'vue';
import Title from './Title.vue';
import axios from 'axios';

export default defineComponent({
  name: 'Allocation',
  components: {
    Title,
  },
  props: {
    record: {
      type: String as PropType<string>, // Expecting the record as a string
      required: true,
    },
  },
  computed: {
    parsedRecord(): any {
      return typeof this.record === 'string' ? JSON.parse(this.record) : this.record;
    },
  },

  setup(props) {
    // Allocation Data Structures
    interface Allocation {
      categoryID: number | null;
      subCategoryID: number | null;
      payeeID: number | null;
      comment: string;
      amount: number;
    }

    interface Category {
      CategoryID: number;
      CategoryDesc: string;
      SeqNb: number;
    }

    interface SubCategory {
      SubCategoryID: number;
      SubCategoryDesc: string;
      CategoryID: number;
      SeqNb: number;
      Status: string;
    }

    interface Payee {
      PartyID: number;
      PartyName: string;
      PartySeq: number;
    }

    // Reactive States
    const allocations = ref<Allocation[]>([]);
    const categories = ref<Category[]>([]);
    const subCategories = ref<SubCategory[]>([]);
    const filteredSubCategories = reactive<{ [key: number]: SubCategory[] }>({});
    const payees = ref<Payee[]>([]);

    // Fetch Data from Backend
    const fetchCategories = async () => {
      try {
        const response = await axios.get('http://localhost:3000/api/categories');
        categories.value = response.data.sort((a: Category, b: Category) => a.SeqNb - b.SeqNb);
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };

    const fetchSubCategories = async () => {
      try {
        const response = await axios.get('http://localhost:3000/api/subcategories');
        subCategories.value = response.data.sort((a: SubCategory, b: SubCategory) => a.SeqNb - b.SeqNb);
      } catch (error) {
        console.error('Error fetching subcategories:', error);
      }
    };

    const fetchPayees = async () => {
      try {
        const response = await axios.get('http://localhost:3000/api/payees');
        payees.value = response.data.sort((a: Payee, b: Payee) => a.PartySeq - b.PartySeq);
      } catch (error) {
        console.error('Error fetching payees:', error);
      }
    };

    // Update Sub-categories Based on Selected Category
    const updateSubCategories = (categoryID: number, index: number) => {
      filteredSubCategories[index] = subCategories.value.filter(
        (sub) => sub.CategoryID === categoryID && sub.Status === 'A'
      );
    };

    // Add or Remove Allocations
    const addAllocation = () => {
      allocations.value.push({
        categoryID: null,
        subCategoryID: null,
        payeeID: null,
        comment: '',
        amount: 0,
      });
    };

    const removeAllocation = (index: number) => {
      allocations.value.splice(index, 1);
    };

    // Calculate Total Allocated
    const totalAllocated = computed(() =>
      allocations.value.reduce((sum, alloc) => sum + (alloc.amount || 0), 0)
    );

    // Save Allocations
    const saveAllocations = async () => {
      try {
        const payload = {
          record: props.record,
          allocations: allocations.value,
        };
        await axios.post('http://localhost:3000/api/saveAllocations', payload);
        alert('Allocations saved successfully!');
      } catch (error) {
        console.error('Error saving allocations:', error);
      }
    };

    // Fetch Data on Mount
    onMounted(() => {
      fetchCategories();
      fetchSubCategories();
      fetchPayees();
    });

    return {
      categories,
      subCategories,
      filteredSubCategories,
      payees,
      allocations,
      addAllocation,
      removeAllocation,
      updateSubCategories,
      totalAllocated,
      saveAllocations,
      formatAmount: (amount: number) =>
        amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    };
  },
});
</script>

<style scoped>
.record-details {
  margin-bottom: 20px;
  background: #f5f5f5;
  padding: 10px;
  border-radius: 5px;
}

.allocation-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 20px;
}

.allocation-table th,
.allocation-table td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
}

.allocation-summary {
  margin-top: 20px;
  text-align: right;
}
</style>