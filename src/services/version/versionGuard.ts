import {
  AppVersionMismatchError,
  checkAppVersionConsistency,
} from "./versionCheck";

/* =========================
   Contrôle de version, une fois par session

   Lancé après chaque navigation (router/index.ts) tant qu'il
   n'a pas abouti, quel que soit le backend (en Local Drive,
   le routeur attend le choix du dossier).
   - version cohérente : plus de contrôle ;
   - app trop ancienne : erreur AppVersionMismatchError,
     signalée une seule fois ;
   - référence illisible (stockage pas encore prêt, fichier
     absent) : nouvel essai à la navigation suivante.
========================= */

let checked = false;

export async function ensureAppVersionChecked() {

  if (checked) return;

  try {

    await checkAppVersionConsistency();

    checked = true;

  } catch (err) {

    if (err instanceof AppVersionMismatchError) {
      checked = true;
      throw err;
    }

    console.warn("Version check skipped:", err);

  }

}
