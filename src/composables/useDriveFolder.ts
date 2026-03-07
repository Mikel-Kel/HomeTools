import { ref, computed } from "vue";
import type { Ref, ComputedRef } from "vue";

import { listFiles } from "@/services/google/driveRepository";
import { useStorageBackend } from "@/composables/useStorageBackend";

/* =========================
   Types
========================= */

export interface DriveItem {
  id: string;
  name: string;
  mimeType?: string;
}

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

  const { backend } = useStorageBackend();

  const folder = ref<DriveItem | null>(null);

  const _files = ref<DriveItem[]>([]);
  const files = computed(() => _files.value);

  const busy = ref(false);
  const error = ref<string | null>(null);

  /* =========================
     Resolve folder id
  ========================= */

  async function resolveFolderId(): Promise<string> {

    // LOCAL_DRIVE → folder names are already paths
    if (backend.value === "LOCAL_DRIVE") {
      return parentId;
    }

    if (!folderName) return parentId;

    let current = folder.value;

    if (!current) {
      throw new Error(
        "[Drive] Folder resolution not supported in LOCAL mode"
      );
    }

    return current.id;

  }

  /* =========================
     Refresh folder content
  ========================= */

  async function refresh(): Promise<void> {

    busy.value = true;
    error.value = null;

    try {

      const folderId = await resolveFolderId();

      const filesList = await listFiles(folderId);

      // normalize
      _files.value = filesList.map((f: any) => ({
        id: f.id ?? f.name,
        name: f.name,
      }));

    }
    catch (e: unknown) {

      error.value =
        e instanceof Error ? e.message : String(e);

      _files.value = [];

    }
    finally {

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