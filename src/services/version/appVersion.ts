import { loadJSONFromFolder } from "@/services/driveAdapter";
import { useDrive } from "@/composables/useDrive";

interface AppVersionFile {
  version: string;
}

export async function loadAppVersion(): Promise<string> {

  const folder =
    "settings";

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