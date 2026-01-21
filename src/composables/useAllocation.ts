import { ref, computed } from "vue";
import { useDrive } from "@/composables/useDrive";
import { writeJSON } from "@/services/google/googleDrive";

/* =========================
   Types
========================= */
export interface Allocation {
  id: string;
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
  spendingAmount: number
) {
  /* =========================
     State
  ========================= */
  const allocations = ref<Allocation[]>([]);

  const categoryID = ref<number | null>(null);
  const subCategoryID = ref<number | null>(null);
  const comment = ref<string>("");

  // champ saisi par l’utilisateur
  const amount = ref<number>(Math.abs(spendingAmount));

  /* =========================
     Computed
  ========================= */
  const totalAllocated = computed(() =>
    allocations.value.reduce((sum, a) => sum + a.amount, 0)
  );

  const remainingAmount = computed(() =>
    spendingAmount - totalAllocated.value
  );

  const isBalanced = computed(() =>
    remainingAmount.value === 0
  );

  /* =========================
     Actions
  ========================= */
  function addAllocation() {
    if (!categoryID.value || !subCategoryID.value) return;
    if (!Number.isFinite(amount.value) || amount.value === 0) return;

    const signedAmount =
      spendingAmount < 0
        ? -Math.abs(amount.value)
        : Math.abs(amount.value);

    const finalComment =
      comment.value.trim().length > 0
        ? comment.value.trim()
        : "No comment typed by user";

    allocations.value.push({
      id: crypto.randomUUID(),
      categoryID: categoryID.value,
      subCategoryID: subCategoryID.value,
      comment: finalComment,
      amount: signedAmount,
    });

    resetForm();
  }

  function removeAllocation(index: number) {
    allocations.value.splice(index, 1);
    presetAmount();
  }

  /* =========================
     Helpers
  ========================= */
  function presetAmount() {
    amount.value = Math.abs(remainingAmount.value);
  }

  function resetForm() {
    categoryID.value = null;
    subCategoryID.value = null;
    comment.value = "";
    presetAmount();
  }

  /* =========================
     Drive persistence
  ========================= */
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

  function buildPayload(status: "draft" | "released") {
    return {
      version: 1,
      status,
      spendingId,
      spendingAmount,
      currency: "CHF",
      updatedAt: new Date().toISOString(),
      allocations: allocations.value,
    };
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
    remainingAmount,
    isBalanced,

    addAllocation,
    removeAllocation,
    saveDraft,
    release,
  };
}