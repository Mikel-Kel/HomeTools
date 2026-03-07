export type DeviceType =
  | "Mac"
  | "iPad"
  | "iPhone"
  | "other";

export function detectDevice(): DeviceType {

  const ua = navigator.userAgent.toLowerCase();

  if (ua.includes("macintosh")) {
    return "Mac";
  }

  if (ua.includes("ipad")) {
    return "iPad";
  }

  if (ua.includes("iphone")) {
    return "iPhone";
  }

  return "other";
}

export function isPWA(): boolean {

  const standalone =
    (window.navigator as any).standalone === true;

  const displayMode =
    window.matchMedia("(display-mode: standalone)").matches;

  return standalone || displayMode;
}