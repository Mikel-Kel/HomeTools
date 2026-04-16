import {
  listFiles,
  loadJSONFromFolder,
  saveJSONToFolder,
  deleteFileFromFolder
} from "@/services/driveAdapter";

interface DraftRecord {
  id: string;
}

export async function releaseDraftsBatch(
  drafts: DraftRecord[]
) {
  const draftsFolder = "allocations/drafts";
  const releasedFolder = "allocations/released";

  const draftFiles = await listFiles(draftsFolder);

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

    if (raw.toProcess !== true) continue;

    await saveJSONToFolder(
      releasedFolder,
      filename,
      {
        ...raw,
        releasedAt: new Date().toISOString(),
        processed: true,
        toProcess: false,
      }
    );

    await deleteFileFromFolder(
      draftsFolder,
      filename
    );
  }
}