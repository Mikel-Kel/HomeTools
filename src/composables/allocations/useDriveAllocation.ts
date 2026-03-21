import {
  listFiles,
  loadJSONFromFolder,
  saveJSONToFolder,
  deleteFileFromFolder
} from "@/services/driveAdapter";

import { useDrive } from "@/composables/useDrive";

export function useAllocationDrive() {

  async function moveReleasedToDraft(spendingId: string) {

    const releasedFolder = "allocations/released";
    const draftsFolder = "allocations/drafts";

    const filename = `${spendingId}.json`;

    // 1️⃣ retrouver le fichier released
    const releasedFiles = await listFiles(releasedFolder);

    const releasedFile = releasedFiles.find(
      f => f.name === filename
    );

    if (!releasedFile) {
      throw new Error("Released allocation not found");
    }

    // 2️⃣ lire son contenu
    const payload = await loadJSONFromFolder<any>(
      releasedFolder,
      filename
    );

    if (!payload) {
      throw new Error("Released allocation payload invalid");
    }

    // 3️⃣ écrire dans drafts
    await saveJSONToFolder(
      draftsFolder,
      filename,
      payload
    );

    // 4️⃣ supprimer l’original released
    await deleteFileFromFolder(
      releasedFolder,
      filename
    );

  }

  return {
    moveReleasedToDraft,
  };

}