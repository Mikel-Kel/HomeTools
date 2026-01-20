// src/composables/useAllocation.ts
import { ref, computed } from "vue";
import { useDrive } from "@/composables/useDrive";
import { writeJSON } from "@/services/google/googleDrive";

/* =========================
   Types
========================= */
export interface Allocation {
  categoryID: number | null;
  subCategoryID: number | null;
  comment: string;
  amount: number;
}

/* =========================
   Composable
========================= */
export function useAllocation(
  spendingId: string,
  expectedAmount: number
) {
  /* =========================
     State
  ========================= */
  const allocations = ref<Allocation[]>([]);

  const categoryID = ref<number | null>(null);
  const subCategoryID = ref<number | null>(null);
  const comment = ref("");
  const amount = ref(0);

  /* =========================
     Computed
  ========================= */
  const totalAllocated = computed(() =>
    allocations.value.reduce((sum, a) => sum + a.amount, 0)
  );

  const isBalanced = computed(() =>
    totalAllocated.value === expectedAmount
  );

  /* =========================
     Actions
  ========================= */
  function addAllocation() {
    const signedAmount =
      expectedAmount < 0
        ? -Math.abs(amount.value)
        : Math.abs(amount.value);

    allocations.value.push({
      categoryID: categoryID.value,
      subCategoryID: subCategoryID.value,
      comment: comment.value,
      amount: signedAmount,
    });

    resetForm();
  }

  function removeAllocation(index: number) {
    allocations.value.splice(index, 1);
  }

  async function saveDraft() {
    const { driveState } = useDrive();
    if (!driveState.value) return;

    await writeJSON(
      driveState.value.folders.allocations.drafts,
      `${spendingId}.json`,
      buildPayload("draft")
    );
  }

  async function release() {
    if (!isBalanced.value) return;

    const { driveState } = useDrive();
    if (!driveState.value) return;

    await writeJSON(
      driveState.value.folders.allocations.released,
      `${spendingId}.json`,
      buildPayload("released")
    );
  }

  /* =========================
     Helpers
  ========================= */
  function buildPayload(status: "draft" | "released") {
    return {
      version: 1,
      status,
      spendingId,
      spendingAmount: expectedAmount,
      currency: "CHF",
      updatedAt: new Date().toISOString(),
      allocations: allocations.value,
    };
  }

  function resetForm() {
    categoryID.value = null;
    subCategoryID.value = null;
    comment.value = "";
    amount.value = 0;
  }

  /* =========================
     Public API
  ========================= */
  return {
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
  };
}