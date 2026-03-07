import { loadJSONFromFolder } from "@/services/google/driveRepository";
import { useDrive } from "@/composables/useDrive";

interface AppVersionFile {
  version: string;
}

export async function loadAppVersion(): Promise<string> {

  const { folders } = useDrive();

  const folder =
    folders.value.settings;

  const raw =
    await loadJSONFromFolder<AppVersionFile>(
      folder,
      "AppParameters.json"
    );

  if (!raw || typeof raw.version !== "string") {
    throw new Error("Invalid AppParameters.json format");
  }

  return raw.version;

}