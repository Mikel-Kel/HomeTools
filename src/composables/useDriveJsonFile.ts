import { ref } from "vue";
import {
  loadJSONFromFolder,
  saveJSONToFolder,
  listFiles
} from "@/services/google/driveRepository";

/* =========================
  Types locaux
========================= */

export type DriveFile = {
  id?: string;
  name: string;
  mimeType?: string;
  modifiedTime?: string;
};

/* =========================
  Composable
========================= */

export function useDriveJsonFile(
  folderId: string,
  filename: string
) {

  /* =========================
    State
  ========================= */

  const fileId = ref<string | null>(null);
  const busy = ref(false);
  const error = ref<string | null>(null);

  /* =========================
    Resolve file id
  ========================= */

  async function resolveFileId(): Promise<string | null> {

    if (fileId.value) return fileId.value;

    const files: DriveFile[] = await listFiles(folderId);

    const file = files.find(
      (f: DriveFile) => f.name === filename
    );

    if (!file) return null;

    fileId.value = file.id ?? file.name;
    return fileId.value;

  }

  /* =========================
    Load JSON
  ========================= */

  async function load(): Promise<any | null> {

    busy.value = true;
    error.value = null;

    try {

      return await loadJSONFromFolder(folderId, filename);

    }
    catch (e: unknown) {

      error.value =
        e instanceof Error ? e.message : String(e);

      throw e;

    }
    finally {

      busy.value = false;

    }

  }

  /* =========================
    Save JSON
  ========================= */

  async function save(data: any): Promise<void> {

    busy.value = true;
    error.value = null;

    try {

      await saveJSONToFolder(
        folderId,
        filename,
        data
      );

      // ensure id cached
      if (!fileId.value) {
        const id = await resolveFileId();
        fileId.value = id;
      }

    }
    catch (e: unknown) {

      error.value =
        e instanceof Error ? e.message : String(e);

      throw e;

    }
    finally {

      busy.value = false;

    }

  }

  /* =========================
    Public API
  ========================= */

  return {
    busy,
    error,
    load,
    save,
  };

}