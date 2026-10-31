import { ref } from "vue"
import { loadJSONFromFolder } from "@/services/driveAdapter"

import {
  DOCUMENT_TAGS_FILE,
  DOCUMENT_TAGS_FOLDER,
  readDocumentTags,
  type DocumentTag,
} from "@/contracts/documentTags"

export type { DocumentTag } from "@/contracts/documentTags"

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
    tags.value = readDocumentTags(
      await loadJSONFromFolder<unknown>(
        DOCUMENT_TAGS_FOLDER,
        DOCUMENT_TAGS_FILE
      )
    )
    loaded.value = true
  }

  /*
    Liste relue par la page Master data quand
    documentTags.json change : les Archives en profitent
    sans recharger.
  */
  function set(list: DocumentTag[]): void {
    tags.value = list
    loaded.value = true
  }

  function getTag(id: number) {
    return tags.value.find(t => t.id === id)
  }

  return {
    tags,
    load,
    set,
    getTag
  }
}
