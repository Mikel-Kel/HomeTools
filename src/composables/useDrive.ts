/**
 * =========================================================
 * Drive session manager (SINGLE SOURCE OF TRUTH)
 * ---------------------------------------------------------
 * Règles :
 * 1. Un seul état global décrit la disponibilité Drive
 * 2. Toute erreur 401 force l’état EXPIRED
 * 3. Aucune vue / aucun repository ne doit tester Google
 *    directement (router + driveFetch s’en chargent)
 * 4. LOCAL_DRIVE est considéré comme CONNECTED
 * =========================================================
 */

import { ref, computed } from "vue";

import { connectGoogle, clearAccessToken } from "@/services/google/googleInit";

import { DRIVE_STATE, LOCAL_FOLDERS } from "@/config/driveState";
import type { HomeToolsDriveState } from "@/config/driveState";

import { useStorageBackend } from "@/composables/useStorageBackend";

/* =========================
   Types
========================= */

export type DriveStatus =
  | "DISCONNECTED"
  | "CONNECTED"
  | "EXPIRED";

/* =========================
   Shared reactive state
========================= */

const driveStatus = ref<DriveStatus>("DISCONNECTED");
const driveBusy = ref(false);
const driveError = ref<string | null>(null);
const driveState = ref<HomeToolsDriveState | null>(null);

const { backend } = useStorageBackend();

/* =========================
   LOCAL backend bootstrap
========================= */

if (backend.value === "LOCAL_DRIVE") {
  driveStatus.value = "CONNECTED";
  driveState.value = DRIVE_STATE;
}

/* =========================
   Public composable
========================= */

export function useDrive() {

  /**
   * Connect Google Drive
   */
  async function connect() {

    if (backend.value === "LOCAL_DRIVE") {
      // Local mode → already connected
      return;
    }

    if (driveBusy.value) return;

    driveBusy.value = true;
    driveError.value = null;

    try {

      await connectGoogle();

      driveState.value = DRIVE_STATE;

      driveStatus.value = "CONNECTED";

    } catch (e: any) {

      driveError.value = e?.message ?? String(e);

      driveStatus.value = "DISCONNECTED";

    } finally {

      driveBusy.value = false;

    }

  }

  /**
   * Force expiration
   * (called by googleDrive.ts on 401)
   */
  function expire(reason = "Drive session expired") {

    console.warn("🔐 Drive expired:", reason);

    if (backend.value === "LOCAL_DRIVE") {
      return;
    }

    clearAccessToken();

    driveStatus.value = "EXPIRED";

    driveState.value = null;

    driveError.value = reason;

  }

  /* =========================
     Folders helper
  ========================= */

  const folders = computed(() => {

    if (backend.value === "LOCAL_DRIVE") {
      return LOCAL_FOLDERS;
    }

    if (driveStatus.value === "CONNECTED" && driveState.value) {
      return driveState.value.folders;
    }

    return LOCAL_FOLDERS;

  });

  return {

    // state
    driveStatus,
    driveBusy,
    driveError,
    driveState,
    folders,

    // actions
    connect,
    expire,

  };

}