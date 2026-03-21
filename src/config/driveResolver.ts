import { findFolderByName } from "@/services/google/googleDrive";
import { useDrive } from "@/composables/useDrive";
import { DRIVE_STRUCTURE } from "@/config/driveConfig";

/* =========================
   Cache
========================= */
export const folderCache = new Map<string, string>();

/* =========================
   Resolve folder ID from path
========================= */
export async function resolveFolderId(path: string): Promise<string> {

  // cache direct
  if (folderCache.has(path)) {
    return folderCache.get(path)!;
  }

  const { driveState } = useDrive();

  if (!driveState.value?.rootId) {
    throw new Error("Drive not initialized");
  }

  let parentId = driveState.value.rootId;
  const parts = path.split("/");

  for (const part of parts) {

    const cacheKey = `${parentId}/${part}`;

    // cache intermédiaire
    if (folderCache.has(cacheKey)) {
      parentId = folderCache.get(cacheKey)!;
      continue;
    }

    const folder = await findFolderByName(parentId, part);

    if (!folder) {
      throw new Error(`Folder not found: ${part}`);
    }

    folderCache.set(cacheKey, folder.id);
    parentId = folder.id;
  }

  // cache final
  folderCache.set(path, parentId);

  return parentId;
}

/* =========================
   Preload full structure
========================= */
export async function preloadDriveStructure(): Promise<void> {

  async function walk(node: any, prefix = ""): Promise<void> {

    for (const key in node) {

      const path = prefix ? `${prefix}/${key}` : key;

      // Résout (et met en cache)
      await resolveFolderId(path);

      // Descend si sous-dossier
      if (node[key] !== null) {
        await walk(node[key], path);
      }
    }
  }

  await walk(DRIVE_STRUCTURE);
}