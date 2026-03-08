/* =========================================================
   Local directory manager (HomeTools)
========================================================= */

let localDirectory: FileSystemDirectoryHandle | null = null;

const DB_NAME = "hometools";
const STORE_NAME = "handles";
const STORAGE_KEY = "local-root";

/* =========================================================
   Accessors
========================================================= */

export function getLocalDirectory(): FileSystemDirectoryHandle | null {
  return localDirectory;
}

export function setLocalDirectory(
  dir: FileSystemDirectoryHandle | null
) {
  localDirectory = dir;
}

/* =========================================================
   Pick directory (user action)
========================================================= */

export async function pickLocalDirectory(): Promise<FileSystemDirectoryHandle> {

  const dir = await (window as any).showDirectoryPicker({
    mode: "readwrite",
    id: "hometools",
  });

  setLocalDirectory(dir);

  await saveLocalDirectory(dir);

  console.log("📁 Local directory selected");

  return dir;
}

/* =========================================================
   Restore directory at startup
========================================================= */

export async function restoreLocalDirectory(): Promise<FileSystemDirectoryHandle | null> {

  const db = await openDB();

  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);

  const handle =
    await requestToPromise<FileSystemDirectoryHandle | undefined>(
      store.get(STORAGE_KEY)
    );

  if (!handle) return null;

  const permission =
    await (handle as any).queryPermission({
      mode: "readwrite",
    });

  if (permission === "granted") {

    setLocalDirectory(handle);

    console.log("📁 Local directory restored");

    return handle;

  }

  console.log("📁 Local directory permission not granted");

  return null;
}

/* =========================================================
   Save directory handle
========================================================= */

async function saveLocalDirectory(
  handle: FileSystemDirectoryHandle
): Promise<void> {

  const db = await openDB();

  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  await requestToPromise(store.put(handle, STORAGE_KEY));

}

/* =========================================================
   IndexedDB open
========================================================= */

function openDB(): Promise<IDBDatabase> {

  return new Promise((resolve, reject) => {

    const req = indexedDB.open(DB_NAME, 1);

    req.onupgradeneeded = () => {

      const db = req.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }

    };

    req.onsuccess = () => resolve(req.result);

    req.onerror = () => reject(req.error);

  });

}

/* =========================================================
   Promise wrapper for IDB
========================================================= */

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {

  return new Promise((resolve, reject) => {

    req.onsuccess = () => resolve(req.result);

    req.onerror = () => reject(req.error);

  });

}