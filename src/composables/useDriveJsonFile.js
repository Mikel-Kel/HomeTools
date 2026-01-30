import { ref } from "vue";
import { listFilesInFolder, readJSON, writeJSON, } from "@/services/google/googleDrive";
/* =========================
  Composable
========================= */
export function useDriveJsonFile(folderId, filename) {
    /* =========================
      State
    ========================= */
    const fileId = ref(null);
    const busy = ref(false);
    const error = ref(null);
    /* =========================
      Resolve file id
    ========================= */
    async function resolveFileId() {
        if (fileId.value)
            return fileId.value;
        const files = await listFilesInFolder(folderId);
        const file = files.find((f) => f.name === filename);
        if (!file)
            return null;
        fileId.value = file.id;
        return file.id;
    }
    /* =========================
      Load JSON
    ========================= */
    async function load() {
        busy.value = true;
        error.value = null;
        try {
            const id = await resolveFileId();
            if (!id)
                return null;
            return await readJSON(id);
        }
        catch (e) {
            error.value =
                e instanceof Error ? e.message : String(e);
            throw e;
        }
        finally {
            busy.value = false;
        }
    }
    /* =========================
      Save JSON
    ========================= */
    async function save(data) {
        busy.value = true;
        error.value = null;
        try {
            const id = await resolveFileId();
            const newId = await writeJSON(folderId, filename, data, id ?? undefined);
            fileId.value = newId;
        }
        catch (e) {
            error.value =
                e instanceof Error ? e.message : String(e);
            throw e;
        }
        finally {
            busy.value = false;
        }
    }
    /* =========================
      Public API
    ========================= */
    return {
        busy,
        error,
        load,
        save,
    };
}
