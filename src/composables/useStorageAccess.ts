import { computed } from "vue";

import { useDrive } from "@/composables/useDrive";
import { useStorageBackend } from "@/composables/useStorageBackend";

import { getLocalDirectory } from "@/services/local/localDirectory";

/* =========================
   Public types
========================= */

export type StorageAccessStatus =
  | "READY"
  | "LOCAL_FOLDER_REQUIRED"
  | "GOOGLE_CONNECTING"
  | "GOOGLE_DISCONNECTED"
  | "GOOGLE_EXPIRED"
  | "OBJECT_STORAGE_READY";

/* =========================
   Composable
========================= */

export function useStorageAccess() {
  const {
    backend,
  } = useStorageBackend();

  const {
    driveStatus,
    driveState,
    driveBusy,
    connect,
  } = useDrive();

  /* =========================
     Backend helpers
  ========================= */

  const isLocalDrive = computed(
    () => backend.value === "LOCAL_DRIVE"
  );

  const isGoogleDrive = computed(
    () => backend.value === "GOOGLE_DRIVE"
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
     Google state
  ========================= */

  const googleDriveReady = computed(() => {
    return (
      driveStatus.value === "CONNECTED" &&
      !!driveState.value
    );
  });

  /* =========================
     Global readiness
  ========================= */

  const storageReady = computed(() => {
    if (isObjectStorage.value) {
      return true;
    }

    if (isLocalDrive.value) {
      return localDirectoryReady.value;
    }

    return googleDriveReady.value;
  });

  /* =========================
     Status
  ========================= */

  const storageStatus =
    computed<StorageAccessStatus>(() => {
      if (isObjectStorage.value) {
        return "OBJECT_STORAGE_READY";
      }

      if (isLocalDrive.value) {
        return localDirectoryReady.value
          ? "READY"
          : "LOCAL_FOLDER_REQUIRED";
      }

      if (driveStatus.value === "EXPIRED") {
        return "GOOGLE_EXPIRED";
      }

      if (driveBusy.value) {
        return "GOOGLE_CONNECTING";
      }

      if (googleDriveReady.value) {
        return "READY";
      }

      return "GOOGLE_DISCONNECTED";
    });

  /* =========================
     Ensure readiness
  ========================= */

  async function ensureStorageReady():
    Promise<boolean> {

    if (storageReady.value) {
      return true;
    }

    if (isObjectStorage.value) {
      return true;
    }

    if (isLocalDrive.value) {
      return localDirectoryReady.value;
    }

    if (
      driveStatus.value === "EXPIRED"
    ) {
      return false;
    }

    try {
      await connect();
    } catch {
      return false;
    }

    return googleDriveReady.value;
  }

  /* =========================
     Messages
  ========================= */

  const storageUnavailableMessage =
    computed(() => {
      switch (storageStatus.value) {
        case "LOCAL_FOLDER_REQUIRED":
          return "Local HomeTools folder is not selected.";

        case "GOOGLE_CONNECTING":
          return "Connecting to Google Drive…";

        case "GOOGLE_EXPIRED":
          return "Your Google Drive session has expired.";

        case "GOOGLE_DISCONNECTED":
          return "Google Drive is not connected.";

        default:
          return "";
      }
    });

  return {
    backend,

    isLocalDrive,
    isGoogleDrive,
    isObjectStorage,

    localDirectoryReady,
    googleDriveReady,

    storageReady,
    storageStatus,
    storageUnavailableMessage,

    ensureStorageReady,
  };
}