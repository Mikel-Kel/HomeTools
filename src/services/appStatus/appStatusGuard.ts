import { ref, shallowRef } from "vue";

import { loadJSONFromFolder } from "@/services/driveAdapter";
import { ProxyError } from "@/services/proxy/proxyClient";
import { detectStorageBackend, type StorageBackend } from "@/utils/storageBackend";

import {
  APP_STATUS_FILE,
  APP_STATUS_FOLDER,
  readAppStatus,
} from "@/contracts/appStatus";

/* =========================
   Disponibilité de l'app

   Bloque l'app (AppUnavailable.vue) quand :
   - settings/appStatus.json annonce une maintenance
     (contrat : ../Backend/docs/app-status-contract.md) ;
   - en stockage objet, le proxy du Mac ne répond pas.
   Le backend Local Drive (le Mac) n'est jamais bloqué.

   Contrôle après chaque navigation (router/index.ts), au
   retour au premier plan et toutes les 5 minutes ; toutes
   les minutes tant que l'app est bloquée. Au plus un
   contrôle par minute, sauf « Retry » et changement de
   stockage. Une autre erreur de
   lecture ne change rien et est réessayée au déclencheur
   suivant.
========================= */

export type AppBlock =
  | { kind: "maintenance"; message: string; since: string | null }
  | { kind: "unreachable" };

const MIN_INTERVAL_MS =
  60 * 1000;

const PERIODIC_CHECK_MS =
  5 * 60 * 1000;

/* null : app disponible. */
export const appBlock =
  shallowRef<AppBlock | null>(null);

export const appStatusChecking =
  ref(false);

let lastCheckAt = 0;

/* Stockage du dernier contrôle : en changer relance le contrôle. */
let lastBackend: StorageBackend | null = null;

export async function checkAppStatus(
  force = false
) {

  const backend =
    detectStorageBackend();

  if (backend === "LOCAL_DRIVE") {
    appBlock.value = null;
    lastBackend = backend;
    return;
  }

  if (
    appStatusChecking.value ||
    (
      !force &&
      backend === lastBackend &&
      Date.now() - lastCheckAt < MIN_INTERVAL_MS
    )
  ) {
    return;
  }

  appStatusChecking.value = true;
  lastBackend = backend;

  try {

    const status =
      readAppStatus(
        await loadJSONFromFolder<unknown>(
          APP_STATUS_FOLDER,
          APP_STATUS_FILE
        )
      );

    appBlock.value =
      status.maintenance
        ? {
            kind: "maintenance",
            message: status.message,
            since: status.since,
          }
        : null;

    lastCheckAt = Date.now();

  } catch (err) {

    if (
      err instanceof ProxyError &&
      err.kind !== "config"
    ) {
      appBlock.value = { kind: "unreachable" };
      lastCheckAt = Date.now();
    } else {
      console.warn("App status check skipped:", err);
    }

  } finally {

    appStatusChecking.value = false;

  }

}

/* Déclencheurs hors navigation, posés une fois au démarrage (main.ts). */
export function startAppStatusWatch() {

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void checkAppStatus();
    }
  });

  window.setInterval(() => {
    if (
      document.visibilityState === "visible" &&
      (appBlock.value !== null || Date.now() - lastCheckAt >= PERIODIC_CHECK_MS)
    ) {
      void checkAppStatus();
    }
  }, MIN_INTERVAL_MS);

}
