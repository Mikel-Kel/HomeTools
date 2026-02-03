import { ref } from "vue";
import { listFilesInFolder, readJSON } from "@/services/google/googleDrive";
import { useDrive } from "@/composables/useDrive";
/* =========================
   State (singleton)
========================= */
const banks = ref([]);
/* =========================
   Composable
========================= */
export function useBanks() {
    const { driveState } = useDrive();
    /* =========================
       Load from Drive
    ========================= */
    async function load() {
        if (!driveState.value)
            return;
        const folderId = driveState.value.folders.settings;
        const files = await listFilesInFolder(folderId);
        const file = files.find(f => f.name === "banks.json");
        if (!file) {
            throw new Error("banks.json not found in settings");
        }
        const raw = await readJSON(file.id);
        if (!raw ||
            raw.version !== 1 ||
            !Array.isArray(raw.banks)) {
            throw new Error("Invalid banks.json format");
        }
        // remplacement explicite
        banks.value = raw.banks;
    }
    /* =========================
       Helpers
    ========================= */
    function getBank(bankID) {
        return banks.value.find(b => b.id === bankID);
    }
    return {
        banks,
        load,
        getBank,
    };
}
