import { ref, computed } from "vue";
import { useDrive } from "@/composables/useDrive";
import {
  writeJSON,
  listFilesInFolder,
  type DriveItem,
} from "@/services/google/googleDrive";

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
  const { driveState } = useDrive();

  /* =========================
     State
  ========================= */
  const allocations = ref<Allocation[]>([]);

  const categoryID = ref<number | null>(null);
  const subCategoryID = ref<number | null>(null);
  const comment = ref<string>("");

  // montant saisi (toujours positif côté UI)
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
    Number(remainingAmount.value.toFixed(2)) === 0
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

    allocations.value.push({
      id: crypto.randomUUID(),
      categoryID: categoryID.value,
      subCategoryID: subCategoryID.value,
      comment:
        comment.value.trim() || "No comment typed by user",
      amount: Number(signedAmount.toFixed(2)),
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
    amount.value = Number(
      Math.abs(remainingAmount.value).toFixed(2)
    );
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
  async function saveDraft(): Promise<void> {
    if (!driveState.value) return;

    const folderId =
      driveState.value.folders.allocations.drafts;
    if (!folderId) {
      throw new Error("allocations/drafts folder not found");
    }

    // 🔍 vérifier si le fichier existe déjà
    const files = await listFilesInFolder(folderId);
    const existing = files.find(
      (f: DriveItem) =>
        f.name === `${spendingId}.json`
    );

    const payload = {
      version: 1,
      spendingId,
      savedAt: new Date().toISOString(),
      allocations: allocations.value.map(a => ({
        categoryID: a.categoryID,
        subCategoryID: a.subCategoryID,
        amount: Number(a.amount.toFixed(2)),
        comment: a.comment,
      })),
    };

    await writeJSON(
      folderId,
      `${spendingId}.json`,
      payload,
      existing?.id
    );
  }

  async function release(): Promise<void> {
    if (!isBalanced.value) return;
    if (!driveState.value) return;

    const folderId =
      driveState.value.folders.allocations.released;
    if (!folderId) {
      throw new Error("allocations/released folder not found");
    }

    const payload = {
      version: 1,
      spendingId,
      spendingAmount: Number(spendingAmount.toFixed(2)),
      currency: "CHF",
      releasedAt: new Date().toISOString(),
      allocations: allocations.value,
    };

    await writeJSON(
      folderId,
      `${spendingId}.json`,
      payload
    );
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