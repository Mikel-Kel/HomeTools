import { checkAppVersionConsistency } from "./versionCheck";
import { useDrive } from "@/composables/useDrive";

let checked = false;

export async function ensureAppVersionChecked() {
  if (checked) return;

  const { driveStatus } = useDrive();

  // Drive pas encore prêt → on ne fait rien
  if (driveStatus.value !== "CONNECTED") return;

  await checkAppVersionConsistency();
  checked = true;
}