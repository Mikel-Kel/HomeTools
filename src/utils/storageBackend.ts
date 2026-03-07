import { detectDevice } from "@/utils/deviceDetection";

export type StorageBackend =
  | "LOCAL_DRIVE"
  | "GOOGLE_DRIVE";

export function detectStorageBackend(): StorageBackend {

  const device = detectDevice();

  if (device === "Mac") {
    return "LOCAL_DRIVE";
  }

  return "GOOGLE_DRIVE";
}