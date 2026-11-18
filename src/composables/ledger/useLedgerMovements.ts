import {
  computed,
  ref,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";

import { loadJSONFromFolder } from "@/services/driveAdapter";

import { useDriveWatcher } from "@/composables/useDriveWatcher";
import { useStorageAccess } from "@/composables/useStorageAccess";

import {
  LEDGER_FOLDER,
  readLedgerYearFile,
  type LedgerFile,
  type LedgerMovement,
  type LedgerYearFile,
} from "@/contracts/ledger";

/* =========================
   Mouvements du Ledger, par fichier de compte et d'année

   Charge les fichiers demandés (entrées files de l'index :
   comptes et années affichés), les garde en mémoire et ne
   relit un fichier que si son updatedAt dans l'index a
   changé, ou s'il manque. Mêmes règles que useRemoteJson,
   qui ne sert qu'un fichier à la fois :
   - chargement après que le stockage est prêt ;
   - « loading » seulement au premier chargement d'un
     fichier ; une relecture garde les données affichées et,
     si elle échoue, les données précédentes restent ;
   - seule la réponse de la dernière demande est retenue.
   Le dossier ledger/ est aussi surveillé : un fichier arrivé
   après l'index (miroir) est relu dès qu'il change.

   Mouvements rendus dans l'ordre des fichiers demandés, puis
   dans l'ordre du contrat (§ 4).
========================= */

export function useLedgerMovements(
  files: MaybeRefOrGetter<readonly LedgerFile[]>
) {
  const {
    storageReady,
  } = useStorageAccess();

  /* Fichiers chargés, par nom. */
  const loadedFiles =
    shallowRef<ReadonlyMap<string, LedgerYearFile>>(new Map());

  const loading =
    ref(false);

  const error =
    ref<string | null>(null);

  let requestId = 0;

  async function loadFile(
    entry: LedgerFile
  ): Promise<LedgerYearFile> {
    const raw =
      await loadJSONFromFolder<unknown>(
        LEDGER_FOLDER,
        entry.file
      );

    if (raw === null) {
      throw new Error(
        `${entry.file} not found`
      );
    }

    return readLedgerYearFile(raw, entry.file);
  }

  /* Fichier absent, ou d'une autre version que celle de l'index. */
  function isStale(
    entry: LedgerFile
  ): boolean {
    return loadedFiles.value.get(entry.file)?.updatedAt !== entry.updatedAt;
  }

  /* Charge les fichiers demandés absents ou différents de l'index. */
  async function load(): Promise<void> {
    const wanted =
      [...toValue(files)];

    const currentRequest =
      ++requestId;

    if (!storageReady.value) {
      loadedFiles.value = new Map();
      error.value = null;
      loading.value = false;
      return;
    }

    const stale =
      wanted.filter(isStale);

    /* Premier chargement d'un fichier : « loading » ; sinon relecture discrète. */
    const firstLoad =
      stale.some(entry => !loadedFiles.value.has(entry.file));

    if (stale.length === 0) {
      loading.value = false;
      return;
    }

    if (firstLoad) {
      loading.value = true;
      error.value = null;
    }

    try {
      const loaded =
        await Promise.all(stale.map(loadFile));

      if (currentRequest !== requestId) {
        return;
      }

      const next =
        new Map(loadedFiles.value);

      stale.forEach((entry, index) => {
        next.set(entry.file, loaded[index]);
      });

      loadedFiles.value = next;
      error.value = null;

    } catch (err) {
      if (currentRequest !== requestId) {
        return;
      }

      if (!firstLoad) {
        console.warn("Unable to refresh the ledger", err);
      } else {
        error.value =
          err instanceof Error
            ? err.message
            : String(err);
      }

    } finally {
      if (currentRequest === requestId) {
        loading.value = false;
      }
    }
  }

  watch(
    [
      () =>
        toValue(files)
          .map(entry => `${entry.file}@${entry.updatedAt}`)
          .join(","),
      storageReady,
    ],

    () => load(),

    {
      immediate: true,
    }
  );

  /* Le premier contrôle ne fait que mémoriser l'état du dossier. */
  const remoteState =
    ref<string | null>(null);

  let remoteStateKnown =
    false;

  useDriveWatcher({
    folderId:
      LEDGER_FOLDER,

    lastKnownState:
      remoteState,

    onChanged:
      async () => {
        if (!remoteStateKnown) {
          remoteStateKnown = true;
          return;
        }

        if (storageReady.value) {
          await load();
        }
      },
  });

  /* Fichiers demandés tous chargés (dans une version éventuellement plus ancienne). */
  const loaded =
    computed(() =>
      toValue(files).every(entry =>
        loadedFiles.value.has(entry.file)
      )
    );

  const movements =
    computed<LedgerMovement[]>(() =>
      toValue(files).flatMap(entry =>
        loadedFiles.value.get(entry.file)?.movements ?? []
      )
    );

  return {
    movements,
    loaded,
    loading,
    error,
  };
}
