/**
 * =========================================================
 * Drive session manager (SINGLE SOURCE OF TRUTH)
 * ---------------------------------------------------------
 * Règles :
 * 1. Un seul état global décrit la disponibilité Drive
 * 2. Toute erreur 401 force l’état EXPIRED
 * 3. Aucune vue / aucun repository ne doit tester Google
 *    directement (router + driveFetch s’en chargent)
 * =========================================================
 */
import { ref } from "vue";
import { connectGoogle } from "@/services/google/googleInit";
import { DRIVE_STATE } from "@/config/driveState";
/* =========================
   Shared reactive state
========================= */
const driveStatus = ref("DISCONNECTED");
const driveBusy = ref(false);
const driveError = ref(null);
const driveState = ref(null);
/* =========================
   Public composable
========================= */
export function useDrive() {
    /**
     * Connecte Google Drive
     * → Auth Google
     * → Charge la config Drive (folders connus)
     */
    async function connect() {
        if (driveBusy.value)
            return;
        driveBusy.value = true;
        driveError.value = null;
        try {
            await connectGoogle();
            driveState.value = DRIVE_STATE;
            driveStatus.value = "CONNECTED";
        }
        catch (e) {
            driveError.value = e?.message ?? String(e);
            driveStatus.value = "DISCONNECTED";
        }
        finally {
            driveBusy.value = false;
        }
    }
    /**
     * Forcer l’expiration (appelé UNIQUEMENT par googleDrive.ts)
     */
    function expire(reason = "Drive session expired") {
        console.warn("🔐 Drive expired:", reason);
        driveStatus.value = "EXPIRED";
        driveError.value = reason;
    }
    return {
        // state
        driveStatus,
        driveBusy,
        driveError,
        driveState,
        // actions
        connect,
        expire,
    };
}
