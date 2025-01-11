<template>
  <div>
    <Title text="Allocation" icon="shopping_cart.png" />

    <!-- Display Spending Record Details -->
    <div class="record-details" :class="recordBackgroundClass">
      <p><strong>Date:</strong> {{ parsedRecord.date }}</p>
      <p><strong>Party:</strong> {{ parsedRecord.party }}</p>
      <p><strong>Amount:</strong> {{ formatAmount(absoluteAmount) }}</p>
    </div>

    <!-- Allocation Form -->
    <div class="allocation-form">
      <h3>Add Allocation</h3>
      <div class="form-group">
        <label for="category">Category</label>
        <select id="category" v-model="newAllocation.categoryID" @change="newAllocation.categoryID !== null && updateSubCategories(newAllocation.categoryID, -1)">
          <option value="" disabled>Select Category</option>
          <option v-for="category in categories" :key="category.CategoryID" :value="category.CategoryID">
            {{ category.CategoryDesc }}
          </option>
        </select>
      </div>
      <div class="form-group">
        <label for="subCategory">Sub-category</label>
        <select id="subCategory" v-model="newAllocation.subCategoryID" :disabled="!newAllocation.categoryID">
          <option value="" disabled>Select Sub-category</option>
          <option v-for="subCategory in newAllocation.filteredSubCategories" :key="subCategory.SubCategoryID" :value="subCategory.SubCategoryID">
            {{ subCategory.SubCategoryDesc }}
          </option>
        </select>
      </div>
      <div class="form-group">
        <label for="payee">Payee</label>
        <select id="payee" v-model="newAllocation.payeeID">
          <option value="" disabled>Select Payee</option>
          <option v-for="payee in payees" :key="payee.PartyID" :value="payee.PartyID">
            {{ payee.PartyName }}
          </option>
        </select>
      </div>
      <div class="form-group">
        <label for="comment">Comment</label>
        <input type="text" id="comment" v-model="newAllocation.comment" placeholder="Comment" />
      </div>
      <div class="form-group">
        <label for="amount">Amount</label>
        <input type="number" id="amount" v-model="newAllocation.amount" placeholder="Amount" />
      </div>
      <button @click="addAllocation">Add Allocation</button>
    </div>

    <!-- Allocation List -->
    <div class="allocation-list">
      <h3>Allocations</h3>
      <table class="allocation-table">
        <thead>
          <tr>
            <th>Sub-category</th>
            <th>Comment</th>
            <th>Amount</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(allocation, index) in allocations" :key="index">
            <td>{{ getSubCategoryDesc(allocation.subCategoryID) }}</td>
            <td>{{ allocation.comment }}</td>
            <td>{{ formatAmount(allocation.amount) }}</td>
            <td><button @click="removeAllocation(index)">Delete</button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Summary and Save Button -->
    <div class="allocation-summary">
      <p><strong>Total Allocated:</strong> {{ formatAmount(totalAllocated) }}</p>
      <button :disabled="!parsedRecord || totalAllocated !== parsedRecord.amount" @click="saveAllocations">Save Allocations</button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType, ref, onMounted, computed } from 'vue';
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
    recordBackgroundClass(): string {
      return this.parsedRecord.amount < 0 ? 'negative-amount' : 'positive-amount';
    },
    absoluteAmount(): number {
      return Math.abs(this.parsedRecord.amount);
    },
    totalAllocated(): number {
      return this.allocations.reduce((sum, alloc) => sum + (alloc.amount || 0), 0);
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
      filteredSubCategories: SubCategory[];
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
    const payees = ref<Payee[]>([]);
    const newAllocation = ref<Allocation>({
      categoryID: null,
      subCategoryID: null,
      payeeID: null,
      comment: '',
      amount: 0,
      filteredSubCategories: [],
    });

    // Fetch Data from Backend
    const fetchCategories = async () => {
      try {
        const response = await axios.get('http://localhost:3000/api/categories');
        categories.value = response.data.sort((a: Category, b: Category) => a.SeqNb - b.SeqNb);
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };

    // Fetch Sub-categories (mocked or backend)
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
    const updateSubCategories = async (categoryID: number, index: number) => {
      if (!categoryID) {
        if (index === -1) {
          newAllocation.value.filteredSubCategories = [];
        } else {
          allocations.value[index].filteredSubCategories = [];
        }
        return;
      }

      try {
        const response = await axios.get(`http://localhost:3000/api/subcategories?categoryID=${categoryID}`);
        if (index === -1) {
          newAllocation.value.filteredSubCategories = response.data;
        } else {
          allocations.value[index].filteredSubCategories = response.data;
        }
      } catch (error) {
        console.error("Error fetching filtered subcategories:", error);
      }
    };

    // Add or Remove Allocations
    const addAllocation = () => {
      allocations.value.push({ ...newAllocation.value });
      newAllocation.value = {
        categoryID: null,
        subCategoryID: null,
        payeeID: null,
        comment: '',
        amount: 0,
        filteredSubCategories: [],
      };
    };

    const removeAllocation = (index: number) => {
      allocations.value.splice(index, 1);
    };

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
      payees,
      allocations,
      newAllocation,
      addAllocation,
      removeAllocation,
      updateSubCategories,
      saveAllocations,
      formatAmount: (amount: number) =>
        amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      getSubCategoryDesc: (subCategoryID: number | null) => {
        const subCategory = subCategories.value.find(sub => sub.SubCategoryID === subCategoryID);
        return subCategory ? subCategory.SubCategoryDesc : '';
      },
    };
  },
});
</script>

<style scoped>
.record-details {
  margin-bottom: 20px;
  padding: 10px;
  border-radius: 5px;
}

.negative-amount {
  background-color: rgb(243, 214, 214);
}

.positive-amount {
  background-color: rgb(211, 246, 211);
}

.allocation-form {
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 10px;
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