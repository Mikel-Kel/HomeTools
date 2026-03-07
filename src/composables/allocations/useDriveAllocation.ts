import {
  listFiles,
  loadJSONFromFolder,
  saveJSONToFolder,
  deleteFileFromFolder
} from "@/services/google/driveRepository";

import { useDrive } from "@/composables/useDrive";

export function useAllocationDrive() {

  const { folders } = useDrive();

  async function moveReleasedToDraft(spendingId: string) {

    const releasedFolder = folders.value.allocations.released;
    const draftsFolder = folders.value.allocations.drafts;

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