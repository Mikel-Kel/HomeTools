import { detectStorageBackend } from "@/utils/storageBackend";

/**
 * Prefixes events created by a remote/PWA frontend.
 *
 * LOCAL_DRIVE:
 *   REA_...
 *   TOC_...
 *
 * OBJECT_STORAGE / GOOGLE_DRIVE:
 *   PWA-REA_...
 *   PWA-TOC_...
 */
export function prefixEventFileName(
  fileName: string
): string {
  const backend = detectStorageBackend();

  if (backend === "LOCAL_DRIVE") {
    return fileName;
  }

  return `PWA-${fileName}`;
}