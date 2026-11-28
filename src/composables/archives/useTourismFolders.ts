import { ref } from "vue"
import { loadJSONFromFolder } from "@/services/driveAdapter"

import {
  ARCHIVE_SUB_FOLDERS_FOLDER,
  TOURISM_FOLDERS_FILE,
  readTourismFolders,
  type SubFolder,
} from "@/contracts/archiveSubFolders"

export type { SubFolder } from "@/contracts/archiveSubFolders"

const folders = ref<SubFolder[]>([])
const loaded = ref(false)

export function useTourismFolders() {

  async function load(): Promise<void> {
    if (loaded.value) return
    /* Fichier absent (environnement neuf) : aucun sous-dossier. */
    const raw = await loadJSONFromFolder<unknown>(
      ARCHIVE_SUB_FOLDERS_FOLDER,
      TOURISM_FOLDERS_FILE
    )
    folders.value = raw === null ? [] : readTourismFolders(raw)
    loaded.value = true
  }

  /*
    Liste relue par la page Archives quand tourismFolders.json
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
