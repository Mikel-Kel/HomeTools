// src/composables/archives/useArchiveFolders.ts

import { ref } from "vue"
import { loadJSONFromFolder } from "@/services/driveAdapter"

export interface ArchiveFolderConfig {
  id: number
  source: string
  label: string
  order: number
}

const folders = ref<ArchiveFolderConfig[]>([])
const loaded = ref(false)

export function useArchiveFolders() {

  async function load() {
    if (loaded.value) return

    const data = await loadJSONFromFolder<any>(
      "settings",
      "AppParameters.json"
    )

    folders.value = (data?.archiveFolders ?? [])
      .slice()
      .sort((a: ArchiveFolderConfig, b: ArchiveFolderConfig) =>
        a.order - b.order
      )

    loaded.value = true
  }

  return {
    folders,
    load
  }
}