import { ref } from "vue";
import { connectGoogle } from "@/services/google/googleInit";
import { ensureHomeToolsStructure } from "@/services/google/driveBootstrap";
import type { HomeToolsDriveState } from "@/services/google/driveBootstrap";

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
      // 1️⃣ Auth Google
      await connectGoogle();

      // 2️⃣ Bootstrap HomeTools Drive
      driveState.value = await ensureHomeToolsStructure();

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