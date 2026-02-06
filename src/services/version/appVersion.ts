import { listFilesInFolder, readJSON } from "@/services/google/googleDrive";
import { useDrive } from "@/composables/useDrive";

interface AppVersionFile {
  version: string;
}

export async function loadAppVersion(): Promise<string> {
  const { driveState } = useDrive();

  if (!driveState.value) {
    throw new Error("Drive not connected");
  }

  const folderId = driveState.value.folders.settings;
  const files = await listFilesInFolder(folderId);

  const file = files.find(f => f.name === "AppParameters.json");
  if (!file) {
    throw new Error("AppParameters.json not found in settings");
  }

  const raw = await readJSON<AppVersionFile>(file.id);

  if (!raw || typeof raw.version !== "string") {
    throw new Error("Invalid AppParameters.json format");
  }

  return raw.version;
}