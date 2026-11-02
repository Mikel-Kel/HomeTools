import { computed } from "vue";

import { useStorageBackend } from "@/composables/useStorageBackend";

import { getLocalDirectory } from "@/services/local/localDirectory";

/* =========================
   Public types
========================= */

export type StorageAccessStatus =
  | "READY"
  | "LOCAL_FOLDER_REQUIRED"
  | "OBJECT_STORAGE_READY";

/* =========================
   Composable
========================= */

export function useStorageAccess() {
  const {
    backend,
  } = useStorageBackend();

  /* =========================
     Backend helpers
  ========================= */

  const isLocalDrive = computed(
    () => backend.value === "LOCAL_DRIVE"
  );

  const isObjectStorage = computed(
    () => backend.value === "OBJECT_STORAGE"
  );

  /* =========================
     Local state
  ========================= */

  const localDirectoryReady = computed(
    () => !!getLocalDirectory()
  );

  /* =========================
     Global readiness
  ========================= */

  const storageReady = computed(() => {
    if (isObjectStorage.value) {
      return true;
    }

    return localDirectoryReady.value;
  });

  /* =========================
     Status
  ========================= */

  const storageStatus =
    computed<StorageAccessStatus>(() => {
      if (isObjectStorage.value) {
        return "OBJECT_STORAGE_READY";
      }

      return localDirectoryReady.value
        ? "READY"
        : "LOCAL_FOLDER_REQUIRED";
    });

  /* =========================
     Ensure readiness
  ========================= */

  async function ensureStorageReady():
    Promise<boolean> {

    return storageReady.value;
  }

  /* =========================
     Messages
  ========================= */

  const storageUnavailableMessage =
    computed(() => {
      switch (storageStatus.value) {
        case "LOCAL_FOLDER_REQUIRED":
          return "Local HomeTools folder is not selected.";

        default:
          return "";
      }
    });

  return {
    backend,

    isLocalDrive,
    isObjectStorage,

    localDirectoryReady,

    storageReady,
    storageStatus,
    storageUnavailableMessage,

    ensureStorageReady,
  };
}
