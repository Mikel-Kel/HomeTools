import { ref, computed } from "vue";

import {
  listFiles,
  loadJSONFromFolder,
  saveJSONToFolder,
  deleteFileFromFolder
} from "@/services/driveAdapter";

export interface Allocation {
  id: string;
  categoryID: number | null;
  subCategoryID: number | null;
  comment: string;
  amount: number;
  allocationDate: string | null;
  allocatedTagID: number | null;
}

type AllocationState =
  | "EMPTY"
  | "EDITING"
  | "BALANCED"
  | "READONLY"
  | "BUSY";

const loading = ref(true);

/* =========================
   Helpers
========================= */

async function findFileByName(folderId: string, filename: string) {
  const files = await listFiles(folderId);
  return files.find(f => f.name === filename) ?? null;
}

/* =========================
   Composable
========================= */

export function useAllocation(
  spendingId: string,
  spendingAmount: number,
  partyID: number | null,
  spendingDate: string
) {
  let chain = Promise.resolve();

  function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const next = chain.then(fn, fn);

    chain = next.then(
      () => undefined,
      () => undefined
    ) as Promise<void>;

    return next;
  }

  /* =========================
     State
  ========================= */

  const state = ref<AllocationState>("EMPTY");

  const busy = ref(false);
  const busyAction = ref<"load" | "save" | null>(null);

  /* =========================
     Domain
  ========================= */

  const allocations = ref<Allocation[]>([]);

  const categoryID = ref<number | null>(null);
  const subCategoryID = ref<number | null>(null);
  const comment = ref("");

  const amount = ref(Math.abs(spendingAmount));
  const allocationDate = ref<string | null>(null);
  const allocatedTagID = ref<number | null>(null);

  const lastSavedSnapshot = ref<string>("[]");

  /* =========================
     Computed
  ========================= */

  const totalToAllocate = computed(() =>
    Math.abs(spendingAmount)
  );

  const totalAllocated = computed(() =>
    Number(
      allocations.value
        .reduce((s, a) => s + Number(a.amount || 0), 0)
        .toFixed(2)
    )
  );

  const remainingAmount = computed(() =>
    Number(
      (totalToAllocate.value - totalAllocated.value)
        .toFixed(2)
    )
  );

  const isBalanced = computed(() =>
    remainingAmount.value === 0
  );

  /* =========================
     UI flags
  ========================= */

  const hasDraft = computed(() =>
    allocations.value.length > 0
  );

  const canSaveDraft = computed(() =>
    hasDraft.value &&
    state.value !== "READONLY" &&
    state.value !== "BUSY"
  );

  const canRelease = computed(() =>
    hasDraft.value &&
    isBalanced.value &&
    state.value !== "READONLY" &&
    state.value !== "BUSY"
  );

  /* =========================
     State recomputation
  ========================= */

  function recomputeLocalState() {
    if (state.value === "READONLY") return;

    if (allocations.value.length === 0) {
      state.value = "EMPTY";
      return;
    }

    state.value =
      isBalanced.value
        ? "BALANCED"
        : "EDITING";
  }

  const hasUnsavedChanges = computed(() =>
    buildSnapshot() !== lastSavedSnapshot.value
  );

  /* =========================
     Draft persistence
  ========================= */

  async function deleteDraftFileIfExists() {
    await deleteFileFromFolder(
      "allocations/drafts",
      `${spendingId}.json`
    );
  }

  async function saveDraftInternal() {
    await saveJSONToFolder(
      "allocations/drafts",
      `${spendingId}.json`,
      {
        version: 1,
        spendingId,
        processed: false,
        toProcess: isBalanced.value,
        partyID: partyID ?? null,
        savedAt: new Date().toISOString(),
        allocations: allocations.value
      }
    );
    lastSavedSnapshot.value = buildSnapshot();
  }

  /* =========================
     Load
  ========================= */

  async function loadDraft() {
    loading.value = true;

    return runExclusive(async () => {
      busy.value = true;
      busyAction.value = "load";

      try {
        const filename = `${spendingId}.json`;

        const draftFile =
          await findFileByName("allocations/drafts", filename);

        if (draftFile) {
          const raw =
            await loadJSONFromFolder<any>(
              "allocations/drafts",
              filename
            );

          allocations.value =
            Array.isArray(raw?.allocations)
              ? raw.allocations.map((a: any) => ({
                  id: crypto.randomUUID(),
                  categoryID: a.categoryID ?? null,
                  subCategoryID: a.subCategoryID ?? null,
                  comment: a.comment ?? "",
                  amount: Number(Number(a.amount).toFixed(2)),
                  allocationDate: a.allocationDate ?? null,
                  allocatedTagID: a.allocatedTagID ?? null
                }))
              : [];

          recomputeLocalState();
          presetAmount();
          lastSavedSnapshot.value = buildSnapshot();
          return;
        }

        const releasedFile =
          await findFileByName("allocations/released", filename);

        if (releasedFile) {
          const raw =
            await loadJSONFromFolder<any>(
              "allocations/released",
              filename
            );

          allocations.value =
            Array.isArray(raw?.allocations)
              ? raw.allocations.map((a: any) => ({
                  id: crypto.randomUUID(),
                  categoryID: a.categoryID ?? null,
                  subCategoryID: a.subCategoryID ?? null,
                  comment: a.comment ?? "",
                  amount: Number(Number(a.amount).toFixed(2)),
                  allocationDate: a.allocationDate ?? null,
                  allocatedTagID: a.allocatedTagID ?? null
                }))
              : [];

          state.value = "READONLY";
          presetAmount();
          return;
        }

        allocations.value = [];
        recomputeLocalState();
      }

      finally {
        busy.value = false;
        busyAction.value = null;
        loading.value = false;
      }
    });
  }

  /* =========================
     Mutations
  ========================= */

  async function addAllocation() {
    return runExclusive(async () => {
      if (!categoryID.value || !subCategoryID.value) return;
      if (!Number.isFinite(amount.value) || amount.value === 0) return;

      allocations.value.push({
        id: crypto.randomUUID(),
        categoryID: categoryID.value,
        subCategoryID: subCategoryID.value,
        comment: comment.value.trim() || "Please comment",
        amount: Number(amount.value.toFixed(2)),
        allocationDate:
          allocationDate.value?.trim() || spendingDate,
        allocatedTagID: allocatedTagID.value
      });

      resetForm();
      recomputeLocalState();

      if (isBalanced.value) {
        busy.value = true;
        busyAction.value = "save";
        state.value = "BUSY";

        try {
          await saveDraftInternal();
        } finally {
          busy.value = false;
          busyAction.value = null;
          recomputeLocalState();
        }
      }
    });
  }

  async function removeAllocation(index: number) {
    return runExclusive(async () => {
      if (
        index < 0 ||
        index >= allocations.value.length
      ) return;

      allocations.value.splice(index, 1);

      presetAmount();
      recomputeLocalState();
    });
  }

  async function saveDraft() {
    return runExclusive(async () => {
      if (!canSaveDraft.value) return;

      busy.value = true;
      busyAction.value = "save";
      state.value = "BUSY";

      try {
        await saveDraftInternal();
      } finally {
        busy.value = false;
        busyAction.value = null;
        recomputeLocalState();
      }
    });
  }

  /* =========================
     Helpers
  ========================= */

  function presetAmount() {
    amount.value =
      Number(
        Math.abs(remainingAmount.value).toFixed(2)
      );
  }

  function buildSnapshot() {
    return JSON.stringify(
      allocations.value.map(a => ({
        categoryID: a.categoryID,
        subCategoryID: a.subCategoryID,
        comment: a.comment,
        amount: a.amount,
        allocationDate: a.allocationDate,
        allocatedTagID: a.allocatedTagID
      }))
    );
  }

  function resetForm() {
    categoryID.value = null;
    subCategoryID.value = null;
    comment.value = "";
    allocationDate.value = null;
    allocatedTagID.value = null;

    presetAmount();
  }

  /* =========================
     API
  ========================= */

  return {
    state,

    allocations,

    categoryID,
    subCategoryID,
    comment,
    amount,
    allocationDate,
    allocatedTagID,

    totalAllocated,
    remainingAmount,
    isBalanced,

    hasDraft,
    canSaveDraft,
    canRelease,
    hasUnsavedChanges,

    loading,
    busy,
    busyAction,

    loadDraft,
    addAllocation,
    removeAllocation,
    saveDraft
  };
}