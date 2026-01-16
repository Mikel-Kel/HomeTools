import { readJSON, writeJSON, listFilesInFolder } from "@/services/google/googleDrive";

export async function loadJSONFromFolder<T>(
  folderId: string,
  filename: string
): Promise<T | null> {
  const files = await listFilesInFolder(folderId);
  const file = files.find(f => f.name === filename);
  if (!file) return null;

  return readJSON<T>(file.id);
}

export async function saveJSONToFolder(
  folderId: string,
  filename: string,
  data: any
): Promise<void> {
  const files = await listFilesInFolder(folderId);
  const existing = files.find(f => f.name === filename);

  await writeJSON(folderId, filename, data, existing?.id);
}