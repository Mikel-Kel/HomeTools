import { ref, computed } from "vue";
import {
  listFilesInFolder,
  readJSON,
  writeJSON,
  deleteFile,
} from "@/services/google/googleDrive";
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
  const busy = ref(false);
  const busyAction = ref<"save" | "release" | null>(null);

  const allocations = ref<Allocation[]>([]);

  const categoryID = ref<number | null>(null);
  const subCategoryID = ref<number | null>(null);
  const comment = ref<string>("");

  const amount = ref<number>(Math.abs(spendingAmount));

  const hasDraft = ref(false);
  const draftLoaded = ref(false);

  /* =========================
     Computed
  ========================= */
  const totalAllocated = computed(() =>
    allocations.value.reduce((s, a) => s + a.amount, 0)
  );

  const remainingAmount = computed(() =>
    spendingAmount - totalAllocated.value
  );

  const isBalanced = computed(() =>
    Number(remainingAmount.value.toFixed(2)) === 0
  );

  const canSaveDraft = computed(() =>
    isBalanced.value
  );

  const canRelease = computed(() =>
    isBalanced.value && hasDraft.value
  );

  /* =========================
     Allocation editing
  ========================= */
  function addAllocation() {
    if (!categoryID.value || !subCategoryID.value) return;
    if (!Number.isFinite(amount.value) || amount.value === 0) return;

    const signed =
      spendingAmount < 0
        ? -Math.abs(amount.value)
        : Math.abs(amount.value);

    allocations.value.push({
      id: crypto.randomUUID(),
      categoryID: categoryID.value,
      subCategoryID: subCategoryID.value,
      comment: comment.value.trim() || "No comment typed by user",
      amount: Number(signed.toFixed(2)),
    });

    resetForm();
  }

  function removeAllocation(index: number) {
    allocations.value.splice(index, 1);
    presetAmount();
  }

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
     Load draft
  ========================= */
  async function loadDraft(): Promise<void> {
    if (draftLoaded.value || !driveState.value) return;

    busy.value = true;
    try {
      const folder = driveState.value.folders.allocations.drafts;
      const filename = `${spendingId}.json`;

      const files = await listFilesInFolder(folder);
      const file = files.find(f => f.name === filename);
      if (!file) return;

      const raw = await readJSON<any>(file.id);
      if (!Array.isArray(raw?.allocations)) return;

      allocations.value = raw.allocations.map((a: any) => ({
        id: crypto.randomUUID(),
        categoryID: a.categoryID ?? null,
        subCategoryID: a.subCategoryID ?? null,
        comment: a.comment ?? "",
        amount: Number(Number(a.amount).toFixed(2)),
      }));

      hasDraft.value = true;
      presetAmount();
    } finally {
      draftLoaded.value = true;
      busy.value = false;
    }
  }

  /* =========================
     Save draft
  ========================= */
  async function saveDraft(): Promise<void> {
    if (!canSaveDraft.value || !driveState.value) return;

    busy.value = true;
    busyAction.value = "save";

    try {
      const folder = driveState.value.folders.allocations.drafts;
      const filename = `${spendingId}.json`;

      const files = await listFilesInFolder(folder);
      const existing = files.find(f => f.name === filename);

      await writeJSON(
        folder,
        filename,
        {
          version: 1,
          spendingId,
          savedAt: new Date().toISOString(),
          allocations: allocations.value,
        },
        existing?.id
      );

      hasDraft.value = true;
    } finally {
      busy.value = false;
      busyAction.value = null;
    }
  }

  /* =========================
     Release = MOVE draft
  ========================= */
async function release(): Promise<void> {
  if (!canRelease.value || !driveState.value) return;

  busy.value = true;
  busyAction.value = "release";

  try {
    const draftsFolder =
      driveState.value.folders.allocations.drafts;
    const releasedFolder =
      driveState.value.folders.allocations.released;

    const filename = `${spendingId}.json`;

    /* ─────────────────────────────
       1) retrouver le draft
    ───────────────────────────── */
    const draftFiles = await listFilesInFolder(draftsFolder);
    const draftFile = draftFiles.find(f => f.name === filename);
    if (!draftFile) {
      throw new Error("Draft not found for release");
    }

    /* ─────────────────────────────
       2) vérifier s’il existe déjà
          un fichier released
    ───────────────────────────── */
    const releasedFiles = await listFilesInFolder(releasedFolder);
    const existingReleased = releasedFiles.find(
      f => f.name === filename
    );

    /* ─────────────────────────────
       3) écrire dans released
          (PATCH si existant)
    ───────────────────────────── */
    await writeJSON(
      releasedFolder,
      filename,
      {
        version: 1,
        spendingId,
        spendingAmount: Number(spendingAmount.toFixed(2)),
        currency: "CHF",
        releasedAt: new Date().toISOString(),
        allocations: allocations.value,
      },
      existingReleased?.id   // ⭐ clé anti-(1)
    );

    /* ─────────────────────────────
       4) supprimer le draft
    ───────────────────────────── */
    await deleteFile(draftFile.id);

    hasDraft.value = false;
  } finally {
    busy.value = false;
    busyAction.value = null;
  }
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

    canSaveDraft,
    canRelease,
    busy,
    busyAction,

    loadDraft,
    addAllocation,
    removeAllocation,
    saveDraft,
    release,
  };
}