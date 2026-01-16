import { findFolderByName, writeJSON, listFilesInFolder } from "@/services/google/googleDrive";
import { DRIVE_FOLDERS, HOMETOOLS_ROOT_NAME } from "./drivePaths";

export type HomeToolsDriveState = {
  rootId: string;
  folders: Record<keyof typeof DRIVE_FOLDERS, string>;
};

export async function ensureHomeToolsStructure(): Promise<HomeToolsDriveState> {
  // 1. Trouver ou créer HomeTools à la racine Drive
  let root = await findFolderByName("root", HOMETOOLS_ROOT_NAME);

  if (!root) {
    const id = await writeJSON(
      "root",
      HOMETOOLS_ROOT_NAME,
      {},
    );
    root = { id, name: HOMETOOLS_ROOT_NAME, mimeType: "application/vnd.google-apps.folder" };
  }

  const folders: any = {};

  // 2. Sous-dossiers métier
  for (const key in DRIVE_FOLDERS) {
    const name = DRIVE_FOLDERS[key as keyof typeof DRIVE_FOLDERS];
    let sub = await findFolderByName(root.id, name);

    if (!sub) {
      const id = await writeJSON(root.id, name, {});
      sub = { id, name, mimeType: "application/vnd.google-apps.folder" };
    }

    folders[key] = sub.id;
  }

  return {
    rootId: root.id,
    folders,
  };
}