import * as idbKeyval from "idb-keyval";
const SNAPSHOT_DB_KEY = "icloudSnapshotFolderHandle";

/* =========================================================
   Types
========================================================= */
type SnapshotFileHandle = FileSystemFileHandle;
type SnapshotDirHandle = FileSystemDirectoryHandle;

/* =========================================================
   Folder persistence
========================================================= */
export async function saveSnapshotFolder(
  handle: SnapshotDirHandle
): Promise<void> {
  await idbKeyval.set(
    SNAPSHOT_DB_KEY,
    handle
  );
}

export async function getSnapshotFolder():
  Promise<SnapshotDirHandle | null> {
  return (
    await idbKeyval.get<SnapshotDirHandle>(
      SNAPSHOT_DB_KEY
    )
  ) ?? null;
}

export async function clearSnapshotFolder():
  Promise<void> {
  await idbKeyval.del(SNAPSHOT_DB_KEY);
}

/* =========================================================
   Folder picker
========================================================= */
export async function selectSnapshotFolder():
  Promise<SnapshotDirHandle | null> {

  try {

    const handle =
      await window.showDirectoryPicker({
        mode: "read"
      });

    await saveSnapshotFolder(handle);

    return handle;

  } catch {
    return null;
  }
}

/* =========================================================
   Read JSON file
========================================================= */
export async function readSnapshotJSON<T>(
  relativePath: string
): Promise<T | null> {
  const root =
    await getSnapshotFolder();

  if (!root) return null;

  const parts =
    relativePath.split("/");

console.log("ROOT:", root.name);
console.log("RELATIVE PATH:", relativePath);
console.log("PARTS:", parts);

  let dir: SnapshotDirHandle = root;

  for (let i = 0; i < parts.length - 1; i++) {
console.log("Entering dir:", parts[i]);
    dir =
      await dir.getDirectoryHandle(parts[i]);
  }

  const fileHandle =
    await dir.getFileHandle(
      parts.at(-1)!
    );

  const file =
    await fileHandle.getFile();

  return JSON.parse(
    await file.text()
  );
}
