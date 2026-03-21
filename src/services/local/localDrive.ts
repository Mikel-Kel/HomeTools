import { getLocalDirectory } from "@/services/local/localDirectory";

/* =========================================================
   Resolve folder path (supports nested paths)
========================================================= */
export async function resolveDirectory(
  root: FileSystemDirectoryHandle,
  path: string,
  create = false
): Promise<FileSystemDirectoryHandle> {
  const parts = path.split("/").filter(Boolean);
  let current = root;
  for (const part of parts) {
    current = await current.getDirectoryHandle(part, { create });
  }
  return current;
}

/* =========================================================
   Load JSON
========================================================= */
export async function readLocalJSON<T>(
  folder: string,
  filename: string
): Promise<T | null> {
  const root = getLocalDirectory();
  if (!root) {
    throw new Error("LOCAL_DIRECTORY_NOT_SELECTED");
  }
  try {
    const dir = await resolveDirectory(root, folder);
    const fileHandle = await dir.getFileHandle(filename);
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text);
  }
  catch (err: any) {
    if (err?.name === "NotFoundError") {
      return null;
    }
    throw err;
  }
}

/* =========================================================
   Save JSON
========================================================= */
export async function saveLocalJSON(
  folder: string,
  filename: string,
  data: any
): Promise<void> {
  const root = getLocalDirectory();
  if (!root) {
    throw new Error("LOCAL_DIRECTORY_NOT_SELECTED");
  }
  const dir = await resolveDirectory(root, folder, true);
  const fileHandle = await dir.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

/* =========================================================
   Delete file
========================================================= */
export async function deleteLocalFile(
  folder: string,
  filename: string
): Promise<void> {
  const root = getLocalDirectory();
  if (!root) {
    throw new Error("LOCAL_DIRECTORY_NOT_SELECTED");
  }
  try {
    const dir = await resolveDirectory(root, folder);
    await dir.removeEntry(filename);
  }
  catch (err: any) {
    // fichier absent → OK (même logique que Google)
    if (err?.name === "NotFoundError") {
      return;
    }
    throw err;
  }
}

/* =========================================================
   List files
========================================================= */
export async function listLocalFilesInFolder(folder: string) {
  const root = getLocalDirectory();
  if (!root) {
    throw new Error("LOCAL_DIRECTORY_NOT_SELECTED");
  }
  const dir = await resolveDirectory(root, folder);
  const files: { name: string }[] = [];
  // TypeScript typings incomplete → cast
  for await (const handle of (dir as any).values()) {
    if (handle.kind === "file") {
      files.push({ name: handle.name });
    }
  }
  return files;
}

/* =========================
   Find file by name
========================= */
export async function findLocalFileByName(
  folderPath: string,
  fileName: string
) {
  const files = await listLocalFilesInFolder(folderPath);
  return files.find(f => f.name === fileName) ?? null;
}

/* =========================
   Download file
========================= */
export async function downloadLocalFile(
  filePath: string
): Promise<string> {
  const res = await fetch(filePath);
  if (!res.ok) {
    throw new Error("[LOCAL] downloadFile failed");
  }
  return await res.text();
}
