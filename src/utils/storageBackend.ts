import { detectDevice } from "@/utils/deviceDetection";

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

  const device = detectDevice();

  /*
    Mac:
    - conserve le fonctionnement local actuel
    - l'utilisateur pourra sélectionner S3
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

  const stored =
    getLocalItem(
      STORAGE_BACKEND_KEY
    );

  if (isStorageBackend(stored)) {
    return stored;
  }

  /*
    Valeur d'un backend retiré (GOOGLE_DRIVE) :
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