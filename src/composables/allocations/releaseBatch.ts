import {
  deleteFileFromFolder,
  listFiles,
  loadJSONFromFolder,
  saveJSONToFolder,
} from "@/services/driveAdapter";

import {
  useStorageBackend,
} from "@/composables/useStorageBackend";

import {
  publishS3StoragePullRequest,
} from "@/services/s3/s3StorageAdapter";

/* =========================
   Types
========================= */

interface DraftRecord {
  id: string;
}

interface AllocationDraftFile {
  spendingId?: string;
  mode?: string;
  allocations?: unknown[];
  toProcess?: boolean;

  [key: string]: unknown;
}

export interface ReleaseDraftFailure {
  id: string;
  filename: string;
  reason: string;
}

export interface ReleaseDraftsBatchResult {
  requested: number;
  released: number;
  skipped: number;
  failed: number;

  downloadPaths: string[];
  deletePaths: string[];

  failures: ReleaseDraftFailure[];
}

/* =========================
   Constants
========================= */

const DRAFTS_FOLDER =
  "allocations/drafts";

const RELEASED_FOLDER =
  "allocations/released";

/* =========================
   Helpers
========================= */

function buildJSONFilename(
  id: string
): string {
  return `${id}.json`;
}

function buildStoragePath(
  folder: string,
  filename: string
): string {
  return `${folder}/${filename}`;
}

function errorMessage(
  error: unknown
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/* =========================
   Release one draft
========================= */

async function releaseOneDraft(
  record: DraftRecord,
  availableDraftNames: Set<string>
): Promise<{
  status: "RELEASED" | "SKIPPED";
  downloadPath?: string;
  deletePath?: string;
}> {
  const filename =
    buildJSONFilename(
      record.id
    );

  if (
    !availableDraftNames.has(
      filename
    )
  ) {
    console.warn(
      "[ReleaseBatch] Draft file not found:",
      filename
    );

    return {
      status:
        "SKIPPED",
    };
  }

  const raw =
    await loadJSONFromFolder<
      AllocationDraftFile
    >(
      DRAFTS_FOLDER,
      filename
    );

  if (
    !raw ||
    !Array.isArray(
      raw.allocations
    )
  ) {
    console.warn(
      "[ReleaseBatch] Invalid draft ignored:",
      filename
    );

    return {
      status:
        "SKIPPED",
    };
  }

  if (
    raw.toProcess !== true
  ) {
    console.warn(
      "[ReleaseBatch] Draft not ready:",
      filename,
      {
        toProcess:
          raw.toProcess,
      }
    );

    return {
      status:
        "SKIPPED",
    };
  }

  const releasedPayload = {
    ...raw,

    releasedAt:
      new Date().toISOString(),

    processed:
      true,

    toProcess:
      false,
  };

  /*
    L'opération métier comprend deux mutations :

    1. créer released/FITID.json ;
    2. supprimer drafts/FITID.json.

    Aucun événement automatique n'est généré ici.
    L'événement agrégé sera publié après le batch.
  */
  await saveJSONToFolder(
    RELEASED_FOLDER,
    filename,
    releasedPayload,
    {
      requestPull:
        false,

      reason:
        "ALLOCATION_RELEASED",
    }
  );

  try {
    await deleteFileFromFolder(
      DRAFTS_FOLDER,
      filename,
      {
        requestPull:
          false,

        reason:
          "ALLOCATION_RELEASED",
      }
    );

  } catch (deleteError) {
    /*
      L'écriture du released a réussi, mais la suppression
      du draft a échoué.

      On tente de supprimer le released afin de revenir
      à l'état initial et d'éviter la coexistence des deux
      versions dans le stockage distant.
    */
    try {
      await deleteFileFromFolder(
        RELEASED_FOLDER,
        filename,
        {
          requestPull:
            false,

          reason:
            "ALLOCATION_RELEASE_ROLLBACK",
        }
      );

      console.warn(
        "[ReleaseBatch] Released file rolled back:",
        filename
      );

    } catch (rollbackError) {
      console.error(
        "[ReleaseBatch] Rollback failed:",
        {
          filename,

          deleteError:
            errorMessage(
              deleteError
            ),

          rollbackError:
            errorMessage(
              rollbackError
            ),
        }
      );
    }

    throw deleteError;
  }

  return {
    status:
      "RELEASED",

    downloadPath:
      buildStoragePath(
        RELEASED_FOLDER,
        filename
      ),

    deletePath:
      buildStoragePath(
        DRAFTS_FOLDER,
        filename
      ),
  };
}

/* =========================
   Release batch
========================= */

export async function releaseDraftsBatch(
  drafts: DraftRecord[]
): Promise<ReleaseDraftsBatchResult> {
  const {
    backend,
  } = useStorageBackend();

  const draftFiles =
    await listFiles(
      DRAFTS_FOLDER
    );

  const availableDraftNames =
    new Set(
      draftFiles
        .filter(file =>
          file.name
            .toLowerCase()
            .endsWith(".json")
        )
        .map(file =>
          file.name
        )
    );

  const downloadPaths:
    string[] = [];

  const deletePaths:
    string[] = [];

  const failures:
    ReleaseDraftFailure[] = [];

  let releasedCount = 0;
  let skippedCount = 0;

  /*
    Chaque draft est isolé.

    Une erreur sur un fichier ne doit pas empêcher :
    - le traitement des suivants ;
    - la publication des opérations déjà réussies.
  */
  for (
    const record
    of drafts
  ) {
    const filename =
      buildJSONFilename(
        record.id
      );

    try {
      const result =
        await releaseOneDraft(
          record,
          availableDraftNames
        );

      if (
        result.status ===
        "SKIPPED"
      ) {
        skippedCount += 1;
        continue;
      }

      if (
        result.downloadPath
      ) {
        downloadPaths.push(
          result.downloadPath
        );
      }

      if (
        result.deletePath
      ) {
        deletePaths.push(
          result.deletePath
        );
      }

      releasedCount += 1;

      /*
        Le fichier n'est désormais plus disponible
        dans drafts pour le reste du même batch.
      */
      availableDraftNames.delete(
        filename
      );

      console.info(
        "[ReleaseBatch] Draft released:",
        filename
      );

    } catch (error) {
      const reason =
        errorMessage(
          error
        );

      failures.push({
        id:
          record.id,

        filename,

        reason,
      });

      console.error(
        "[ReleaseBatch] Draft release failed:",
        {
          id:
            record.id,

          filename,

          reason,
        }
      );
    }
  }

  /*
    Même si un ou plusieurs drafts ont échoué,
    on publie les opérations qui ont réussi.

    C'est le point essentiel qui manquait dans
    la version précédente.
  */

    console.log(
  "[ReleaseBatch] Before pull publication",
  {
    backend: backend.value,
    downloadPaths,
    deletePaths,
  }
);

  if (
    backend.value ===
      "OBJECT_STORAGE" &&
    downloadPaths.length > 0
  ) {
    try {
      const controlEvent =
        await publishS3StoragePullRequest({
          downloadPaths,
          deletePaths,

          reason:
            "ALLOCATION_RELEASED",
        });

      console.info(
        "[ReleaseBatch] Pull request published:",
        {
          eventId:
            controlEvent.eventId,

          downloads:
            downloadPaths.length,

          deletes:
            deletePaths.length,
        }
      );

    } catch (error) {
      const reason =
        errorMessage(
          error
        );

      /*
        Les mutations S3 ont déjà eu lieu.

        L'échec de publication du contrôle doit donc
        être clairement visible et propagé : sans ce
        contrôle, le Mac ne pourra pas reprendre les
        fichiers modifiés.
      */
      console.error(
        "[ReleaseBatch] Pull request publication failed:",
        {
          reason,

          downloadPaths,

          deletePaths,
        }
      );

      throw new Error(
        "ALLOCATION_RELEASED_BUT_PULL_REQUEST_FAILED: " +
        reason
      );
    }
  }

  const result:
    ReleaseDraftsBatchResult = {
    requested:
      drafts.length,

    released:
      releasedCount,

    skipped:
      skippedCount,

    failed:
      failures.length,

    downloadPaths,

    deletePaths,

    failures,
  };

  console.info(
    "[ReleaseBatch] Completed:",
    result
  );

  return result;
}