import { loadAppVersion } from "./appVersion";

/**
 * Compare two semantic versions (x.y.z)
 * @returns -1 if a < b, 0 if equal, 1 if a > b
 */
function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);

  const len = Math.max(pa.length, pb.length);

  for (let i = 0; i < len; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;

    if (na > nb) return 1;
    if (na < nb) return -1;
  }

  return 0;
}

export async function checkAppVersionConsistency() {
  const appVersion = __APP_VERSION__;
  const driveVersion = await loadAppVersion();

  // ❌ App plus ancienne que la référence → erreur
  if (compareVersions(appVersion, driveVersion) < 0) {
    throw new Error(
      `Version mismatch\n\nCurrent App: ${appVersion}\nReference App: ${driveVersion}`
    );
  }

  // ✅ App = ou > référence → OK
  return appVersion;
}