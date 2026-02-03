import { listFilesInFolder, readJSON } from "@/services/google/googleDrive";
import { useDrive } from "@/composables/useDrive";
export async function loadAppVersion() {
    const { driveState } = useDrive();
    if (!driveState.value) {
        throw new Error("Drive not connected");
    }
    const folderId = driveState.value.folders.settings;
    const files = await listFilesInFolder(folderId);
    const file = files.find(f => f.name === "AppVersion.json");
    if (!file) {
        throw new Error("AppVersion.json not found in settings");
    }
    const raw = await readJSON(file.id);
    if (!raw || typeof raw.version !== "string") {
        throw new Error("Invalid AppVersion.json format");
    }
    return raw.version;
}
