// src/composables/useAllocation.ts
import { ref, computed } from 'vue';
import { useEvents } from '@/composables/useEvents';
/* =========================
   Composable
========================= */
/**
 * useAllocation
 *
 * @param recordId        ID logique du spending record
 * @param expectedAmount Montant à répartir (peut être négatif)
 */
export function useAllocation(recordId, expectedAmount) {
    const { emit } = useEvents();
    /* =========================
       State
    ========================= */
    const allocations = ref([]);
    const categoryID = ref(null);
    const subCategoryID = ref(null);
    const payeeID = ref(null);
    const comment = ref('');
    const amount = ref(0);
    /* =========================
       Reference data (mock)
       → remplacé plus tard par replay / snapshot
    ========================= */
    const categories = ref([
        { id: 1, label: 'Housing' },
        { id: 2, label: 'Food' },
    ]);
    const subCategories = ref([
        { id: 10, label: 'Rent', categoryID: 1 },
        { id: 11, label: 'Electricity', categoryID: 1 },
        { id: 20, label: 'Groceries', categoryID: 2 },
    ]);
    const payees = ref([
        { id: 1, label: 'Migros' },
        { id: 2, label: 'Landlord' },
    ]);
    /* =========================
       Computed
    ========================= */
    const filteredSubCategories = computed(() => categoryID.value
        ? subCategories.value.filter(sc => sc.categoryID === categoryID.value)
        : []);
    const totalAllocated = computed(() => allocations.value.reduce((sum, a) => sum + a.amount, 0));
    const isBalanced = computed(() => totalAllocated.value === expectedAmount);
    /* =========================
       Actions (EVENT-DRIVEN)
    ========================= */
    /**
     * Propose a new allocation
     */
    function addAllocation() {
        const signedAmount = expectedAmount < 0
            ? -Math.abs(amount.value)
            : Math.abs(amount.value);
        emit({
            type: 'AllocationProposed',
            payload: {
                recordId,
                allocation: {
                    categoryID: categoryID.value,
                    subCategoryID: subCategoryID.value,
                    payeeID: payeeID.value,
                    comment: comment.value,
                    amount: signedAmount,
                },
            },
        });
        allocations.value.push({
            categoryID: categoryID.value,
            subCategoryID: subCategoryID.value,
            payeeID: payeeID.value,
            comment: comment.value,
            amount: signedAmount,
        });
        resetForm();
    }
    /**
     * Remove an allocation by index
     */
    function removeAllocation(index) {
        emit({
            type: 'AllocationRemoved',
            payload: {
                recordId,
                index,
            },
        });
        allocations.value.splice(index, 1);
    }
    /**
     * Final save intent
     */
    function save() {
        emit({
            type: 'AllocationSaved',
            payload: {
                recordId,
            },
        });
    }
    /* =========================
       Helpers
    ========================= */
    function resetForm() {
        categoryID.value = null;
        subCategoryID.value = null;
        payeeID.value = null;
        comment.value = '';
        amount.value = 0;
    }
    /* =========================
       Public API
    ========================= */
    return {
        // state
        allocations,
        categories,
        subCategories,
        payees,
        categoryID,
        subCategoryID,
        payeeID,
        comment,
        amount,
        // computed
        filteredSubCategories,
        totalAllocated,
        isBalanced,
        // actions
        addAllocation,
        removeAllocation,
        save,
    };
}
