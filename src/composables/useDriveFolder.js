import { ref, computed } from "vue";
import { listFilesInFolder, findFolderByName, } from "@/services/google/googleDrive";
/* =========================
   Composable
========================= */
export function useDriveFolder(parentId, folderName) {
    const folder = ref(null);
    const _files = ref([]);
    const files = computed(() => _files.value);
    const busy = ref(false);
    const error = ref(null);
    /* =========================
       Resolve folder id
    ========================= */
    async function resolveFolderId() {
        if (!folderName)
            return parentId;
        let current = folder.value;
        if (!current) {
            const found = await findFolderByName(parentId, folderName);
            if (!found) {
                throw new Error(`[Drive] Folder '${folderName}' not found`);
            }
            folder.value = found;
            current = found;
        }
        return current.id;
    }
    /* =========================
       Refresh folder content
    ========================= */
    async function refresh() {
        busy.value = true;
        error.value = null;
        try {
            const folderId = await resolveFolderId();
            _files.value = await listFilesInFolder(folderId);
        }
        catch (e) {
            error.value =
                e instanceof Error ? e.message : String(e);
            _files.value = [];
        }
        finally {
            busy.value = false;
        }
    }
    return {
        folder,
        files,
        busy,
        error,
        refresh,
    };
}
