export type DeviceType =
  | "Mac"
  | "iPad"
  | "iPhone"
  | "Other";

export function detectDevice(): DeviceType {

  const ua = navigator.userAgent.toLowerCase();
  const touch = navigator.maxTouchPoints || 0;

  /* iPhone */
  if (ua.includes("iphone")) {
    return "iPhone";
  }

  /* iPad (Safari/PWA se présente comme Mac) */
  if (ua.includes("macintosh") && touch > 1) {
    return "iPad";
  }

  /* Mac */
  if (ua.includes("macintosh")) {
    return "Mac";
  }

  return "Other";
}

export function isPWA(): boolean {

  const standalone =
    (window.navigator as any).standalone === true;

  const displayMode =
    window.matchMedia("(display-mode: standalone)").matches;

  return standalone || displayMode;
}