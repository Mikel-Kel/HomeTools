import { ref, computed } from "vue";
import { listFilesInFolder, readJSON, writeJSON, deleteFile, } from "@/services/google/googleDrive";
import { useDrive } from "@/composables/useDrive";
import { googleAuthenticated } from "@/services/google/googleInit";
/* =========================
   Helpers Drive
========================= */
/*async function findFileByName(folderId: string, filename: string) {
  const files = await listFilesInFolder(folderId);
  return files.find((f) => f.name === filename) ?? null;
}
*/
async function findFileByName(folderId, filename) {
    console.groupCollapsed("🔍 findFileByName");
    console.log("📁 folderId:", folderId);
    console.log("📄 filename:", filename);
    const files = await listFilesInFolder(folderId);
    console.log("📦 files returned:", files.map(f => ({ id: f.id, name: f.name })));
    const found = files.find(f => f.name === filename) ?? null;
    console.log("🎯 found:", found);
    console.groupEnd();
    return found;
}
/* =========================
   Composable
========================= */
export function useAllocation(spendingId, spendingAmount) {
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
    async function deleteDraftFileIfExists() {
        console.group("🔥 deleteDraftFileIfExists");
        if (!driveAvailable()) {
            console.warn("🚫 Drive not available");
            console.groupEnd();
            return;
        }
        const folder = driveState.value.folders.allocations.drafts;
        const filename = `${spendingId}.json`;
        console.log("📁 draftsFolder:", folder);
        console.log("📄 filename:", filename);
        const existing = await findFileByName(folder, filename);
        if (!existing) {
            console.warn("❌ Draft file NOT FOUND → nothing deleted");
            console.groupEnd();
            return;
        }
        console.log("🧨 Deleting draft file:", existing);
        await deleteFile(existing.id);
        console.log("✅ Draft file deleted");
        console.groupEnd();
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
            savedAt: new Date().toISOString(),
            allocations: allocations.value,
        }, existing?.id);
    }
    /* =========================
       Public actions
    ========================= */
    async function loadDraft() {
        console.group("📥 loadDraft()");
        console.log("🆔 spendingId:", spendingId);
        return runExclusive(async () => {
            if (!driveAvailable())
                return;
            busy.value = true;
            busyAction.value = null;
            /*      state.value = "BUSY";*/
            try {
                const draftsFolder = driveState.value.folders.allocations.drafts;
                const filename = `${spendingId}.json`;
                /*        const file = await findFileByName(draftsFolder, filename);
                        if (!file) {
                          // pas de draft → état dépend du local
                          state.value = "EMPTY";
                          recomputeLocalState();
                          return;
                         }
                */
                let file = await findFileByName(draftsFolder, filename);
                if (!file) {
                    const reopened = await reopenReleasedIfExists();
                    if (reopened) {
                        file = await findFileByName(draftsFolder, filename);
                    }
                }
                if (!file) {
                    console.info("⚠️ No draft or released file found");
                    state.value = "EMPTY";
                    recomputeLocalState();
                    return;
                }
                const raw = await readJSON(file.id);
                if (!Array.isArray(raw?.allocations)) {
                    // draft invalide → on ne casse pas tout
                    state.value = "EMPTY";
                    recomputeLocalState();
                    return;
                }
                console.log("📄 Draft content:", raw);
                allocations.value = raw.allocations.map((a) => ({
                    id: crypto.randomUUID(),
                    categoryID: a.categoryID ?? null,
                    subCategoryID: a.subCategoryID ?? null,
                    comment: a.comment ?? "",
                    amount: Number(Number(a.amount).toFixed(2)),
                }));
                // draft chargé ⇒ état DRAFTED (même si remaining ≠ 0, on respecte le fait "draft existe")
                // (si tu veux forcer la cohérence, on peut invalider automatiquement,
                //  mais tu n’as pas demandé ça)
                state.value = "DRAFTED";
                // preset montant
                presetAmount();
            }
            finally {
                busy.value = false;
                busyAction.value = null;
                // si on n’est pas DRAFTED, on recalcule l’état local
                /*        if (state.value !== "DRAFTED") {
                          recomputeLocalState();
                        }*/
                console.log("🏁 loadDraft done — state:", state.value);
                console.groupEnd();
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
            // modif locale
            allocations.value.push({
                id: crypto.randomUUID(),
                categoryID: categoryID.value,
                subCategoryID: subCategoryID.value,
                comment: comment.value.trim() || "No comment typed by user",
                amount: Number(signed.toFixed(2)),
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
        console.group("🗑️ removeAllocation()");
        console.log("📌 index:", index);
        console.log("📊 allocations BEFORE:", allocations.value);
        console.log("📍 state BEFORE:", state.value);
        return runExclusive(async () => {
            if (index < 0 || index >= allocations.value.length)
                return;
            allocations.value.splice(index, 1);
            console.log("📊 allocations AFTER:", allocations.value);
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
    async function reopenReleasedIfExists() {
        if (!driveAvailable())
            return false;
        const draftsFolder = driveState.value.folders.allocations.drafts;
        const releasedFolder = driveState.value.folders.allocations.released;
        const filename = `${spendingId}.json`;
        const released = await findFileByName(releasedFolder, filename);
        if (!released)
            return false;
        console.info("🔁 Reopening released → drafts", released);
        const data = await readJSON(released.id);
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
