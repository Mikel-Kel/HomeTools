import { ref } from "vue"
import { loadJSONFromFolder } from "@/services/driveAdapter"

export interface SubFolder {
  id: number
  label: string
  seqNb?: number
}

const folders = ref<SubFolder[]>([])
const loaded = ref(false)

export function useTourismFolders() {

  async function load() {

    if (loaded.value) return

    const raw = await loadJSONFromFolder<any>(
      "settings",
      "tourismFolders.json"
    )

    folders.value = raw?.folders ?? []
    loaded.value = true
  }

  return {
    folders,
    load
  }
}