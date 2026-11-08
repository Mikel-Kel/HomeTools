import { environmentEstablished } from "@/services/environment/environmentState";
import { getLocalDirectory } from "@/services/local/localDirectory";
import { confirmDialog } from "@/services/dialog/appDialog";
import { detectStorageBackend } from "@/utils/storageBackend";

import {
  AppVersionMismatchError,
  checkAppVersionConsistency,
} from "./versionCheck";

/* =========================
   Contrôle de version

   Compare l'app à la version de référence (AppParameters.json,
   écrite au déploiement), quel que soit le backend :
   - après chaque navigation (router/index.ts) ;
   - au retour de l'app au premier plan (iPad : l'app reste
     en mémoire et n'est pas rechargée) ;
   - toutes les 30 minutes tant que la page est visible.
   Au plus un contrôle abouti toutes les 5 minutes ; une
   référence illisible (stockage pas encore prêt, fichier
   absent) est réessayée au déclencheur suivant. Rien tant
   que l'environnement n'est pas établi
   (environmentGuard.ts) ; en Local Drive, rien non plus
   tant qu'aucun dossier n'est choisi.

   App trop ancienne : proposition de recharger. Le
   rechargement ajoute la version à l'adresse (?v=…) pour
   contourner le cache de index.html (GitHub Pages, 10 min).
   « Later » : plus de proposition pour cette version
   pendant 30 minutes.
========================= */

const CHECK_INTERVAL_MS =
  5 * 60 * 1000;

const PERIODIC_CHECK_MS =
  30 * 60 * 1000;

const PROMPT_AGAIN_AFTER_MS =
  30 * 60 * 1000;

let lastCheckAt = 0;

let running = false;

let declined: { version: string; at: number } | null = null;

function storageSelected(): boolean {

  return !(
    detectStorageBackend() === "LOCAL_DRIVE" &&
    !getLocalDirectory()
  );

}

function reloadApp(
  version: string
) {

  const url =
    new URL(window.location.href);

  url.searchParams.set("v", version);

  window.location.replace(url.toString());

}

async function proposeReload(
  err: AppVersionMismatchError
) {

  if (
    declined &&
    declined.version === err.referenceVersion &&
    Date.now() - declined.at < PROMPT_AGAIN_AFTER_MS
  ) {
    return;
  }

  const confirmed =
    await confirmDialog({
      title: "New version available",
      message:
        `This app is version ${err.appVersion}; version ${err.referenceVersion} has been deployed.\n\n` +
        "Reload to update the app.",
      confirmLabel: "Reload",
    });

  if (confirmed) {
    reloadApp(err.referenceVersion);
    return;
  }

  declined = {
    version: err.referenceVersion,
    at: Date.now(),
  };

}

export async function checkAppVersion() {

  if (
    running ||
    !environmentEstablished() ||
    Date.now() - lastCheckAt < CHECK_INTERVAL_MS ||
    !storageSelected()
  ) {
    return;
  }

  running = true;

  try {

    await checkAppVersionConsistency();

    lastCheckAt = Date.now();

  } catch (err) {

    if (err instanceof AppVersionMismatchError) {
      lastCheckAt = Date.now();
      await proposeReload(err);
    } else {
      console.warn("Version check skipped:", err);
    }

  } finally {

    running = false;

  }

}

/* Déclencheurs hors navigation, posés une fois au démarrage (main.ts). */
export function startVersionWatch() {

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void checkAppVersion();
    }
  });

  window.setInterval(() => {
    if (document.visibilityState === "visible") {
      void checkAppVersion();
    }
  }, PERIODIC_CHECK_MS);

}
