import { ref, computed } from "vue";

import {
  listFiles,
  loadJSONFromFolder,
  saveJSONToFolder,
  deleteFileFromFolder
} from "@/services/driveAdapter";

import { useDrive } from "@/composables/useDrive";

/* =========================
   Types
========================= */

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
  | "DRAFTED"
  | "READONLY"
  | "BUSY";

const loading = ref(true);

/* =========================
   Helpers
========================= */

async function findFileByName(folderId: string, filename: string) {

  const files = await listFiles(folderId);

  const found = files.find(f => f.name === filename) ?? null;

  return found;

}

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
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

  /* =========================
     Mutex
  ========================= */

  let chain = Promise.resolve();

  function runExclusive<T>(fn: () => Promise<T>): Promise<T> {

    const next = chain.then(fn, fn);

    chain = next.then(
      () => undefined,
      () => undefined
    ) as unknown as Promise<void>;

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
  const comment = ref<string>("");

  const amount = ref<number>(Math.abs(spendingAmount));
  const allocationDate = ref<string | null>(null);
  const allocatedTagID = ref<number | null>(null);

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
    state.value === "DRAFTED"
  );

  const canSaveDraft = computed(() =>
    state.value === "BALANCED"
  );

  const canRelease = computed(() =>
    state.value === "DRAFTED"
  );

  /* =========================
     State recomputation
  ========================= */

  function recomputeLocalState(base?: AllocationState) {

    const current = base ?? state.value;

    if (current === "DRAFTED") return;

    if (allocations.value.length === 0) {
      state.value = "EMPTY";
      return;
    }

    state.value =
      isBalanced.value
        ? "BALANCED"
        : "EDITING";

  }

  /* =========================
     Draft helpers
  ========================= */

  async function deleteDraftFileIfExists(): Promise<void> {

    const folder =
      "allocations/drafts";

    const filename = `${spendingId}.json`;

    await deleteFileFromFolder(
      folder,
      filename
    );

  }

  async function saveDraftInternal(): Promise<void> {

    const draftsFolder =
      "allocations/drafts";

    const filename = `${spendingId}.json`;

    await saveJSONToFolder(
      draftsFolder,
      filename,
      {
        version: 1,
        spendingId,
        processed: false,
        partyID: partyID ?? null,
        savedAt: new Date().toISOString(),
        allocations: allocations.value
      }
    );

  }

  /* =========================
     Load
  ========================= */

  async function loadDraft(): Promise<void> {

    loading.value = true;

    return runExclusive(async () => {

      busy.value = true;
      busyAction.value = "load";

      try {

        const draftsFolder =
          "allocations/drafts";

        const releasedFolder =
          "allocations/released";

        const filename =
          `${spendingId}.json`;

        /* ===== DRAFT ===== */

        const draftFile =
          await findFileByName(
            draftsFolder,
            filename
          );

        if (draftFile) {

          const raw =
            await loadJSONFromFolder<any>(
              draftsFolder,
              filename
            );

          if (!Array.isArray(raw?.allocations)) {

            allocations.value = [];
            state.value = "EMPTY";
            recomputeLocalState();

            return;

          }

          allocations.value =
            raw.allocations.map((a: any) => ({

              id: crypto.randomUUID(),

              categoryID:
                a.categoryID ?? null,

              subCategoryID:
                a.subCategoryID ?? null,

              comment:
                a.comment ?? "",

              amount:
                Number(
                  Number(a.amount)
                  .toFixed(2)
                ),

              allocationDate:
                a.allocationDate ?? null,

              allocatedTagID:
                a.allocatedTagID ?? null

            }));

          state.value = "DRAFTED";

          presetAmount();

          return;

        }

        /* ===== RELEASED ===== */

        const releasedFile =
          await findFileByName(
            releasedFolder,
            filename
          );

        if (releasedFile) {

          const raw =
            await loadJSONFromFolder<any>(
              releasedFolder,
              filename
            );

          if (!Array.isArray(raw?.allocations)) {

            allocations.value = [];
            state.value = "EMPTY";
            recomputeLocalState();

            return;

          }

          allocations.value =
            raw.allocations.map((a: any) => ({

              id: crypto.randomUUID(),

              categoryID:
                a.categoryID ?? null,

              subCategoryID:
                a.subCategoryID ?? null,

              comment:
                a.comment ?? "",

              amount:
                Number(
                  Number(a.amount)
                  .toFixed(2)
                ),

              allocationDate:
                a.allocationDate ?? null,

              allocatedTagID:
                a.allocatedTagID ?? null

            }));

          state.value = "READONLY";

          presetAmount();

          return;

        }

        /* ===== EMPTY ===== */

        allocations.value = [];
        state.value = "EMPTY";

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
     Add allocation
  ========================= */

  async function addAllocation(): Promise<void> {

    return runExclusive(async () => {

      if (!categoryID.value ||
          !subCategoryID.value) return;

      if (!Number.isFinite(amount.value) ||
          amount.value === 0) return;

      const normalizedDate =
        allocationDate.value &&
        allocationDate.value.trim() !== ""
          ? allocationDate.value
          : spendingDate;

      const typed =
        Number(amount.value.toFixed(2));

      allocations.value.push({

        id: crypto.randomUUID(),

        categoryID:
          categoryID.value,

        subCategoryID:
          subCategoryID.value,

        comment:
          comment.value.trim() ||
          "Please comment",

        amount: typed,

        allocationDate:
          normalizedDate,

        allocatedTagID: 
          allocatedTagID.value

      });

      resetForm();

      if (state.value === "DRAFTED") {

        await deleteDraftFileIfExists();

        state.value = "EDITING";

      }

      else {

        recomputeLocalState();

      }

      if (state.value === "BALANCED") {

        busy.value = true;
        busyAction.value = "save";
        state.value = "BUSY";

        try {

          await saveDraftInternal();

          state.value = "DRAFTED";

        }

        finally {

          busyAction.value = null;
          busy.value = false;

        }

      }

    });

  }

  /* =========================
     Remove allocation
  ========================= */

  async function removeAllocation(
    index: number
  ): Promise<void> {

    return runExclusive(async () => {

      if (index < 0 ||
          index >= allocations.value.length)
        return;

      allocations.value.splice(index, 1);

      presetAmount();

      const wasDrafted =
        state.value === "DRAFTED";

      if (wasDrafted) {

        busy.value = true;

        try {

          await deleteDraftFileIfExists();

        }

        finally {

          busy.value = false;

        }

      }

      state.value =
        isBalanced.value
          ? "BALANCED"
          : "EDITING";

    });

  }

  /* =========================
     Save draft
  ========================= */

  async function saveDraft(): Promise<void> {

    return runExclusive(async () => {

      if (state.value !== "BALANCED")
        return;

      busy.value = true;
      busyAction.value = "save";
      state.value = "BUSY";

      try {

        await saveDraftInternal();

        state.value = "DRAFTED";

      }

      finally {

        busy.value = false;
        busyAction.value = null;

      }

    });

  }

  /* =========================
     Form helpers
  ========================= */

  function presetAmount() {

    amount.value =
      Number(
        Math.abs(
          remainingAmount.value
        ).toFixed(2)
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

    canSaveDraft,
    canRelease,
    hasDraft,

    loading,
    busy,
    busyAction,

    loadDraft,
    addAllocation,
    removeAllocation,
    saveDraft

  };

}