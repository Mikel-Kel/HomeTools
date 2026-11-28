import { ref } from "vue"
import { loadJSONFromFolder } from "@/services/driveAdapter"

import {
  ARCHIVE_SUB_FOLDERS_FOLDER,
  VARIOUS_FOLDERS_FILE,
  readVariousFolders,
  type SubFolder,
} from "@/contracts/archiveSubFolders"

export type { SubFolder } from "@/contracts/archiveSubFolders"

const folders = ref<SubFolder[]>([])
const loaded = ref(false)

export function useVariousFolders() {

  async function load(): Promise<void> {
    if (loaded.value) return
    /* Fichier absent (environnement neuf) : aucun sous-dossier. */
    const raw = await loadJSONFromFolder<unknown>(
      ARCHIVE_SUB_FOLDERS_FOLDER,
      VARIOUS_FOLDERS_FILE
    )
    folders.value = raw === null ? [] : readVariousFolders(raw)
    loaded.value = true
  }

  /*
    Liste relue par la page Archives quand variousFolders.json
    change (ordre modifié dans Master data) : la fiche de
    classement en profite sans recharger.
  */
  function set(list: SubFolder[]): void {
    folders.value = list
    loaded.value = true
  }

  return {
    folders,
    load,
    set
  }
}
