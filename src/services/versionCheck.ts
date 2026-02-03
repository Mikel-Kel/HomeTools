export async function checkAppVersionConsistency() {
  // version injectée par Vite
  const appVersion = __APP_VERSION__;

  const res = await fetch("/settings/AppVersion.json", {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("AppVersion.json not found");
  }

  const { version } = await res.json();

  if (version !== appVersion) {
    throw new Error(
      `Version mismatch\n\nApp: ${appVersion}\nSettings: ${version}`
    );
  }

  return version;
}