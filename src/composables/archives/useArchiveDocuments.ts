import {
  computed,
  ref,
  watch,
} from "vue";

import { loadJSONFromFolder } from "@/services/driveAdapter";

import { useRemoteJson } from "@/composables/useRemoteJson";
import { useStorageAccess } from "@/composables/useStorageAccess";

import {
  ARCHIVE_FOLDER,
  ARCHIVE_INDEX_FILE,
  ARCHIVE_TO_FILE_FILE,
  archiveYearFile,
  readArchiveIndex,
  readArchiveToFile,
  readArchiveYear,
  TO_FILE_BUCKET,
  type ArchiveIndex,
  type ArchiveItem,
} from "@/contracts/archive";

/* =========================
   Documents d'archives

   Index des archives (archive/index.json), relu dès qu'il
   change : chaque nouvelle version recharge les fichiers
   qu'il désigne, toFile.json et les fichiers d'année.
   Contrat : src/contracts/archive.ts.

   Options :
   - folderOfLabel : nom du dossier d'un groupe d'année
     (libellé « Bills » → « Factures ») ;
   - onLoaded : appelé après chaque chargement réussi.

   items reste modifiable par la vue (mise à jour immédiate
   d'un classement, retour arrière en cas d'échec). Stockage
   perdu : documents effacés.
========================= */

export interface ArchiveDocumentsOptions {
  folderOfLabel: (label: string) => string;
  onLoaded: () => void;
}

export function useArchiveDocuments(
  options: ArchiveDocumentsOptions
) {
  const {
    storageReady,
  } = useStorageAccess();

  const archiveIndex =
    useRemoteJson({
      folder:
        ARCHIVE_FOLDER,

      file:
        ARCHIVE_INDEX_FILE,

      read:
        readArchiveIndex,
    });

  const items =
    ref<ArchiveItem[]>([]);

  const itemsLoading =
    ref(false);

  const loaded =
    ref(false);

  const itemsError =
    ref<string | null>(null);

  const loading =
    computed(() =>
      archiveIndex.loading.value ||
      itemsLoading.value
    );

  const error =
    computed(() =>
      archiveIndex.error.value ??
      itemsError.value
    );

  /*
    Documents d’un fichier de l’index : « toFile » ou une
    année. Un fichier absent ne contient aucun document.
  */
  async function loadBucket(
    bucket: string
  ): Promise<ArchiveItem[]> {
    if (bucket === TO_FILE_BUCKET) {
      return readArchiveToFile(
        await loadJSONFromFolder<unknown>(
          ARCHIVE_FOLDER,
          ARCHIVE_TO_FILE_FILE
        )
      );
    }

    return readArchiveYear(
      await loadJSONFromFolder<unknown>(
        ARCHIVE_FOLDER,
        archiveYearFile(bucket)
      ),
      bucket,
      options.folderOfLabel
    );
  }

  /*
    Lecture complète (première version de l’index), ou
    partielle : seuls les fichiers republiés par le dernier
    classement (foldersUpdated) sont relus.
  */
  async function load(
    index: ArchiveIndex,
    partial: boolean
  ) {
    const buckets =
      partial
        ? index.foldersUpdated.filter(
            bucket =>
              bucket === TO_FILE_BUCKET ||
              /^\d{4}$/.test(bucket)
          )
        : [
            TO_FILE_BUCKET,
            ...index.years.map(String),
          ];

    if (!partial) {
      itemsLoading.value =
        true;
    }

    itemsError.value =
      null;

    try {
      const loadedItems =
        (
          await Promise.all(
            buckets.map(loadBucket)
          )
        ).flat();

      items.value =
        partial
          ? [
              ...items.value.filter(
                item =>
                  !buckets.includes(
                    item.sourceBucket
                  )
              ),
              ...loadedItems,
            ]
          : loadedItems;

      loaded.value =
        true;

      options.onLoaded();

    } catch (err) {
      console.error(
        "Archive loading failed",
        err
      );

      if (!partial) {
        itemsError.value =
          err instanceof Error
            ? err.message
            : "Failed to load archive";
      }

    } finally {
      itemsLoading.value =
        false;
    }
  }

  watch(
    () =>
      archiveIndex.data.value,

    async (index, previous) => {
      if (!index) {
        return;
      }

      const partial =
        loaded.value &&
        previous !== null &&
        index.foldersUpdated.length > 0;

      if (partial) {
        /*
          L’index peut être publié un instant avant les
          fichiers qu’il désigne.
        */
        await new Promise<void>(
          resolve =>
            window.setTimeout(
              resolve,
              200
            )
        );
      }

      await load(
        index,
        partial
      );
    }
  );

  watch(
    storageReady,
    ready => {
      if (!ready) {
        loaded.value =
          false;

        items.value =
          [];
      }
    }
  );

  return {
    items,
    loaded,
    loading,
    error,
  };
}
