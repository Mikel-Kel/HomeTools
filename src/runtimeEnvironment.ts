import { detectDevice } from "@/utils/deviceDetection";
import { isPWA } from "@/utils/deviceDetection";

export type HomeToolsRuntime =
  | "MAC_LOCAL"
  | "IOS_PWA"
  | "WEB";

export function detectRuntime(): HomeToolsRuntime {

  const device = detectDevice();

  if (device === "Mac") {
    return "MAC_LOCAL";
  }

  if ((device === "iPad" || device === "iPhone") && isPWA()) {
    return "IOS_PWA";
  }

  return "WEB";
}