import { loadJSONFromFolder } from "@/services/driveAdapter";

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