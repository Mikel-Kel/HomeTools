import { ref, computed } from "vue";
import type { Ref, ComputedRef } from "vue";
import {
  listFilesInFolder,
  findFolderByName,
  type DriveItem,
} from "@/services/google/googleDrive";

/* =========================
   Public interface
========================= */
export interface UseDriveFolder {
  folder: Ref<DriveItem | null>;
  files: ComputedRef<DriveItem[]>;
  busy: Ref<boolean>;
  error: Ref<string | null>;

  refresh: () => Promise<void>;
}

/* =========================
   Composable
========================= */
export function useDriveFolder(
  parentId: string,
  folderName?: string
): UseDriveFolder {
  const folder = ref<DriveItem | null>(null);

  const _files = ref<DriveItem[]>([]);
  const files = computed(() => _files.value);

  const busy = ref(false);
  const error = ref<string | null>(null);

  /* =========================
     Resolve folder id
  ========================= */
  async function resolveFolderId(): Promise<string> {
    if (!folderName) return parentId;

    if (!folder.value) {
      const found = await findFolderByName(
        parentId,
        folderName
      );
      if (!found) {
        throw new Error(
          `[Drive] Folder '${folderName}' not found`
        );
      }
      folder.value = found;
    }

    return folder.value.id;
  }

  /* =========================
     Refresh folder content
  ========================= */
  async function refresh(): Promise<void> {
    busy.value = true;
    error.value = null;

    try {
      const folderId = await resolveFolderId();
      _files.value = await listFilesInFolder(folderId);
    } catch (e: unknown) {
      error.value =
        e instanceof Error ? e.message : String(e);
      _files.value = [];
    } finally {
      busy.value = false;
    }
  }

  return {
    folder,
    files,
    busy,
    error,
    refresh,
  };
}