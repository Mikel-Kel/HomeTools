// src/composables/useAppParameters.ts
import { ref } from "vue";
import { useDrive } from "@/composables/useDrive";
import { listFilesInFolder, readJSON } from "@/services/google/googleDrive";
const appParameters = ref(null);
const loading = ref(false);
const error = ref(null);
export function useAppParameters() {
    const { driveState } = useDrive();
    async function load() {
        if (!driveState.value)
            return;
        if (appParameters.value)
            return;
        loading.value = true;
        error.value = null;
        try {
            const folderId = driveState.value.folders.settings;
            const files = await listFilesInFolder(folderId);
            const file = files.find(f => f.name === "AppParameters.json");
            if (!file) {
                appParameters.value = {};
                return;
            }
            appParameters.value = await readJSON(file.id);
        }
        catch (e) {
            error.value = e.message ?? "Unable to load AppParameters.json";
            appParameters.value = {};
        }
        finally {
            loading.value = false;
        }
    }
    return {
        appParameters,
        load,
        loading,
        error,
    };
}
