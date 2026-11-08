import {
  envStorageKey,
  LEGACY_ENV,
} from "@/services/environment/browserStorage";

/* =========================================================
   Local directory manager (HomeTools)

   Un dossier par environnement : le handle est rangé en
   IndexedDB sous ht:<envId>:local-root (contrat
   multi-environnements, §10).
========================================================= */

let localDirectory: FileSystemDirectoryHandle | null = null;

const DB_NAME = "hometools";
const STORE_NAME = "handles";
const HANDLE_NAME = "local-root";

/* Clé d'avant le contrat, migrée sous ht:hometools:. */
const LEGACY_KEY = HANDLE_NAME;

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

  if (!("showDirectoryPicker" in window)) {
    throw new Error(
      "BROWSER_NOT_SUPPORTED"
    );
  }

  const dir = await (window as any).showDirectoryPicker({
    mode: "readwrite",
    id: "hometools",
  });

  setLocalDirectory(dir);

  await saveLocalDirectory(dir);

  return dir;
}

/* =========================================================
   Restore directory at startup
========================================================= */

export async function restoreLocalDirectory(): Promise<FileSystemDirectoryHandle | null> {

  const key = envStorageKey(HANDLE_NAME);

  if (!key) return null;

  const db = await openDB();

  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);

  const handle =
    await requestToPromise<FileSystemDirectoryHandle | undefined>(
      store.get(key)
    );

  if (!handle) return null;

  const permission =
    await (handle as any).queryPermission({
      mode: "readwrite",
    });

  if (permission === "granted") {

    setLocalDirectory(handle);

    return handle;

  }

  return null;
}

/* =========================================================
   Save directory handle
========================================================= */

async function saveLocalDirectory(
  handle: FileSystemDirectoryHandle
): Promise<void> {

  const key = envStorageKey(HANDLE_NAME);

  if (!key) {
    throw new Error("ENVIRONMENT_UNKNOWN");
  }

  const db = await openDB();

  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  await requestToPromise(store.put(handle, key));

}

/* =========================================================
   Migrate the pre-contract handle

   Unique et sans drapeau : déplacé sous ht:hometools: si
   cette clé est libre, puis effacé. Une seule transaction.
========================================================= */

export async function migrateLegacyDirectoryHandle(): Promise<void> {

  const db = await openDB();

  await new Promise<void>((resolve, reject) => {

    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const target = `ht:${LEGACY_ENV}:${HANDLE_NAME}`;

    const legacy = store.get(LEGACY_KEY);

    legacy.onsuccess = () => {

      if (legacy.result === undefined) return;

      const existing = store.count(target);

      existing.onsuccess = () => {

        if (existing.result === 0) {
          store.put(legacy.result, target);
        }

        store.delete(LEGACY_KEY);

      };

    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);

  });

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