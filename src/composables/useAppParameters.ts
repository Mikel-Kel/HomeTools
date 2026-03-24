// src/composables/useAppParameters.ts

import { ref } from "vue";
import { useDrive } from "@/composables/useDrive";
import {
  listFiles,
  loadJSONFromFolder
} from "@/services/driveAdapter";

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
  offBudgetTagId?: number;
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

  async function load() {

    if (appParameters.value && Object.keys(appParameters.value).length > 0) {
      return
    }

    loading.value = true
    error.value = null

    try {

      const folderId = "settings"

      const data = await loadJSONFromFolder<any>(
        folderId,
        "AppParameters.json"
      )

      if (!data) {
        throw new Error("AppParameters empty")
      }

      appParameters.value = {
        version: data.version,
        followUpSpreadLimit:
          data?.runtime?.followUpSpreadLimit ??
          data?.followUpSpreadLimit,
        offBudgetTagId:
          data?.runtime?.offBudgetTagId ??
          data?.offBudgetTagId,
        archiveFolders:
          data?.archiveFolders
      }

    } catch (e: any) {

      console.error("❌ AppParameters LOAD FAILED", e)

      error.value = e?.message ?? "Unable to load AppParameters.json"
      appParameters.value = {}

    } finally {
      loading.value = false
    }
  }  
 
  return {
    appParameters,
    load,
    loading,
    error
  };
}