import {
  ref,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";

import {
  loadJSONFromFolder,
} from "@/services/driveAdapter";

import {
  useDriveWatcher,
} from "@/composables/useDriveWatcher";

import {
  useStorageAccess,
} from "@/composables/useStorageAccess";

/* =========================
   Fichier JSON publié, chargé et surveillé
========================= */

/*
  Charge un fichier du stockage actif, le convertit avec la
  fonction de lecture de son contrat (src/contracts), puis le
  recharge quand il change sur le stockage.

  - Le chargement attend que le stockage soit prêt.
  - Un nom de fichier dynamique (getter) est rechargé à
    chaque changement ; null = rien à charger.
  - Un rechargement dû au watcher garde les données affichées
    et ne repasse pas par l’état « loading » ; s’il échoue,
    les données précédentes restent affichées.
*/

export interface RemoteJsonOptions<T> {
  folder: string;

  file: MaybeRefOrGetter<string | null>;

  /*
    Convertit le JSON brut ; lève une erreur si le fichier
    n’a pas la forme attendue.
  */
  read: (raw: unknown) => T;

  /*
    Fichier absent : erreur (défaut) ou simplement null.
  */
  optional?: boolean;

  /*
    Surveillance du stockage : le fichier lui-même pour un nom
    fixe, son dossier pour un nom dynamique. false = jamais
    rechargé automatiquement.
  */
  watchRemote?: boolean;

  intervalMs?: number;
}

export function useRemoteJson<T>(
  options: RemoteJsonOptions<T>
) {
  const {
    storageReady,
  } = useStorageAccess();

  const data =
    shallowRef<T | null>(null);

  const loading =
    ref(false);

  const error =
    ref<string | null>(null);

  /*
    Seule la réponse de la dernière demande est retenue :
    un changement de fichier rend les précédentes caduques.
  */
  let requestId = 0;

  async function load(
    background: boolean
  ): Promise<void> {
    const fileName =
      toValue(options.file);

    const currentRequest =
      ++requestId;

    if (
      !storageReady.value ||
      !fileName
    ) {
      data.value = null;
      error.value = null;
      loading.value = false;
      return;
    }

    if (!background) {
      loading.value = true;
      error.value = null;
    }

    try {
      const raw =
        await loadJSONFromFolder<unknown>(
          options.folder,
          fileName
        );

      if (currentRequest !== requestId) {
        return;
      }

      if (raw === null) {
        if (!options.optional) {
          throw new Error(
            `${fileName} not found`
          );
        }

        data.value = null;
      } else {
        data.value =
          options.read(raw);
      }

      error.value = null;

    } catch (err) {
      if (currentRequest !== requestId) {
        return;
      }

      if (background && data.value !== null) {
        console.warn(
          `Unable to refresh ${fileName}`,
          err
        );
      } else {
        data.value = null;

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

  function reload(): Promise<void> {
    return load(true);
  }

  watch(
    [
      () => toValue(options.file),
      storageReady,
    ],

    () => load(false),

    {
      immediate: true,
    }
  );

  if (options.watchRemote !== false) {
    const fixedFileName =
      typeof options.file === "string"
        ? options.file
        : undefined;

    const remoteState =
      ref<string | null>(null);

    /*
      Le premier contrôle ne fait que mémoriser l’état du
      stockage : le fichier vient d’être chargé.
    */
    let remoteStateKnown =
      false;

    useDriveWatcher({
      folderId:
        options.folder,

      fileName:
        fixedFileName,

      lastKnownState:
        remoteState,

      intervalMs:
        options.intervalMs,

      onChanged:
        async () => {
          if (!remoteStateKnown) {
            remoteStateKnown = true;
            return;
          }

          if (!storageReady.value) {
            return;
          }

          await load(true);
        },
    });
  }

  return {
    data,
    loading,
    error,
    reload,
  };
}
