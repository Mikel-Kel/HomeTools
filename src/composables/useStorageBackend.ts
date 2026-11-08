import { readonly, ref } from "vue";

import {
  detectStorageBackend,
  storeStorageBackend,
  clearStoredStorageBackend,
} from "@/utils/storageBackend";

import type {
  StorageBackend,
} from "@/utils/storageBackend";

/* =========================
   Shared state

   Lu au chargement avant que l'environnement soit connu
   (défaut de l'appareil), puis relu par main.ts dès que
   le stockage du navigateur est prêt.
========================= */

const backend = ref<StorageBackend>(
  detectStorageBackend()
);

export function syncStorageBackend(): void {

  backend.value =
    detectStorageBackend();
}

/* =========================
   Composable
========================= */

export function useStorageBackend() {

  function setBackend(
    value: StorageBackend
  ): void {

    backend.value = value;
    storeStorageBackend(value);
  }

  function resetBackend(): void {

    clearStoredStorageBackend();

    backend.value =
      detectStorageBackend();
  }

  function isBackend(
    value: StorageBackend
  ): boolean {

    return backend.value === value;
  }

  return {
    backend: readonly(backend),
    setBackend,
    resetBackend,
    isBackend,
  };
}