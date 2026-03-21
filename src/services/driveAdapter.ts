import { useStorageBackend } from "@/composables/useStorageBackend";
import { getLocalDirectory } from "@/services/local/localDirectory";
import { resolveFolderId } from "@/config/driveResolver";

import {
  saveGoogleJSON,
  deleteGoogleFile,
  listGoogleFilesInFolder,
  findGoogleFileByName,
  downloadGoogleFile,
  getFileMetadataByName
} from "@/services/google/googleDrive";

import {
  readLocalJSON,
  saveLocalJSON,
  deleteLocalFile,
  listLocalFilesInFolder,
  findLocalFileByName,
  downloadLocalFile,
  resolveDirectory
} from "@/services/local/localDrive";

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
   Resolve folder helper
========================= */

async function resolveFolder(folderPathOrId: string): Promise<string> {

  const isLikelyId =
    folderPathOrId.length > 20 &&
    !folderPathOrId.includes("/");

  if (isLikelyId) return folderPathOrId;

  return await resolveFolderId(folderPathOrId);
}

/* =========================
   Load JSON from folder
========================= */

export async function loadJSONFromFolder<T = any>(
  folderPathOrId: string,
  fileName: string
): Promise<T | null> {

  const { backend } = useStorageBackend();

  /* ---------- LOCAL ---------- */

  if (backend.value === "LOCAL_DRIVE") {
    return await readLocalJSON(folderPathOrId, fileName);
  }

  /* ---------- GOOGLE ---------- */

  const folderId = await resolveFolder(folderPathOrId);

  try {

    const file =
      await findGoogleFileByName(folderId, fileName);

    if (!file) return null;

    const content =
      await downloadGoogleFile(file.id);

    return JSON.parse(content);

  }
  catch (err) {
    handleDriveError(err);
  }
}

/* =========================
   Find file
========================= */

export async function findFileByName(
  folderPathOrId: string,
  fileName: string
) {

  const { backend } = useStorageBackend();

  if (backend.value === "LOCAL_DRIVE") {
    return await findLocalFileByName(folderPathOrId, fileName);
  }

  const folderId = await resolveFolder(folderPathOrId);

  return await findGoogleFileByName(folderId, fileName);
}

/* =========================
   Download file
========================= */

export async function downloadFile(
  fileIdOrPath: string
): Promise<string> {

  const { backend } = useStorageBackend();

  if (backend.value === "LOCAL_DRIVE") {
    return await downloadLocalFile(fileIdOrPath);
  }

  return await downloadGoogleFile(fileIdOrPath);
}

/* =========================
   Save JSON
========================= */

export async function saveJSONToFolder(
  folderPathOrId: string,
  filename: string,
  data: any
): Promise<void> {

  const { backend } = useStorageBackend();

  /* ---------- LOCAL ---------- */

  if (backend.value === "LOCAL_DRIVE") {
    await saveLocalJSON(folderPathOrId, filename, data);
    return;
  }

  /* ---------- GOOGLE ---------- */

  const folderId = await resolveFolder(folderPathOrId);

  try {

    const files =
      await listGoogleFilesInFolder(folderId);

    const existing =
      files.find(f => f.name === filename);

    await saveGoogleJSON(
      folderId,
      filename,
      data,
      existing?.id
    );

  }
  catch (err) {
    handleDriveError(err);
  }
}

/* =========================
   List files
========================= */

export async function listFiles(
  folderPathOrId: string
) {

  const { backend } = useStorageBackend();

  if (backend.value === "LOCAL_DRIVE") {
    return await listLocalFilesInFolder(folderPathOrId);
  }

  const folderId = await resolveFolder(folderPathOrId);

  try {
    return await listGoogleFilesInFolder(folderId);
  }
  catch (err) {
    handleDriveError(err);
  }
}

/* =========================
   Delete file
========================= */

export async function deleteFileFromFolder(
  folderPathOrId: string,
  filename: string
) {

  const { backend } = useStorageBackend();

  /* ---------- LOCAL ---------- */

  if (backend.value === "LOCAL_DRIVE") {
    await deleteLocalFile(folderPathOrId, filename);
    return;
  }

  /* ---------- GOOGLE ---------- */

  const folderId = await resolveFolder(folderPathOrId);

  try {

    const file =
      await findGoogleFileByName(folderId, filename);

    if (!file) return;

    await deleteGoogleFile(file.id);

  }
  catch (err) {
    handleDriveError(err);
  }
}

/* =========================
   File metadata
========================= */

export async function getFileModifiedTime(
  folderPathOrId: string,
  filename: string
): Promise<string | null> {

  const { backend } = useStorageBackend();

  /* ---------- LOCAL ---------- */

  if (backend.value === "LOCAL_DRIVE") {

    const root = getLocalDirectory();

    if (!root) {
      throw new Error("LOCAL_DIRECTORY_NOT_SELECTED");
    }

    const dir =
      await resolveDirectory(root, folderPathOrId);

    try {

      const fileHandle =
        await dir.getFileHandle(filename);

      const file =
        await fileHandle.getFile();

      return new Date(file.lastModified).toISOString();

    }
    catch {
      return null;
    }
  }

  /* ---------- GOOGLE ---------- */

  const folderId = await resolveFolder(folderPathOrId);

  const meta =
    await getFileMetadataByName(folderId, filename);

  return meta?.modifiedTime ?? null;
}