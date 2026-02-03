import { useDriveJsonFile } from "@/composables/useDriveJsonFile";
/* =========================
   Composable
========================= */
export function useDriveSpending(spendingFolderId) {
    const jsonFile = useDriveJsonFile(spendingFolderId, "spending.json");
    /* =========================
       Load from Drive
    ========================= */
    async function load() {
        const data = await jsonFile.load();
        if (!data)
            return null;
        // Validation minimale
        if (data.version !== 1 ||
            !Array.isArray(data.accounts) ||
            !Array.isArray(data.recordsByAccount)) {
            throw new Error("Invalid spending.json format");
        }
        return data;
    }
    /* =========================
       Save to Drive
    ========================= */
    async function save(accounts, recordsByAccount) {
        const payload = {
            version: 1,
            exportedAt: new Date().toISOString(),
            accounts,
            recordsByAccount,
        };
        await jsonFile.save(payload);
    }
    return {
        // state
        busy: jsonFile.busy,
        error: jsonFile.error,
        // actions
        load,
        save,
    };
}
