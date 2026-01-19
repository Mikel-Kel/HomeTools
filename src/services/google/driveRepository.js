import { readJSON, writeJSON, listFilesInFolder } from "@/services/google/googleDrive";
export async function loadJSONFromFolder(folderId, filename) {
    const files = await listFilesInFolder(folderId);
    const file = files.find(f => f.name === filename);
    if (!file)
        return null;
    return readJSON(file.id);
}
export async function saveJSONToFolder(folderId, filename, data) {
    const files = await listFilesInFolder(folderId);
    const existing = files.find(f => f.name === filename);
    await writeJSON(folderId, filename, data, existing?.id);
}
