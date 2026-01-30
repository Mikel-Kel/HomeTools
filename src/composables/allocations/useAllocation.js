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
 * READONLY  : released allocation loaded (processed or not), read-only
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
 * R6 — Released allocations
 *      When AllocationView is opened:
 *        - if a draft exists → it is loaded (editable)
 *        - else if a released file exists → it is loaded READ-ONLY
 *
 *      Released files are NEVER moved back to drafts.
 *      Their lifecycle is handled exclusively by backend/batch processes
 *      via the `processed` flag.
 *
 *
 * TECHNICAL GUARANTEES
 * --------------------
 * - All async operations are serialized via runExclusive()
 * - State transitions are explicit and centralized
 * - No watcher-based side effects
 * - Released files are immutable from the UI
 * - UI derives from state, never the opposite
 *
 * ============================================================
 */
import { ref, computed } from "vue";
import { listFilesInFolder, readJSON, writeJSON, deleteFile, } from "@/services/google/googleDrive";
import { useDrive } from "@/composables/useDrive";
import { googleAuthenticated } from "@/services/google/googleInit";
const loading = ref(true);
/* =========================
   Helpers Drive
========================= */
/*async function findFileByName(folderId: string, filename: string) {
  const files = await listFilesInFolder(folderId);
  return files.find((f) => f.name === filename) ?? null;
}
*/
async function findFileByName(folderId, filename) {
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
export function useAllocation(spendingId, spendingAmount, partyID, spendingDate) {
    const { driveState } = useDrive();
    /* =========================
       Drive availability
    ========================= */
    function driveAvailable() {
        return !!driveState.value && googleAuthenticated.value;
    }
    /* =========================
       Mutex (serialize async ops)
       → évite les courses "click + autosave + delete"
    ========================= */
    let chain = Promise.resolve();
    function runExclusive(fn) {
        const next = chain.then(fn, fn);
        // ne casse pas la chaîne en cas d’erreur
        chain = next.then(() => undefined, () => undefined);
        return next;
    }
    /* =========================
       State (UI)
    ========================= */
    const state = ref("EMPTY");
    const busy = ref(false);
    const busyAction = ref(null);
    /* =========================
       Domain data
    ========================= */
    const allocations = ref([]);
    const categoryID = ref(null);
    const subCategoryID = ref(null);
    const comment = ref("");
    const amount = ref(Math.abs(spendingAmount));
    const allocationDate = ref(null);
    /* =========================
       Computed amounts
    ========================= */
    const totalAllocated = computed(() => allocations.value.reduce((s, a) => s + a.amount, 0));
    const remainingAmount = computed(() => spendingAmount - totalAllocated.value);
    const isBalanced = computed(() => Number(remainingAmount.value.toFixed(2)) === 0);
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
    function recomputeLocalState(base) {
        // base: état actuel (si on veut préserver DRAFTED/BUSY)
        const current = base ?? state.value;
        // On ne “recalcule” pas DRAFTED/BUSY automatiquement :
        // ces états sont posés explicitement après succès Drive.
        if (current === "DRAFTED" || current === "BUSY")
            return;
        if (allocations.value.length === 0) {
            state.value = "EMPTY";
            return;
        }
        state.value = isBalanced.value ? "BALANCED" : "EDITING";
    }
    /* =========================
       Draft file helpers
    ========================= */
    async function deleteDraftFileIfExists() {
        if (!driveAvailable()) {
            console.warn("🚫 Drive not available");
            console.groupEnd();
            return;
        }
        const folder = driveState.value.folders.allocations.drafts;
        const filename = `${spendingId}.json`;
        const existing = await findFileByName(folder, filename);
        if (!existing) {
            console.warn("❌ Draft file NOT FOUND → nothing deleted");
            console.groupEnd();
            return;
        }
        await deleteFile(existing.id);
    }
    async function saveDraftInternal() {
        if (!driveAvailable())
            return;
        const draftsFolder = driveState.value.folders.allocations.drafts;
        const filename = `${spendingId}.json`;
        // upsert (évite doublons)
        const existing = await findFileByName(draftsFolder, filename);
        await writeJSON(draftsFolder, filename, {
            version: 1,
            spendingId,
            processed: false,
            partyID: partyID ?? null,
            savedAt: new Date().toISOString(),
            allocations: allocations.value,
        }, existing?.id);
    }
    /* =========================
       Public actions
    ========================= */
    async function loadDraft() {
        loading.value = true; // 🔑 cycle de vie UI : chargement initial
        return runExclusive(async () => {
            if (!driveAvailable()) {
                loading.value = false;
                return;
            }
            busy.value = true;
            busyAction.value = "load";
            try {
                const draftsFolder = driveState.value.folders.allocations.drafts;
                const releasedFolder = driveState.value.folders.allocations.released;
                const filename = `${spendingId}.json`;
                /* =====================================================
                  1. Tentative : DRAFT
                ===================================================== */
                let file = await findFileByName(draftsFolder, filename);
                if (file) {
                    const raw = await readJSON(file.id);
                    const processed = raw?.processed === true;
                    if (!Array.isArray(raw?.allocations)) {
                        // draft invalide → on repart proprement
                        allocations.value = [];
                        state.value = "EMPTY";
                        recomputeLocalState();
                        return;
                    }
                    allocations.value = raw.allocations.map((a) => ({
                        id: crypto.randomUUID(),
                        categoryID: a.categoryID ?? null,
                        subCategoryID: a.subCategoryID ?? null,
                        comment: a.comment ?? "",
                        amount: Number(Number(a.amount).toFixed(2)),
                        allocationDate: a.allocationDate ?? null,
                        allocatedTagID: a.allocatedTagID ?? null,
                    }));
                    // draft chargé ⇒ état DRAFTED
                    state.value = "DRAFTED";
                    presetAmount();
                    return;
                }
                /* =====================================================
                  2. Tentative : RELEASED (lecture seule)
                ===================================================== */
                const released = await findFileByName(releasedFolder, filename);
                if (released) {
                    const raw = await readJSON(released.id);
                    const processed = raw?.processed === true;
                    if (!Array.isArray(raw?.allocations)) {
                        allocations.value = [];
                        state.value = "EMPTY";
                        recomputeLocalState();
                        return;
                    }
                    allocations.value = raw.allocations.map((a) => ({
                        id: crypto.randomUUID(),
                        categoryID: a.categoryID ?? null,
                        subCategoryID: a.subCategoryID ?? null,
                        comment: a.comment ?? "",
                        amount: Number(Number(a.amount).toFixed(2)),
                        allocationDate: a.allocationDate ?? null,
                        allocatedTagID: a.allocatedTagID ?? null,
                    }));
                    // 🔒 lecture seule
                    state.value = "READONLY";
                    presetAmount();
                    return;
                }
                /* =====================================================
                  3. Rien trouvé
                ===================================================== */
                allocations.value = [];
                state.value = "EMPTY";
                recomputeLocalState();
            }
            finally {
                busy.value = false;
                busyAction.value = null;
                loading.value = false; // 🔑 fin définitive du "Loading…"
            }
        });
    }
    async function addAllocation() {
        return runExclusive(async () => {
            if (!categoryID.value || !subCategoryID.value)
                return;
            if (!Number.isFinite(amount.value) || amount.value === 0)
                return;
            const signed = spendingAmount < 0 ? -Math.abs(amount.value) : Math.abs(amount.value);
            const normalizedDate = allocationDate.value && allocationDate.value.trim() !== ""
                ? allocationDate.value
                : spendingDate;
            // modif locale
            allocations.value.push({
                id: crypto.randomUUID(),
                categoryID: categoryID.value,
                subCategoryID: subCategoryID.value,
                comment: comment.value.trim() || "Please comment",
                amount: Number(signed.toFixed(2)),
                allocationDate: normalizedDate,
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
            }
            else {
                recomputeLocalState();
            }
            // 2) R5 — si maintenant Balanced après ADD ⇒ auto-save ⇒ DRAFTED
            if (state.value === "BALANCED") {
                if (!driveAvailable())
                    return;
                busy.value = true;
                busyAction.value = "save";
                state.value = "BUSY";
                try {
                    await saveDraftInternal();
                    state.value = "DRAFTED"; // R4
                }
                finally {
                    busy.value = false;
                    busyAction.value = null;
                }
            }
        });
    }
    async function removeAllocation(index) {
        return runExclusive(async () => {
            if (index < 0 || index >= allocations.value.length)
                return;
            allocations.value.splice(index, 1);
            presetAmount();
            // 🔑 règle métier : toute suppression invalide un draft éventuel
            if (driveAvailable()) {
                busy.value = true;
                busyAction.value = null;
                state.value = "BUSY";
                try {
                    await deleteDraftFileIfExists();
                }
                finally {
                    busy.value = false;
                    busyAction.value = null;
                }
            }
            // retour à un état local cohérent
            recomputeLocalState();
        });
    }
    async function saveDraft() {
        return runExclusive(async () => {
            // R1 : uniquement BALANCED
            if (state.value !== "BALANCED")
                return;
            if (!driveAvailable())
                return;
            busy.value = true;
            busyAction.value = "save";
            state.value = "BUSY";
            try {
                await saveDraftInternal();
                state.value = "DRAFTED"; // R4
            }
            finally {
                busy.value = false;
                busyAction.value = null;
            }
        });
    }
    async function release() {
        return runExclusive(async () => {
            // R2 : uniquement DRAFTED
            if (state.value !== "DRAFTED")
                return;
            if (!driveAvailable())
                return;
            busy.value = true;
            busyAction.value = "release";
            state.value = "BUSY";
            try {
                const draftsFolder = driveState.value.folders.allocations.drafts;
                const releasedFolder = driveState.value.folders.allocations.released;
                const filename = `${spendingId}.json`;
                const draftFile = await findFileByName(draftsFolder, filename);
                if (!draftFile) {
                    // draft attendu mais absent → on retombe sur logique locale
                    state.value = "EDITING";
                    recomputeLocalState();
                    return;
                }
                const existingReleased = await findFileByName(releasedFolder, filename);
                await writeJSON(releasedFolder, filename, {
                    version: 1,
                    spendingId,
                    processed: false,
                    partyID: partyID ?? null,
                    spendingAmount: Number(spendingAmount.toFixed(2)),
                    currency: "CHF",
                    releasedAt: new Date().toISOString(),
                    allocations: allocations.value,
                }, existingReleased?.id);
                await deleteFile(draftFile.id);
                // après release, on n’a plus de draft
                state.value = "EDITING";
                recomputeLocalState();
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
        amount.value = Number(Math.abs(remainingAmount.value).toFixed(2));
    }
    function resetForm() {
        categoryID.value = null;
        subCategoryID.value = null;
        comment.value = "";
        allocationDate.value = null;
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
        allocationDate,
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
