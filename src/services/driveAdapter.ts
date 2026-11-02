import {
  useStorageBackend,
} from "@/composables/useStorageBackend";

import {
  getLocalDirectory,
} from "@/services/local/localDirectory";

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
   Fichier listé
========================= */

/*
  Entrée renvoyée par listFiles :
  - Local Drive : id = nom du fichier ;
  - Object Storage : id = clé complète de l'objet,
    modifiedTime = LastModified.
*/
export interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
}

/* =========================
   Load JSON
========================= */

export async function loadJSONFromFolder<
  T = any
>(
  folderPath: string,
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
      folderPath,
      fileName
    );
  }

  return await readS3JSON<T>(
    buildS3Key(
      folderPath,
      fileName
    )
  );
}

/* =========================
   Find file
========================= */

export async function findFileByName(
  folderPath: string,
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
      folderPath,
      fileName
    );
  }

  return await findS3FileByName(
    folderPath,
    fileName
  );
}

/* =========================
   Download file
========================= */

export async function downloadFile(
  filePath: string
): Promise<string> {
  const {
    backend,
  } = useStorageBackend();

  if (
    backend.value ===
    "LOCAL_DRIVE"
  ) {
    return await downloadLocalFile(
      filePath
    );
  }

  return await downloadS3File(
    filePath
  );
}

/* =========================
   Save JSON
========================= */

export async function saveJSONToFolder(
  folderPath: string,
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
      folderPath,
      filename,
      data
    );

    return;
  }

  const s3Options:
    S3WriteJSONOptions = {
      requestPull:
        options.requestPull,

      reason:
        options.reason,
    };

  await writeS3JSON(
    buildS3Key(
      folderPath,
      filename
    ),
    data,
    s3Options
  );
}

/* =========================
   List files
========================= */

export async function listFiles(
  folderPath: string
): Promise<DriveItem[]> {
  const {
    backend,
  } = useStorageBackend();

  if (
    backend.value ===
    "LOCAL_DRIVE"
  ) {
    return await listLocalFilesInFolder(
      folderPath
    );
  }

  const files =
    await listS3FilesInFolder(
      folderPath
    );

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
  );
}

/* =========================
   Delete file
========================= */

export async function deleteFileFromFolder(
  folderPath: string,
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
      folderPath,
      filename
    );

    return;
  }

  /*
    La suppression S3 est effectuée ici.

    La publication d'un deletePath sera gérée
    par l'opération métier composée, afin d'éviter
    deux événements indépendants pour une release.
  */
  await deleteS3File(
    folderPath,
    filename
  );
}

/* =========================
   File metadata
========================= */

export async function getFileModifiedTime(
  folderPath: string,
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
        folderPath
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

  return await getS3FileModifiedTime(
    folderPath,
    filename
  );
}

/* =========================
   Folder metadata
========================= */

export async function getFolderModifiedTime(
  folderPath: string
): Promise<string | null> {
  const files =
    await listFiles(
      folderPath
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