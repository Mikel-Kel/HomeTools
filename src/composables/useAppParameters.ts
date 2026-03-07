// src/composables/useAppParameters.ts

import { ref } from "vue";

import { useDrive } from "@/composables/useDrive";

import {
  listFiles,
  loadJSONFromFolder
} from "@/services/google/driveRepository";

/* =========================
   Types
========================= */

export interface ArchiveFolderConfig {
  id: number;
  source: string;
  label: string;
  order: number;
}

export interface AppParameters {
  version?: string;
  followUpSpreadLimit?: number;
  archiveFolders?: ArchiveFolderConfig[];
}

/* =========================
   State (singleton)
========================= */

const appParameters = ref<AppParameters | null>(null);

const loading = ref(false);
const error = ref<string | null>(null);

/* =========================
   Composable
========================= */

export function useAppParameters() {

  const { folders } = useDrive();

  async function load() {

    if (appParameters.value) return;

    loading.value = true;
    error.value = null;

    try {

      const folderId = folders.value.settings;

      const files = await listFiles(folderId);

      const file = files.find(
        f => f.name === "AppParameters.json"
      );

      if (!file) {

        appParameters.value = {};

        return;

      }

      const data =
        await loadJSONFromFolder<AppParameters>(
          folderId,
          "AppParameters.json"
        );

      appParameters.value =
        data ?? {};

    }

    catch (e: any) {

      error.value =
        e?.message ??
        "Unable to load AppParameters.json";

      appParameters.value = {};

    }

    finally {

      loading.value = false;

    }

  }

  return {

    appParameters,

    load,

    loading,

    error

  };

}