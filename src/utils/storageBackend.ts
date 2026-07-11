import { detectDevice } from "@/utils/deviceDetection";

/* =========================
   Types
========================= */

export type StorageBackend =
  | "LOCAL_DRIVE"
  | "GOOGLE_DRIVE"
  | "OBJECT_STORAGE";

/* =========================
   Constants
========================= */

export const STORAGE_BACKEND_KEY =
  "hometools-storage-backend";

export const STORAGE_BACKENDS: StorageBackend[] = [
  "LOCAL_DRIVE",
  "GOOGLE_DRIVE",
  "OBJECT_STORAGE",
];

/* =========================
   Validation
========================= */

export function isStorageBackend(
  value: unknown
): value is StorageBackend {
  return (
    typeof value === "string" &&
    STORAGE_BACKENDS.includes(
      value as StorageBackend
    )
  );
}

/* =========================
   Default backend
========================= */

export function getDefaultStorageBackend():
  StorageBackend {

  const device = detectDevice();

  /*
    Mac:
    - conserve le fonctionnement local actuel
    - l'utilisateur pourra sélectionner S3 ou Drive
      dans AuthenticationView

    iPad / autres appareils:
    - Object Storage devient la cible par défaut
  */
  if (device === "Mac") {
    return "LOCAL_DRIVE";
  }

  return "OBJECT_STORAGE";
}

/* =========================
   Stored preference
========================= */

export function getStoredStorageBackend():
  StorageBackend | null {

  try {
    const stored =
      window.localStorage.getItem(
        STORAGE_BACKEND_KEY
      );

    return isStorageBackend(stored)
      ? stored
      : null;

  } catch {
    return null;
  }
}

export function storeStorageBackend(
  backend: StorageBackend
): void {

  try {
    window.localStorage.setItem(
      STORAGE_BACKEND_KEY,
      backend
    );
  } catch (err) {
    console.warn(
      "Unable to persist storage backend",
      err
    );
  }
}

export function clearStoredStorageBackend(): void {
  try {
    window.localStorage.removeItem(
      STORAGE_BACKEND_KEY
    );
  } catch (err) {
    console.warn(
      "Unable to clear storage backend",
      err
    );
  }
}

/* =========================
   Detection
========================= */

export function detectStorageBackend():
  StorageBackend {

  return (
    getStoredStorageBackend() ??
    getDefaultStorageBackend()
  );
}