import {
  readJSON,
  writeJSON,
  listFilesInFolder,
} from "@/services/google/googleDrive";
import { googleAuthenticated } from "@/services/google/googleInit";

/* =========================
   Helpers
========================= */
function handleDriveError(err: any): never {
  if (err?.message === "DRIVE_UNAUTHORIZED") {
    googleAuthenticated.value = false;
    console.warn("🔐 Google Drive session expired");
    throw new Error("DRIVE_SESSION_EXPIRED");
  }
  throw err;
}

/* =========================
   Load JSON
========================= */
export async function loadJSONFromFolder<T>(
  folderId: string,
  filename: string
): Promise<T | null> {
  try {
    const files = await listFilesInFolder(folderId);
    const file = files.find(f => f.name === filename);
    if (!file) return null;

    return await readJSON<T>(file.id);
  } catch (err) {
    handleDriveError(err);
  }
}

/* =========================
   Save JSON
========================= */
export async function saveJSONToFolder(
  folderId: string,
  filename: string,
  data: any
): Promise<void> {
  try {
    const files = await listFilesInFolder(folderId);
    const existing = files.find(f => f.name === filename);

    await writeJSON(folderId, filename, data, existing?.id);
  } catch (err) {
    handleDriveError(err);
  }
}