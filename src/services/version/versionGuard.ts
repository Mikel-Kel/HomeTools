import { checkAppVersionConsistency } from "./versionCheck";

let checked = false;

export async function ensureAppVersionChecked() {

  if (checked) return;

  try {

    await checkAppVersionConsistency();

    checked = true;

  } catch (err) {

    console.warn("Version check skipped:", err);

  }

}