import { ref } from "vue"
import { loadJSONFromFolder } from "@/services/driveAdapter"

export interface SubFolder {
  id: number
  label: string
  seqNb?: number
}

const folders = ref<SubFolder[]>([])
const loaded = ref(false)

export function useVariousFolders() {

  async function load() {

    if (loaded.value) return

    const raw = await loadJSONFromFolder<any>(
      "settings",
      "variousFolders.json"
    )

    folders.value =
      (raw?.folders ?? [])
        .slice()
        .sort((a: SubFolder, b: SubFolder) =>
          (a.seqNb ?? 9999) - (b.seqNb ?? 9999)
        )

    loaded.value = true
  }

  return {
    folders,
    load
  }
}