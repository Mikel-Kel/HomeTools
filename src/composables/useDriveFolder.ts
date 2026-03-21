import { ref, computed } from "vue";
import type { Ref, ComputedRef } from "vue";

import { listFiles } from "@/services/driveAdapter";
import { useStorageBackend } from "@/composables/useStorageBackend";
import { resolveFolderId as resolvePath } from "@/config/driveResolver";

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
  pathOrParentId: string,
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

    // =========================
    // LOCAL MODE
    // =========================
    if (backend.value === "LOCAL_DRIVE") {
      // path direct (ex: "events/processed")
      return pathOrParentId;
    }

    // =========================
    // NEW MODE (path-based)
    // =========================
    if (!folderName) {

      const id = await resolvePath(pathOrParentId);

      // on alimente folder pour cohérence UI/debug
      folder.value = {
        id,
        name: pathOrParentId.split("/").pop() ?? pathOrParentId,
      };

      return id;
    }

    // =========================
    // LEGACY MODE (temporary)
    // =========================
    if (!folder.value) {
      throw new Error("[Drive] Folder resolution failed (legacy mode)");
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

      const filesList = await listFiles(folderId);

      // normalize
      _files.value = filesList.map((f: any) => ({
        id: f.id ?? f.name,
        name: f.name,
        mimeType: f.mimeType,
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