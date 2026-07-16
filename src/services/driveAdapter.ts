import {
  useStorageBackend,
} from "@/composables/useStorageBackend";

import {
  getLocalDirectory,
} from "@/services/local/localDirectory";

import {
  resolveFolderId,
} from "@/config/driveResolver";

import type {
  DriveItem,
} from "@/services/google/googleDrive";

import {
  saveGoogleJSON,
  deleteGoogleFile,
  listGoogleFilesInFolder,
  findGoogleFileByName,
  downloadGoogleFile,
  getFileMetadataByName,
} from "@/services/google/googleDrive";

import {
  readLocalJSON,
  saveLocalJSON,
  deleteLocalFile,
  listLocalFilesInFolder,
  findLocalFileByName,
  downloadLocalFile,
  resolveDirectory,
} from "@/services/local/localDrive";

import {
  buildS3Key,
  deleteS3File,
  downloadS3File,
  findS3FileByName,
  getS3FileModifiedTime,
  listS3FilesInFolder,
  readS3JSON,
  writeS3JSON,
} from "@/services/s3/s3StorageAdapter";

import type {
  S3WriteJSONOptions,
} from "@/services/s3/s3StorageAdapter";

import {
  googleAuthenticated,
} from "@/services/google/googleInit";

/* =========================
   Public mutation options
========================= */

/*
  Options communes aux mutations de stockage.

  requestPull:
    undefined
      comportement automatique du backend ;

    true
      force une demande de Pull, lorsque le backend
      sait la produire ;

    false
      interdit la création automatique d'une demande
      de Pull.

  reason:
    raison métier placée dans l'événement de contrôle.
*/
export interface StorageMutationOptions {
  requestPull?: boolean;
  reason?: string;
}

/* =========================
   Helpers
========================= */

function handleDriveError(
  err: any
): never {
  if (
    err?.message ===
    "DRIVE_UNAUTHORIZED"
  ) {
    googleAuthenticated.value =
      false;

    console.warn(
      "🔐 Google Drive session expired"
    );

    throw err;
  }

  throw err;
}

/* =========================
   Resolve Google folder
========================= */

async function resolveGoogleFolder(
  folderPathOrId: string
): Promise<string> {
  const isLikelyId =
    folderPathOrId.length > 20 &&
    !folderPathOrId.includes("/");

  if (isLikelyId) {
    return folderPathOrId;
  }

  return await resolveFolderId(
    folderPathOrId
  );
}

/* =========================
   Load JSON
========================= */

export async function loadJSONFromFolder<
  T = any
>(
  folderPathOrId: string,
  fileName: string
): Promise<T | null> {
  const {
    backend,
  } = useStorageBackend();

  if (
    backend.value ===
    "LOCAL_DRIVE"
  ) {
    return await readLocalJSON<T>(
      folderPathOrId,
      fileName
    );
  }

  if (
    backend.value ===
    "OBJECT_STORAGE"
  ) {
    return await readS3JSON<T>(
      buildS3Key(
        folderPathOrId,
        fileName
      )
    );
  }

  const folderId =
    await resolveGoogleFolder(
      folderPathOrId
    );

  try {
    const file =
      await findGoogleFileByName(
        folderId,
        fileName
      );

    if (!file) {
      return null;
    }

    const content =
      await downloadGoogleFile(
        file.id
      );

    return JSON.parse(
      content
    ) as T;

  } catch (err) {
    handleDriveError(err);
  }
}

/* =========================
   Find file
========================= */

export async function findFileByName(
  folderPathOrId: string,
  fileName: string
) {
  const {
    backend,
  } = useStorageBackend();

  if (
    backend.value ===
    "LOCAL_DRIVE"
  ) {
    return await findLocalFileByName(
      folderPathOrId,
      fileName
    );
  }

  if (
    backend.value ===
    "OBJECT_STORAGE"
  ) {
    return await findS3FileByName(
      folderPathOrId,
      fileName
    );
  }

  const folderId =
    await resolveGoogleFolder(
      folderPathOrId
    );

  return await findGoogleFileByName(
    folderId,
    fileName
  );
}

/* =========================
   Download file
========================= */

export async function downloadFile(
  fileIdOrPath: string
): Promise<string> {
  const {
    backend,
  } = useStorageBackend();

  if (
    backend.value ===
    "LOCAL_DRIVE"
  ) {
    return await downloadLocalFile(
      fileIdOrPath
    );
  }

  if (
    backend.value ===
    "OBJECT_STORAGE"
  ) {
    return await downloadS3File(
      fileIdOrPath
    );
  }

  return await downloadGoogleFile(
    fileIdOrPath
  );
}

/* =========================
   Save JSON
========================= */

export async function saveJSONToFolder(
  folderPathOrId: string,
  filename: string,
  data: any,
  options:
    StorageMutationOptions = {}
): Promise<void> {
  const {
    backend,
  } = useStorageBackend();

  if (
    backend.value ===
    "LOCAL_DRIVE"
  ) {
    await saveLocalJSON(
      folderPathOrId,
      filename,
      data
    );

    return;
  }

  if (
    backend.value ===
    "OBJECT_STORAGE"
  ) {
    const s3Options:
      S3WriteJSONOptions = {
        requestPull:
          options.requestPull,

        reason:
          options.reason,
      };

    await writeS3JSON(
      buildS3Key(
        folderPathOrId,
        filename
      ),
      data,
      s3Options
    );

    return;
  }

  const folderId =
    await resolveGoogleFolder(
      folderPathOrId
    );

  try {
    const files =
      await listGoogleFilesInFolder(
        folderId
      );

    const existing =
      files.find(
        file =>
          file.name === filename
      );

    await saveGoogleJSON(
      folderId,
      filename,
      data,
      existing?.id
    );

  } catch (err) {
    handleDriveError(err);
  }
}

/* =========================
   List files
========================= */

export async function listFiles(
  folderPathOrId: string
): Promise<DriveItem[]> {
  const {
    backend,
  } = useStorageBackend();

  if (
    backend.value ===
    "LOCAL_DRIVE"
  ) {
    return await listLocalFilesInFolder(
      folderPathOrId
    );
  }

  if (
    backend.value ===
    "OBJECT_STORAGE"
  ) {
    const files =
      await listS3FilesInFolder(
        folderPathOrId
      );

    /*
      Compatibilité temporaire avec DriveItem.

      Pour S3 :
      - id = clé complète de l'objet ;
      - name = nom du fichier ;
      - modifiedTime = LastModified.
    */
    return files.map(
      file => ({
        id:
          file.id,

        name:
          file.name,

        mimeType:
          file.mimeType,

        modifiedTime:
          file.modifiedTime ??
          undefined,

        size:
          file.size !== null
            ? String(file.size)
            : undefined,
      })
    ) as DriveItem[];
  }

  const folderId =
    await resolveGoogleFolder(
      folderPathOrId
    );

  try {
    return await listGoogleFilesInFolder(
      folderId
    );

  } catch (err) {
    handleDriveError(err);
  }
}

/* =========================
   Delete file
========================= */

export async function deleteFileFromFolder(
  folderPathOrId: string,
  filename: string,
  _options:
    StorageMutationOptions = {}
): Promise<void> {
  const {
    backend,
  } = useStorageBackend();

  if (
    backend.value ===
    "LOCAL_DRIVE"
  ) {
    await deleteLocalFile(
      folderPathOrId,
      filename
    );

    return;
  }

  if (
    backend.value ===
    "OBJECT_STORAGE"
  ) {
    /*
      La suppression S3 est effectuée ici.

      La publication d'un deletePath sera gérée
      par l'opération métier composée, afin d'éviter
      deux événements indépendants pour une release.
    */
    await deleteS3File(
      folderPathOrId,
      filename
    );

    return;
  }

  const folderId =
    await resolveGoogleFolder(
      folderPathOrId
    );

  try {
    const file =
      await findGoogleFileByName(
        folderId,
        filename
      );

    if (!file) {
      return;
    }

    await deleteGoogleFile(
      file.id
    );

  } catch (err) {
    handleDriveError(err);
  }
}

/* =========================
   File metadata
========================= */

export async function getFileModifiedTime(
  folderPathOrId: string,
  filename: string
): Promise<string | null> {
  const {
    backend,
  } = useStorageBackend();

  if (
    backend.value ===
    "LOCAL_DRIVE"
  ) {
    const root =
      getLocalDirectory();

    if (!root) {
      throw new Error(
        "LOCAL_DIRECTORY_NOT_SELECTED"
      );
    }

    const directory =
      await resolveDirectory(
        root,
        folderPathOrId
      );

    try {
      const fileHandle =
        await directory.getFileHandle(
          filename
        );

      const file =
        await fileHandle.getFile();

      return new Date(
        file.lastModified
      ).toISOString();

    } catch {
      return null;
    }
  }

  if (
    backend.value ===
    "OBJECT_STORAGE"
  ) {
    return await getS3FileModifiedTime(
      folderPathOrId,
      filename
    );
  }

  const folderId =
    await resolveGoogleFolder(
      folderPathOrId
    );

  const metadata =
    await getFileMetadataByName(
      folderId,
      filename
    );

  return (
    metadata?.modifiedTime ??
    null
  );
}

/* =========================
   Folder metadata
========================= */

export async function getFolderModifiedTime(
  folderPathOrId: string
): Promise<string | null> {
  const files =
    await listFiles(
      folderPathOrId
    );

  const modifiedTimes =
    files
      .map(
        file =>
          file.modifiedTime
      )
      .filter(
        (
          time
        ): time is string =>
          Boolean(time)
      );

  if (
    !modifiedTimes.length
  ) {
    return null;
  }

  return (
    modifiedTimes
      .sort()
      .at(-1) ??
    null
  );
}