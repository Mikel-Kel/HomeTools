import { ref } from "vue";
import { connectGoogle } from "@/services/google/googleInit";
import { DRIVE_STATE } from "@/config/driveState";
import type { HomeToolsDriveState } 
  from "@/config/driveState";
  
/* =========================
   Shared state
========================= */
const driveReady = ref(false);
const driveBusy = ref(false);
const driveError = ref<string | null>(null);
const driveState = ref<HomeToolsDriveState | null>(null);

export function useDrive() {
  async function connect() {
    if (driveReady.value || driveBusy.value) return;

    driveBusy.value = true;
    driveError.value = null;

    try {
      // 1️⃣ Auth Google uniquement
      await connectGoogle();

      // 2️⃣ Charger la config Drive (déjà existante)
      driveState.value = DRIVE_STATE;

      driveReady.value = true;
    } catch (e: any) {
      driveError.value = e?.message ?? String(e);
      driveReady.value = false;
    } finally {
      driveBusy.value = false;
    }
  }

  return {
    connect,
    driveReady,
    driveBusy,
    driveError,
    driveState,
  };
}