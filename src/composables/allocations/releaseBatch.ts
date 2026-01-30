import {
  listFilesInFolder,
  readJSON,
  writeJSON,
  deleteFile,
} from "@/services/google/googleDrive";
import { useDrive } from "@/composables/useDrive";

interface DraftRecord {
  id: string;
}

export async function releaseDraftsBatch(
  drafts: DraftRecord[]
) {
  const { driveState } = useDrive();

  const draftsFolder =
    driveState.value!.folders.allocations.drafts;
  const releasedFolder =
    driveState.value!.folders.allocations.released;

  const draftFiles = await listFilesInFolder(draftsFolder);
  const releasedFiles = await listFilesInFolder(releasedFolder);

  for (const r of drafts) {
    const filename = `${r.id}.json`;

    const draft = draftFiles.find(
      f => f.name === filename
    );
    if (!draft) continue;

    const raw = await readJSON<any>(draft.id);
    if (!raw || !Array.isArray(raw.allocations)) continue;

    const existingReleased = releasedFiles.find(
      f => f.name === filename
    );

    await writeJSON(
      releasedFolder,
      filename,
      {
        ...raw,
        releasedAt: new Date().toISOString(),
        processed: false,
      },
      existingReleased?.id
    );

    await deleteFile(draft.id);
  }
}