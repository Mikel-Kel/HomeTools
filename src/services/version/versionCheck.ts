import { loadAppVersion } from "./appVersion";

export async function checkAppVersionConsistency() {
  const appVersion = __APP_VERSION__;
  const driveVersion = await loadAppVersion();

  if (driveVersion !== appVersion) {
    throw new Error(
      `Version mismatch\n\nCurrent App: ${appVersion}\nReference App: ${driveVersion}`
    );
  }

  return appVersion;
}