import {
  listFiles,
  loadJSONFromFolder,
  saveJSONToFolder,
  deleteFileFromFolder
} from "@/services/google/driveRepository";

import { useDrive } from "@/composables/useDrive";

interface DraftRecord {
  id: string;
}

export async function releaseDraftsBatch(
  drafts: DraftRecord[]
) {

  const { folders } = useDrive();

  const draftsFolder =
    folders.value.allocations.drafts;

  const releasedFolder =
    folders.value.allocations.released;

  const draftFiles = await listFiles(draftsFolder);
  const releasedFiles = await listFiles(releasedFolder);

  for (const r of drafts) {

    const filename = `${r.id}.json`;

    const draft = draftFiles.find(
      f => f.name === filename
    );

    if (!draft) continue;

    const raw = await loadJSONFromFolder<any>(
      draftsFolder,
      filename
    );

    if (!raw || !Array.isArray(raw.allocations)) continue;

    const existingReleased = releasedFiles.find(
      f => f.name === filename
    );

    await saveJSONToFolder(
      releasedFolder,
      filename,
      {
        ...raw,
        releasedAt: new Date().toISOString(),
        processed: false,
      }
    );

    await deleteFileFromFolder(
      draftsFolder,
      filename
    );

  }

}