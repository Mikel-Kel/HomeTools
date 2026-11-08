import { isServerDevice } from "@/services/environment/environmentState";

import {
  getLocalItem,
  removeLocalItem,
  setLocalItem,
} from "@/services/environment/browserStorage";

/* =========================
   Types
========================= */

export type StorageBackend =
  | "LOCAL_DRIVE"
  | "OBJECT_STORAGE";

/* =========================
   Constants
========================= */

/* Mémorisé par environnement (browserStorage.ts). */
export const STORAGE_BACKEND_KEY =
  "storage-backend";

export const STORAGE_BACKENDS: StorageBackend[] = [
  "LOCAL_DRIVE",
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

  /*
    Serveur de l'environnement (le Mac) : dossier local ;
    l'utilisateur peut choisir S3 dans AuthenticationView.

    Autres appareils : Object Storage, seul possible.
  */
  return isServerDevice()
    ? "LOCAL_DRIVE"
    : "OBJECT_STORAGE";
}

/* =========================
   Stored preference
========================= */

export function getStoredStorageBackend():
  StorageBackend | null {

  const stored =
    getLocalItem(
      STORAGE_BACKEND_KEY
    );

  if (
    isStorageBackend(stored) &&
    (stored !== "LOCAL_DRIVE" || isServerDevice())
  ) {
    return stored;
  }

  /*
    Valeur d'un backend retiré (GOOGLE_DRIVE), ou Local
    Drive sur un appareil qui n'est pas le serveur :
    effacée, l'appareil reprend son défaut.
  */
  if (stored !== null) {
    removeLocalItem(
      STORAGE_BACKEND_KEY
    );
  }

  return null;
}

export function storeStorageBackend(
  backend: StorageBackend
): void {

  setLocalItem(
    STORAGE_BACKEND_KEY,
    backend
  );
}

export function clearStoredStorageBackend(): void {

  removeLocalItem(
    STORAGE_BACKEND_KEY
  );
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