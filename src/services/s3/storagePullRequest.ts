import type {
  S3WriteJSONPrimitive,
} from "@/services/s3/s3StorageAdapter";

/* =========================
   Types
========================= */

export type StoragePullSource =
  | "ipad"
  | "mac-pwa"
  | "browser";

/*
  Nouvelle définition d'une demande de synchronisation.

  downloadPaths :
    objets S3 à télécharger vers le stockage local.

  deletePaths :
    fichiers locaux à supprimer.

  paths :
    alias historique conservé temporairement pour
    pullObjectStorageEvents.scpt version 1.
*/
export interface StoragePullRequestPayload {
  downloadPaths: string[];
  deletePaths: string[];
  reason: string;

  /*
    Compatibilité transitoire.

    Doit contenir la même valeur que downloadPaths.
    Ce champ pourra être supprimé lorsque le Pull
    AppleScript utilisera downloadPaths.
  */
  paths: string[];
}

export interface StoragePullRequestEvent {
  eventId: string;
  type: "STORAGE_PULL_REQUESTED";

  /*
    Version 2 :
    ajout de downloadPaths et deletePaths.
  */
  typeVersion: 2;

  source: StoragePullSource;
  createdAt: string;

  schemaVersion: 2;

  payload: StoragePullRequestPayload;
}

/*
  Forme structurée recommandée pour les nouvelles
  opérations de synchronisation.
*/
export interface StoragePullRequestDefinition {
  downloadPaths?: string[];
  deletePaths?: string[];
  reason: string;
}

/* =========================
   Path rules
========================= */

const PULLABLE_PREFIXES = [
  "allocations/drafts/",
  "allocations/released/",
  "events/",
];

const EXCLUDED_EVENT_PREFIXES = [
  "events/control/",
  "events/processed/",
  "events/rejected/",
  "events/processing/",
];

/* =========================
   Path helpers
========================= */

function normalizePath(
  path: string
): string {
  return path
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/");
}

function normalizePathList(
  paths: string[] | undefined
): string[] {
  if (!paths?.length) {
    return [];
  }

  return [
    ...new Set(
      paths
        .map(normalizePath)
        .filter(Boolean)
    ),
  ];
}

function isExcludedPath(
  path: string
): boolean {
  return EXCLUDED_EVENT_PREFIXES.some(
    prefix =>
      path.startsWith(prefix)
  );
}

function isPullablePath(
  path: string
): boolean {
  if (
    isExcludedPath(path)
  ) {
    return false;
  }

  return PULLABLE_PREFIXES.some(
    prefix =>
      path.startsWith(prefix)
  );
}

function validateRequestPaths(
  downloadPaths: string[],
  deletePaths: string[]
): void {
  if (
    downloadPaths.length === 0 &&
    deletePaths.length === 0
  ) {
    throw new Error(
      "STORAGE_PULL_REQUEST_REQUIRES_OPERATION"
    );
  }

  const invalidDownloadPath =
    downloadPaths.find(
      path =>
        !isPullablePath(path)
    );

  if (invalidDownloadPath) {
    throw new Error(
      "STORAGE_PULL_REQUEST_INVALID_DOWNLOAD_PATH: " +
      invalidDownloadPath
    );
  }

  const invalidDeletePath =
    deletePaths.find(
      path =>
        !isPullablePath(path)
    );

  if (invalidDeletePath) {
    throw new Error(
      "STORAGE_PULL_REQUEST_INVALID_DELETE_PATH: " +
      invalidDeletePath
    );
  }

  const deleteSet =
    new Set(deletePaths);

  const conflictingPath =
    downloadPaths.find(
      path =>
        deleteSet.has(path)
    );

  if (conflictingPath) {
    throw new Error(
      "STORAGE_PULL_REQUEST_PATH_CONFLICT: " +
      conflictingPath
    );
  }
}

/* =========================
   Source detection
========================= */

function detectSource():
  StoragePullSource {
  const userAgent =
    navigator.userAgent;

  const isTouchDevice =
    navigator.maxTouchPoints > 1;

  const isIPad =
    /iPad/i.test(userAgent) ||
    (
      /Macintosh/i.test(
        userAgent
      ) &&
      isTouchDevice
    );

  if (isIPad) {
    return "ipad";
  }

  const isRealMac =
    /Macintosh/i.test(
      userAgent
    ) &&
    !isTouchDevice;

  if (isRealMac) {
    return "mac-pwa";
  }

  return "browser";
}

/* =========================
   Event ID
========================= */

function buildTimestampForId(
  date = new Date()
): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(
      /\.\d{3}Z$/,
      "Z"
    );
}

function buildEventId(
  source: StoragePullSource
): string {
  const timestamp =
    buildTimestampForId();

  const uuid =
    crypto.randomUUID();

  return `PWA-${timestamp}-${source}-${uuid}`;
}


/* =========================
   Public path decision
========================= */

export function shouldRequestStoragePull(
  path: string
): boolean {
  const normalized =
    normalizePath(path);

  return isPullablePath(
    normalized
  );
}

/* =========================
   Request normalization
========================= */

function buildRequestDefinition(
  definitionOrPaths:
    | StoragePullRequestDefinition
    | string[],

  reasonOrWriter:
    | string
    | S3WriteJSONPrimitive,

  optionalWriter?:
    S3WriteJSONPrimitive
): {
  definition:
    Required<
      Pick<
        StoragePullRequestDefinition,
        "reason"
      >
    > & {
      downloadPaths: string[];
      deletePaths: string[];
    };

  writePrimitive:
    S3WriteJSONPrimitive;
} {
  /*
    Historical signature:

    publishStoragePullRequest(
      paths,
      reason,
      writePrimitive
    )
  */
  if (
    Array.isArray(
      definitionOrPaths
    )
  ) {
    if (
      typeof reasonOrWriter !==
      "string"
    ) {
      throw new Error(
        "STORAGE_PULL_REQUEST_REASON_REQUIRED"
      );
    }

    if (!optionalWriter) {
      throw new Error(
        "STORAGE_PULL_REQUEST_WRITER_REQUIRED"
      );
    }

    return {
      definition: {
        downloadPaths:
          normalizePathList(
            definitionOrPaths
          ),

        deletePaths:
          [],

        reason:
          reasonOrWriter,
      },

      writePrimitive:
        optionalWriter,
    };
  }

  /*
    New structured signature:

    publishStoragePullRequest(
      {
        downloadPaths,
        deletePaths,
        reason
      },
      writePrimitive
    )
  */
  if (
    typeof reasonOrWriter !==
    "function"
  ) {
    throw new Error(
      "STORAGE_PULL_REQUEST_WRITER_REQUIRED"
    );
  }

  return {
    definition: {
      downloadPaths:
        normalizePathList(
          definitionOrPaths
            .downloadPaths
        ),

      deletePaths:
        normalizePathList(
          definitionOrPaths
            .deletePaths
        ),

      reason:
        definitionOrPaths.reason,
    },

    writePrimitive:
      reasonOrWriter,
  };
}

/* =========================
   Function overloads
========================= */

/*
  Historical call retained for compatibility.
*/
export function publishStoragePullRequest(
  paths: string[],
  reason: string,
  writePrimitive:
    S3WriteJSONPrimitive
): Promise<StoragePullRequestEvent>;

/*
  New structured call.
*/
export function publishStoragePullRequest(
  definition:
    StoragePullRequestDefinition,

  writePrimitive:
    S3WriteJSONPrimitive
): Promise<StoragePullRequestEvent>;

/* =========================
   Publish pull request
========================= */

export async function publishStoragePullRequest(
  definitionOrPaths:
    | StoragePullRequestDefinition
    | string[],

  reasonOrWriter:
    | string
    | S3WriteJSONPrimitive,

  optionalWriter?:
    S3WriteJSONPrimitive
): Promise<StoragePullRequestEvent> {
  const {
    definition,
    writePrimitive,
  } = buildRequestDefinition(
    definitionOrPaths,
    reasonOrWriter,
    optionalWriter
  );

  const {
    downloadPaths,
    deletePaths,
    reason,
  } = definition;

  if (
    !reason.trim()
  ) {
    throw new Error(
      "STORAGE_PULL_REQUEST_REASON_REQUIRED"
    );
  }

  validateRequestPaths(
    downloadPaths,
    deletePaths
  );

  const source =
    detectSource();

  const eventId =
    buildEventId(source);

  const createdAt =
    new Date().toISOString();

  const event:
    StoragePullRequestEvent = {
      eventId,

      type:
        "STORAGE_PULL_REQUESTED",

      typeVersion:
        2,

      source,

      createdAt,

      schemaVersion:
        2,

      payload: {
        downloadPaths,

        deletePaths,

        /*
          Alias historique.

          Le Pull AppleScript actuel lit payload.paths.
          Il continuera donc de télécharger les objets
          même avant son adaptation à la version 2.
        */
        paths:
          downloadPaths,

        reason:
          reason.trim(),
      },
    };

  await writePrimitive(
    `events/control/${eventId}.json`,
    event
  );

  return event;
}