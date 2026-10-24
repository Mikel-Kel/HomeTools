import { ref, computed } from "vue";

import {
  deleteFileFromFolder,
  listFiles,
  loadJSONFromFolder,
  saveJSONToFolder
} from "@/services/driveAdapter";

import {
  useStorageBackend
} from "@/composables/useStorageBackend";

import {
  publishS3StoragePullRequest
} from "@/services/s3/s3StorageAdapter";

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

/*
  Commentaire attribué à une allocation saisie sans
  commentaire.
*/
const DEFAULT_COMMENT = "Please comment";

const DRAFTS_FOLDER = "allocations/drafts";

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

  /*
    Allocation dont les valeurs ont été reprises dans le
    formulaire pour être modifiée.
  */
  const editingAllocationId = ref<string | null>(null);

  /*
    Un draft existe sur le stockage pour ce mouvement.
  */
  const draftExists = ref(false);

  /*
    Échec de la dernière sauvegarde automatique.
  */
  const saveError = ref<string | null>(null);

  const draftMode = ref<"INSERT" | "UPDATE">("INSERT");

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

  /* =========================
     Draft persistence
  ========================= */

  async function saveDraftInternal() {
    await saveJSONToFolder(
      DRAFTS_FOLDER,
      `${spendingId}.json`,
      {
        version: 1,
        spendingId,
        processed: false,
        toProcess: isBalanced.value,
        mode:draftMode.value,
        partyID: partyID ?? null,
        savedAt: new Date().toISOString(),
        allocations: allocations.value
      }
    );

    draftExists.value = true;
  }

  /*
    Plus aucune allocation : le draft est retiré du
    stockage. En Object Storage, le Mac est prévenu de
    supprimer sa copie.
  */
  async function deleteDraftInternal() {
    if (!draftExists.value) return;

    const fileName = `${spendingId}.json`;

    await deleteFileFromFolder(
      DRAFTS_FOLDER,
      fileName
    );

    draftExists.value = false;

    const { backend } = useStorageBackend();

    if (backend.value === "OBJECT_STORAGE") {
      await publishS3StoragePullRequest({
        downloadPaths: [],
        deletePaths: [`${DRAFTS_FOLDER}/${fileName}`],
        reason: "ALLOCATION_DRAFT_DELETED"
      });
    }
  }

  /*
    Sauvegarde automatique après chaque changement des
    allocations.
  */
  async function persistDraft() {
    if (state.value === "READONLY") return;

    busy.value = true;
    busyAction.value = "save";
    state.value = "BUSY";

    try {
      if (allocations.value.length) {
        await saveDraftInternal();
      } else {
        await deleteDraftInternal();
      }

      saveError.value = null;

    } catch (err) {
      saveError.value =
        err instanceof Error
          ? err.message
          : String(err);

    } finally {
      busy.value = false;
      busyAction.value = null;
      recomputeLocalState();
    }
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
          await findFileByName(DRAFTS_FOLDER, filename);

        if (draftFile) {
          const raw =
            await loadJSONFromFolder<any>(
              DRAFTS_FOLDER,
              filename
            );

          draftMode.value = raw?.mode; // 🔥 ICI

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

          draftExists.value = true;

          recomputeLocalState();
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

  /*
    Enregistre le contenu du formulaire.

    replaceEdited :
      true  → remplace l'allocation en cours de
              modification, à sa position ;
      false → ajoute une nouvelle allocation, même si
              le formulaire a été rempli à partir d'une
              allocation existante.
  */
  async function commitAllocation(replaceEdited: boolean) {
    return runExclusive(async () => {
      if (!categoryID.value || !subCategoryID.value) return;
      if (!Number.isFinite(amount.value) || amount.value === 0) return;

      const editedIndex =
        replaceEdited
          ? allocations.value.findIndex(
              a => a.id === editingAllocationId.value
            )
          : -1;

      if (replaceEdited && editedIndex < 0) return;

      const entry: Allocation = {
        id:
          editedIndex >= 0
            ? allocations.value[editedIndex].id
            : crypto.randomUUID(),
        categoryID: categoryID.value,
        subCategoryID: subCategoryID.value,
        comment: comment.value.trim() || DEFAULT_COMMENT,
        amount: Number(amount.value.toFixed(2)),
        allocationDate:
          allocationDate.value?.trim() || spendingDate,
        allocatedTagID: allocatedTagID.value
      };

      if (editedIndex >= 0) {
        allocations.value.splice(editedIndex, 1, entry);
      } else {
        allocations.value.push(entry);
      }

      editingAllocationId.value = null;

      resetForm();
      recomputeLocalState();

      await persistDraft();
    });
  }

  async function addAllocation() {
    return commitAllocation(false);
  }

  async function replaceAllocation() {
    return commitAllocation(true);
  }

  /*
    Reprend dans le formulaire les valeurs d'une
    allocation existante.
  */
  function editAllocation(index: number) {
    const item = allocations.value[index];

    if (!item) return;

    editingAllocationId.value = item.id;

    categoryID.value = item.categoryID;
    subCategoryID.value = item.subCategoryID;
    comment.value =
      item.comment === DEFAULT_COMMENT
        ? ""
        : item.comment;
    amount.value = item.amount;
    allocationDate.value =
      item.allocationDate &&
      item.allocationDate !== spendingDate
        ? item.allocationDate
        : null;
    allocatedTagID.value = item.allocatedTagID;
  }

  function cancelEdit() {
    editingAllocationId.value = null;

    resetForm();
  }

  async function removeAllocation(index: number) {
    return runExclusive(async () => {
      if (
        index < 0 ||
        index >= allocations.value.length
      ) return;

      const [removed] =
        allocations.value.splice(index, 1);

      /*
        Le formulaire n'est pas modifié pendant la
        modification d'une autre allocation.
      */
      if (removed.id === editingAllocationId.value) {
        editingAllocationId.value = null;
        resetForm();
      } else if (editingAllocationId.value === null) {
        presetAmount();
      }

      recomputeLocalState();

      await persistDraft();
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

    editingAllocationId,

    totalAllocated,
    remainingAmount,
    isBalanced,

    hasDraft,
    canRelease,
    saveError,

    loading,
    busy,
    busyAction,

    loadDraft,
    addAllocation,
    replaceAllocation,
    editAllocation,
    cancelEdit,
    removeAllocation
  };
}