import { listFilesInFolder, readJSON, writeJSON, deleteFile, } from "@/services/google/googleDrive";
import { useDrive } from "@/composables/useDrive";
export function useAllocationDrive() {
    const { driveState } = useDrive();
    async function moveReleasedToDraft(spendingId) {
        if (!driveState.value)
            throw new Error("Drive not ready");
        const releasedFolder = driveState.value.folders.allocations.released;
        const draftsFolder = driveState.value.folders.allocations.drafts;
        const filename = `${spendingId}.json`;
        // 1️⃣ retrouver le fichier released
        const releasedFiles = await listFilesInFolder(releasedFolder);
        const releasedFile = releasedFiles.find(f => f.name === filename);
        if (!releasedFile) {
            throw new Error("Released allocation not found");
        }
        // 2️⃣ lire son contenu
        const payload = await readJSON(releasedFile.id);
        // 3️⃣ écrire dans drafts (⚠️ overwrite autorisé)
        const draftFiles = await listFilesInFolder(draftsFolder);
        const existingDraft = draftFiles.find(f => f.name === filename);
        await writeJSON(draftsFolder, filename, payload, existingDraft?.id);
        // 4️⃣ supprimer l’original released
        await deleteFile(releasedFile.id);
    }
    return {
        moveReleasedToDraft,
    };
}
