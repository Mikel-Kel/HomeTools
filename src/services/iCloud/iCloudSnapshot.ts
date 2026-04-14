import * as idbKeyval from "idb-keyval";

const SNAPSHOT_DB_KEY = "icloudSnapshotFolderHandle";

/* =========================================================
   Types
========================================================= */
export type SnapshotDirHandle =
  FileSystemDirectoryHandle;

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
   Read JSON from persisted handle
========================================================= */
export async function readSnapshotJSON<T>(
  relativePath: string
): Promise<T | null> {
  const root =
    await getSnapshotFolder();

  if (!root) return null;

  return await readSnapshotJSONFromHandle<T>(
    root,
    relativePath
  );
}

/* =========================================================
   Read JSON from provided handle
========================================================= */
export async function readSnapshotJSONFromHandle<T>(
  root: SnapshotDirHandle,
  relativePath: string
): Promise<T | null> {

  const parts =
    relativePath.split("/");

  let dir = root;

  for (let i = 0; i < parts.length - 1; i++) {
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