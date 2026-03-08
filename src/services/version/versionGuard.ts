import { checkAppVersionConsistency } from "./versionCheck";
import { getLocalDirectory } from "@/services/local/localDirectory";

let checked = false;

export async function ensureAppVersionChecked() {

  if (checked) return;

  // LOCAL backend → attendre sélection du dossier
  if (!getLocalDirectory()) {
    return;
  }

  try {

    await checkAppVersionConsistency();

    checked = true;

  } catch (err) {

    console.warn("Version check skipped:", err);

  }

}