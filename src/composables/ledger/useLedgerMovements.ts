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
  ledgerYearFile,
  readLedgerYear,
  type LedgerMovement,
  type LedgerYear,
} from "@/contracts/ledger";

/* =========================
   Mouvements du Ledger, par fichier d'année

   Charge les fichiers ledger-<année>.json des années
   demandées (une seule, ou toutes celles de l'index pour
   « All »), les garde en mémoire et ne charge que celles qui
   manquent quand le choix change. Mêmes règles que
   useRemoteJson, qui ne sert qu'un fichier à la fois :
   - chargement après que le stockage est prêt ;
   - dossier ledger/ surveillé : les années affichées sont
     relues sans repasser par « loading » (les autres sont
     oubliées) ; en cas d'échec, les données restent ;
   - seule la réponse de la dernière demande est retenue.

   Mouvements rendus dans l'ordre des fichiers : années
   croissantes, puis compte et ordre du contrat (§ 2).
========================= */

export function useLedgerMovements(
  years: MaybeRefOrGetter<readonly number[]>
) {
  const {
    storageReady,
  } = useStorageAccess();

  const files =
    shallowRef<ReadonlyMap<number, LedgerYear>>(new Map());

  const loading =
    ref(false);

  const error =
    ref<string | null>(null);

  let requestId = 0;

  async function loadYear(
    year: number
  ): Promise<LedgerYear> {
    const fileName =
      ledgerYearFile(year);

    const raw =
      await loadJSONFromFolder<unknown>(
        LEDGER_FOLDER,
        fileName
      );

    if (raw === null) {
      throw new Error(
        `${fileName} not found`
      );
    }

    return readLedgerYear(raw, fileName);
  }

  /*
    background : relecture après un changement du stockage,
    de toutes les années demandées.
  */
  async function load(
    background: boolean
  ): Promise<void> {
    const wanted =
      [...toValue(years)];

    const currentRequest =
      ++requestId;

    if (!storageReady.value || wanted.length === 0) {
      files.value = new Map();
      error.value = null;
      loading.value = false;
      return;
    }

    const missing =
      background
        ? wanted
        : wanted.filter(year => !files.value.has(year));

    if (missing.length === 0) {
      return;
    }

    if (!background) {
      loading.value = true;
      error.value = null;
    }

    try {
      const loaded =
        await Promise.all(missing.map(loadYear));

      if (currentRequest !== requestId) {
        return;
      }

      const next =
        new Map<number, LedgerYear>();

      for (const year of wanted) {
        const file =
          loaded[missing.indexOf(year)] ??
          files.value.get(year);

        if (file) {
          next.set(year, file);
        }
      }

      files.value = next;
      error.value = null;

    } catch (err) {
      if (currentRequest !== requestId) {
        return;
      }

      if (background && files.value.size > 0) {
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
      () => toValue(years).join(","),
      storageReady,
    ],

    () => load(false),

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
          await load(true);
        }
      },
  });

  /* Années demandées toutes chargées. */
  const loaded =
    computed(() =>
      toValue(years).every(year => files.value.has(year))
    );

  const movements =
    computed<LedgerMovement[]>(() =>
      [...toValue(years)]
        .sort((a, b) => a - b)
        .flatMap(year => files.value.get(year)?.movements ?? [])
    );

  return {
    movements,
    loaded,
    loading,
    error,
  };
}
