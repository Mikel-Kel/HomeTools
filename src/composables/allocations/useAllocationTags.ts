import { ref } from "vue";
import { loadJSONFromFolder } from "@/services/google/driveRepository";
import { useDrive } from "@/composables/useDrive";

export interface AllocationTag {
  id: number
  tagName: string
  seqNb: number
  offBudget?: boolean
}

const tags = ref<AllocationTag[]>([])
const loaded = ref(false)

export function useAllocationTags() {
  const { folders } = useDrive()

  async function load() {
    if (loaded.value) return
    const raw = await loadJSONFromFolder<any>(
      folders.value.settings,
      "allocationTags.json"
    )
    tags.value =
      (raw?.tags ?? [])
        .slice()
        .sort((a: any, b: any) => a.seqNb - b.seqNb)
    loaded.value = true
  }

  function getTag(id: number) {
    return tags.value.find(t => t.id === id)
  }

  return {
    tags,
    load,
    getTag
  }
}