import { useStorageBackend } from "@/composables/useStorageBackend";
import { getLocalDirectory } from "@/services/local/localDirectory";

import {
  readJSON,
  writeJSON,
  listFilesInFolder,
  deleteFile,
  getFileMetadataByName
} from "@/services/google/googleDrive";

import {
  loadLocalJSON,
  saveLocalJSON,
  listLocalFiles,
  resolveDirectory
} from "@/services/local/localRepository";

import { googleAuthenticated } from "@/services/google/googleInit";

/* =========================
   Helpers
========================= */

function handleDriveError(err: any): never {

  if (err?.message === "DRIVE_UNAUTHORIZED") {

    googleAuthenticated.value = false;

    console.warn("🔐 Google Drive session expired");

    throw err;

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

  const { backend } = useStorageBackend();

  /* ---------- LOCAL ---------- */

  if (backend.value === "LOCAL_DRIVE") {

    return await loadLocalJSON<T>(folderId, filename);

  }

  /* ---------- GOOGLE DRIVE ---------- */

  try {

    const files = await listFilesInFolder(folderId);

    const file = files.find(f => f.name === filename);

    if (!file) return null;

    return await readJSON<T>(file.id);

  }
  catch (err) {

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

  const { backend } = useStorageBackend();

  /* ---------- LOCAL ---------- */

  if (backend.value === "LOCAL_DRIVE") {

    await saveLocalJSON(folderId, filename, data);

    return;

  }

  /* ---------- GOOGLE DRIVE ---------- */

  try {

    const files = await listFilesInFolder(folderId);

    const existing = files.find(f => f.name === filename);

    await writeJSON(folderId, filename, data, existing?.id);

  }
  catch (err) {

    handleDriveError(err);

  }

}

/* =========================
   List files
   (centralised abstraction)
========================= */

export async function listFiles(
  folderId: string
) {

  const { backend } = useStorageBackend();

  /* ---------- LOCAL ---------- */

  if (backend.value === "LOCAL_DRIVE") {

    return await listLocalFiles(folderId);

  }

  /* ---------- GOOGLE DRIVE ---------- */

  try {

    return await listFilesInFolder(folderId);

  }
  catch (err) {

    handleDriveError(err);

  }

}

/* =========================
   Delete file
========================= */

export async function deleteFileFromFolder(
  folderId: string,
  filename: string
) {

  const { backend } = useStorageBackend();

  /* ---------- LOCAL ---------- */

  if (backend.value === "LOCAL_DRIVE") {

    const root = getLocalDirectory();

    if (!root) {
      throw new Error("LOCAL_DIRECTORY_NOT_SELECTED");
    }

    const dir = await resolveDirectory(root, folderId);

    await dir.removeEntry(filename);

    return;

  }

  /* ---------- GOOGLE DRIVE ---------- */

  try {

    const files = await listFilesInFolder(folderId);

    const file = files.find(f => f.name === filename);

    if (!file) return;

    await deleteFile(file.id);

  }
  catch (err) {

    handleDriveError(err);

  }

}

/* =========================
   File metadata
========================= */

export async function getFileModifiedTime(
  folderId: string,
  filename: string
): Promise<string | null> {

  const { backend } = useStorageBackend();

  /* ---------- LOCAL ---------- */

  if (backend.value === "LOCAL_DRIVE") {

    const root = getLocalDirectory();

    if (!root) {
      throw new Error("LOCAL_DIRECTORY_NOT_SELECTED");
    }

    const dir = await resolveDirectory(root, folderId);

    try {

      const fileHandle =
        await dir.getFileHandle(filename);

      const file = await fileHandle.getFile();

      return new Date(file.lastModified).toISOString();

    } catch {

      return null;

    }

  }

  /* ---------- GOOGLE ---------- */

  const meta =
    await getFileMetadataByName(folderId, filename);

  return meta?.modifiedTime ?? null;

}
