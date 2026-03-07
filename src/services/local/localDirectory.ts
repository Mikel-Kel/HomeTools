let directoryHandle: FileSystemDirectoryHandle | null = null;

/* =========================
   Select folder
========================= */

export async function pickLocalDirectory() {

  directoryHandle = await (window as any).showDirectoryPicker();

  console.log("📁 Local directory selected");

  return directoryHandle;
}

/* =========================
   Access handle
========================= */

export function getLocalDirectory() {
  return directoryHandle;
}

/* =========================
   Resolve directory path
   (handles nested paths)
========================= */

export async function resolveLocalDirectory(
  path: string
): Promise<FileSystemDirectoryHandle> {

  if (!directoryHandle) {
    throw new Error("LOCAL_DIRECTORY_NOT_SELECTED");
  }

  const parts = path.split("/").filter(Boolean);

  let current: FileSystemDirectoryHandle = directoryHandle;

  for (const part of parts) {
    current = await current.getDirectoryHandle(part);
  }

  return current;
}

/* =========================
   Resolve file
========================= */

export async function resolveLocalFile(
  path: string,
  fileName: string
): Promise<FileSystemFileHandle> {

  const dir = await resolveLocalDirectory(path);

  return await dir.getFileHandle(fileName);
}