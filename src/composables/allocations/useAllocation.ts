/**
 * ============================================================
 * Allocation — Business rules & state machine
 * ============================================================
 *
 * CORE PRINCIPLE
 * --------------
 * Allocation is driven by a single deterministic state machine.
 * UI buttons (Save / Release) are derived ONLY from this state.
 *
 *
 * STATES
 * ------
 * EMPTY     : no allocation yet
 * EDITING   : allocations exist, remaining ≠ 0
 * BALANCED  : allocations exist, remaining = 0, not drafted
 * DRAFTED   : draft saved in Drive (drafts/)
 * BUSY      : transient state during async Drive operations
 *
 *
 * BUSINESS RULES
 * --------------
 *
 * R1 — Save draft
 *      A draft can be saved IF AND ONLY IF:
 *        - remaining === 0
 *        - state === BALANCED
 *
 * R2 — Release
 *      A draft can be released IF AND ONLY IF:
 *        - state === DRAFTED
 *
 * R3 — Draft invalidation
 *      Any user modification AFTER a draft exists
 *      (currently: allocation removal)
 *      MUST:
 *        - delete the draft file from Drive
 *        - revert state to EDITING / BALANCED
 *
 * R4 — Post-save behavior
 *      After a successful saveDraft:
 *        - state becomes DRAFTED
 *        - Save button is disabled
 *        - Release button becomes available
 *
 * R5 — Auto-save
 *      When user actions lead to remaining === 0
 *      (typically after the last ADD),
 *      a draft is automatically saved.
 *
 * R6 — Reopen released
 *      When AllocationView is opened:
 *        - if no draft exists
 *        - but a released file exists
 *      THEN:
 *        - released file is moved back to drafts
 *        - allocation becomes editable again
 *        - state becomes DRAFTED
 *
 *
 * TECHNICAL GUARANTEES
 * --------------------
 * - All async operations are serialized via runExclusive()
 * - State transitions are explicit and centralized
 * - No watcher-based side effects
 * - UI derives from state, never the opposite
 *
 * ============================================================
 */


import { ref, computed } from "vue";
import {
  listFilesInFolder,
  readJSON,
  writeJSON,
  deleteFile,
} from "@/services/google/googleDrive";
import { useDrive } from "@/composables/useDrive";
import { googleAuthenticated } from "@/services/google/googleInit";

/* =========================
   Types
========================= */
export interface Allocation {
  id: string;
  categoryID: number | null;
  subCategoryID: number | null;
  comment: string;
  amount: number;
  allocationDate: string;          // YYYY-MM-DD
  allocatedTagID: number | null;   // tag choisi (peut rester null)
}

type AllocationState =
  | "EMPTY"     // aucune allocation
  | "EDITING"   // remaining != 0
  | "BALANCED"  // remaining == 0, pas drafté
  | "DRAFTED"   // draft sauvegardé
  | "BUSY";     // transition

const loading = ref(true);

/* =========================
   Helpers Drive
========================= */
/*async function findFileByName(folderId: string, filename: string) {
  const files = await listFilesInFolder(folderId);
  return files.find((f) => f.name === filename) ?? null;
}
*/
async function findFileByName(folderId: string, filename: string) {

  const files = await listFilesInFolder(folderId);

  const found = files.find(f => f.name === filename) ?? null;

  return found;
}

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

/* =========================
   Composable
========================= */
export function useAllocation(spendingId: string, spendingAmount: number, partyID: number | null) {
  const { driveState } = useDrive();

  /* =========================
     Drive availability
  ========================= */
  function driveAvailable(): boolean {
    return !!driveState.value && googleAuthenticated.value;
  }

  /* =========================
     Mutex (serialize async ops)
     → évite les courses "click + autosave + delete"
  ========================= */
  let chain = Promise.resolve();
  function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const next = chain.then(fn, fn);
    // ne casse pas la chaîne en cas d’erreur
    chain = next.then(
      () => undefined,
      () => undefined
    ) as unknown as Promise<void>;
    return next;
  }

  /* =========================
     State (UI)
  ========================= */
  const state = ref<AllocationState>("EMPTY");
  const busy = ref(false);
  const busyAction = ref<"load" | "save" | "release" | null>(null);
  
  /* =========================
     Domain data
  ========================= */
  const allocations = ref<Allocation[]>([]);

  const categoryID = ref<number | null>(null);
  const subCategoryID = ref<number | null>(null);
  const comment = ref<string>("");
  const amount = ref<number>(Math.abs(spendingAmount));

  /* =========================
     Computed amounts
  ========================= */
  const totalAllocated = computed(() =>
    allocations.value.reduce((s, a) => s + a.amount, 0)
  );

  const remainingAmount = computed(() => spendingAmount - totalAllocated.value);

  const isBalanced = computed(
    () => Number(remainingAmount.value.toFixed(2)) === 0
  );

  /* =========================
     UI flags (DERIVED ONLY)
     - pas des états métier supplémentaires
  ========================= */
  const hasDraft = computed(() => state.value === "DRAFTED");
  const canSaveDraft = computed(() => state.value === "BALANCED");
  const canRelease = computed(() => state.value === "DRAFTED");

  /* =========================
     Local state recomputation
     (pure, sans Drive)
  ========================= */
  function recomputeLocalState(base?: AllocationState) {
    // base: état actuel (si on veut préserver DRAFTED/BUSY)
    const current = base ?? state.value;

    // On ne “recalcule” pas DRAFTED/BUSY automatiquement :
    // ces états sont posés explicitement après succès Drive.
    if (current === "DRAFTED" || current === "BUSY") return;

    if (allocations.value.length === 0) {
      state.value = "EMPTY";
      return;
    }

    state.value = isBalanced.value ? "BALANCED" : "EDITING";
  }

  /* =========================
     Draft file helpers
  ========================= */
/*  async function deleteDraftFileIfExists(): Promise<void> {
    if (!driveAvailable()) return;

    const draftsFolder = driveState.value!.folders.allocations.drafts;
    const filename = `${spendingId}.json`;

    const existing = await findFileByName(draftsFolder, filename);
    if (existing) {
      await deleteFile(existing.id);
    }
  }
*/
async function deleteDraftFileIfExists(): Promise<void> {

  if (!driveAvailable()) {
    console.warn("🚫 Drive not available");
    console.groupEnd();
    return;
  }

  const folder = driveState.value!.folders.allocations.drafts;
  const filename = `${spendingId}.json`;
  const existing = await findFileByName(folder, filename);

  if (!existing) {
    console.warn("❌ Draft file NOT FOUND → nothing deleted");
    console.groupEnd();
    return;
  }

  await deleteFile(existing.id);

}


  async function saveDraftInternal(): Promise<void> {
    if (!driveAvailable()) return;

    const draftsFolder = driveState.value!.folders.allocations.drafts;
    const filename = `${spendingId}.json`;

    // upsert (évite doublons)
    const existing = await findFileByName(draftsFolder, filename);

    await writeJSON(
      draftsFolder,
      filename,
      {
        version: 1,
        spendingId,
        partyID: partyID ?? null,
        savedAt: new Date().toISOString(),
        allocations: allocations.value,
      },
      existing?.id
    );
  }

  /* =========================
     Public actions
  ========================= */

  async function loadDraft(): Promise<void> {
    loading.value = true; // 🔑 cycle de vie UI : chargement initial

    return runExclusive(async () => {
      if (!driveAvailable()) {
        loading.value = false;
        return;
      }

      busy.value = true;
      busyAction.value = "load";
      /* state.value = "BUSY"; */

      try {
        const draftsFolder = driveState.value!.folders.allocations.drafts;
        const filename = `${spendingId}.json`;

        let file = await findFileByName(draftsFolder, filename);

        if (!file) {
          const reopened = await reopenReleasedIfExists();
          if (reopened) {
            file = await findFileByName(draftsFolder, filename);
          }
        }

        if (!file) {
          state.value = "EMPTY";
          recomputeLocalState();
          return;
        }

        const raw = await readJSON<any>(file.id);
        if (!Array.isArray(raw?.allocations)) {
          // draft invalide → on repart proprement
          state.value = "EMPTY";
          recomputeLocalState();
          return;
        }

        allocations.value = raw.allocations.map((a: any) => ({
          id: crypto.randomUUID(),
          categoryID: a.categoryID ?? null,
          subCategoryID: a.subCategoryID ?? null,
          comment: a.comment ?? "",
          amount: Number(Number(a.amount).toFixed(2)),
          allocationDate: a.allocationDate ?? todayISODate(),
          allocatedTagID: a.allocatedTagID ?? null,
        }));

        // draft chargé ⇒ état DRAFTED (prioritaire sur le calcul local)
        state.value = "DRAFTED";

        // preset montant
        presetAmount();
      } finally {
        busy.value = false;
        busyAction.value = null;
        loading.value = false; // 🔑 fin définitive du "Loading…"
      }
    });
  }

  async function addAllocation(): Promise<void> {
    return runExclusive(async () => {
      if (!categoryID.value || !subCategoryID.value) return;
      if (!Number.isFinite(amount.value) || amount.value === 0) return;

      const signed =
        spendingAmount < 0 ? -Math.abs(amount.value) : Math.abs(amount.value);

      // modif locale
      allocations.value.push({
        id: crypto.randomUUID(),
        categoryID: categoryID.value,
        subCategoryID: subCategoryID.value,
        comment: comment.value.trim() || "Please comment",
        amount: Number(signed.toFixed(2)),
        allocationDate: todayISODate(),
        allocatedTagID: null, // (plus tard: valeur issue du tag saisi)
      });

      resetForm();

      // 1) On calcule l’état local (sans Drive)
      // Si on était DRAFTED, ADD n’est normalement pas le chemin de modification chez toi
      // (tu disais “modif uniquement par suppression”), mais on reste robuste :
      if (state.value === "DRAFTED") {
        // invalidation si un draft existe (robuste)
        await deleteDraftFileIfExists();
        state.value = "EDITING";
      } else {
        recomputeLocalState();
      }

      // 2) R5 — si maintenant Balanced après ADD ⇒ auto-save ⇒ DRAFTED
      if (state.value === "BALANCED") {
        if (!driveAvailable()) return;

        busy.value = true;
        busyAction.value = "save";
        state.value = "BUSY";

        try {
          await saveDraftInternal();
          state.value = "DRAFTED"; // R4
        } finally {
          busy.value = false;
          busyAction.value = null;
        }
      }
    });
  }

  async function removeAllocation(index: number): Promise<void> {
    return runExclusive(async () => {
      if (index < 0 || index >= allocations.value.length) return;

      allocations.value.splice(index, 1);
      presetAmount();

      // 🔑 règle métier : toute suppression invalide un draft éventuel
      if (driveAvailable()) {
        busy.value = true;
        busyAction.value = null;
        state.value = "BUSY";

        try {
          await deleteDraftFileIfExists();
        } finally {
          busy.value = false;
          busyAction.value = null;
        }
      }

      // retour à un état local cohérent
      recomputeLocalState();
    });
  }

  async function saveDraft(): Promise<void> {
    return runExclusive(async () => {
      // R1 : uniquement BALANCED
      if (state.value !== "BALANCED") return;
      if (!driveAvailable()) return;

      busy.value = true;
      busyAction.value = "save";
      state.value = "BUSY";

      try {
        await saveDraftInternal();
        state.value = "DRAFTED"; // R4
      } finally {
        busy.value = false;
        busyAction.value = null;
      }
    });
  }

  async function release(): Promise<void> {
    return runExclusive(async () => {
      // R2 : uniquement DRAFTED
      if (state.value !== "DRAFTED") return;
      if (!driveAvailable()) return;

      busy.value = true;
      busyAction.value = "release";
      state.value = "BUSY";

      try {
        const draftsFolder = driveState.value!.folders.allocations.drafts;
        const releasedFolder = driveState.value!.folders.allocations.released;
        const filename = `${spendingId}.json`;

        const draftFile = await findFileByName(draftsFolder, filename);
        if (!draftFile) {
          // draft attendu mais absent → on retombe sur logique locale
          state.value = "EDITING";
          recomputeLocalState();
          return;
        }

        const existingReleased = await findFileByName(releasedFolder, filename);

        await writeJSON(
          releasedFolder,
          filename,
          {
            version: 1,
            spendingId,
            partyID: partyID ?? null,
            spendingAmount: Number(spendingAmount.toFixed(2)),
            currency: "CHF",
            releasedAt: new Date().toISOString(),
            allocations: allocations.value,
          },
          existingReleased?.id
        );

        await deleteFile(draftFile.id);

        // après release, on n’a plus de draft
        state.value = "EDITING";
        recomputeLocalState();
      } finally {
        busy.value = false;
        busyAction.value = null;
      }
    });
  }

  async function reopenReleasedIfExists(): Promise<boolean> {
    if (!driveAvailable()) return false;

    const draftsFolder = driveState.value!.folders.allocations.drafts;
    const releasedFolder = driveState.value!.folders.allocations.released;
    const filename = `${spendingId}.json`;

    const released = await findFileByName(releasedFolder, filename);
    if (!released) return false;

    const data = await readJSON<any>(released.id);

    await writeJSON(draftsFolder, filename, data);
    await deleteFile(released.id);

    return true;
  }

/* =========================
     Form helpers
  ========================= */
  function presetAmount() {
    amount.value = Number(Math.abs(remainingAmount.value).toFixed(2));
  }

  function resetForm() {
    categoryID.value = null;
    subCategoryID.value = null;
    comment.value = "";
    presetAmount();
  }

  /* =========================
     Public API
  ========================= */
  return {
    // state (si tu veux le logger/debug)
    state,

    // data
    allocations,
    categoryID,
    subCategoryID,
    comment,
    amount,

    // computed amounts
    totalAllocated,
    remainingAmount,
    isBalanced,

    // UI flags derived from state
    canSaveDraft,
    canRelease,
    hasDraft,

    // busy
    loading,
    busy,
    busyAction,

    // actions
    loadDraft,
    addAllocation,
    removeAllocation,
    saveDraft,
    release,
  };
}