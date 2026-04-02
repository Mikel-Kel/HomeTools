import { ref } from "vue"
import { loadJSONFromFolder } from "@/services/driveAdapter"

/* =========================
   Types
========================= */
export interface DocumentTag {
  id: number
  tagName: string
  seqNb: number
  color: string
}

interface DocumentTagsFile {
  version: number
  updatedAt?: string
  tags: DocumentTag[]
}

/* =========================
   State
========================= */
const tags = ref<DocumentTag[]>([])
const loaded = ref(false)

/* =========================
   Composable
========================= */
export function useDocumentTags() {

  async function load(): Promise<void> {
    if (loaded.value) return
    const raw = await loadJSONFromFolder<DocumentTagsFile>(
      "settings",
      "documentTags.json"
    )
    if (
      !raw ||
      raw.version !== 1 ||
      !Array.isArray(raw.tags)
    ) {
      throw new Error("Invalid documentTags.json format")
    }
    tags.value =
      raw.tags
        .slice()
        .sort((a, b) => a.seqNb - b.seqNb)
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