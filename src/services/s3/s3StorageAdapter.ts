import {
  publishStoragePullRequest,
  shouldRequestStoragePull,
  type StoragePullRequestDefinition,
  type StoragePullRequestEvent,
} from "@/services/s3/storagePullRequest";


/* =========================
   Configuration
========================= */

/*
  Depuis l'introduction du proxy Tailscale, la PWA ne
  parle plus jamais directement a Hetzner : ni cles S3,
  ni SDK AWS cote navigateur.

  Le proxy (Python/Flask, sur le Mac, expose via
  `tailscale serve`) signe les requetes S3 lui-meme.
  La PWA n'a besoin que de son URL et d'une cle d'API
  partagee pour s'authentifier aupres du proxy.
*/

const proxyUrl =
  import.meta.env.VITE_PROXY_URL as string | undefined;

const proxyApiKey =
  import.meta.env.VITE_PROXY_API_KEY as string | undefined;


function assertConfig(): void {
  if (!proxyUrl) {
    throw new Error("Missing VITE_PROXY_URL");
  }

  if (!proxyApiKey) {
    throw new Error("Missing VITE_PROXY_API_KEY");
  }
}


/* =========================
   Public types
========================= */

export interface S3StorageItem {
  id: string;
  name: string;
  key: string;
  mimeType: string;
  modifiedTime: string | null;
  size: number | null;
  etag: string | null;
}

export type S3WriteJSONPrimitive = (
  path: string,
  data: unknown
) => Promise<void>;

export interface S3WriteJSONOptions {
  /*
    undefined :
      comportement automatique selon le chemin

    true :
      force la demande de pull

    false :
      interdit la demande de pull
  */
  requestPull?: boolean;

  reason?: string;
}


/* =========================
   Proxy fetch helper
========================= */

function buildProxyUrl(
  path: string,
  params?: Record<string, string>
): string {
  const base =
    (proxyUrl ?? "").replace(
      /\/+$/,
      ""
    );

  const url =
    new URL(base + path);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}


async function proxyFetch(
  path: string,
  init: RequestInit = {},
  params?: Record<string, string>
): Promise<Response> {
  assertConfig();

  const url =
    buildProxyUrl(path, params);

  return await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      "X-Proxy-Key":
        proxyApiKey ?? "",

      ...(init.headers ?? {}),
    },
  });
}


/* =========================
   Path helpers
========================= */

export function normalizeS3Path(
  path: string
): string {
  return path
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/");
}

export function buildS3Key(
  folderPath: string,
  fileName: string
): string {
  const folder =
    normalizeS3Path(folderPath)
      .replace(/\/+$/, "");

  const file =
    normalizeS3Path(fileName);

  return folder
    ? `${folder}/${file}`
    : file;
}

function buildFolderPrefix(
  folderPath: string
): string {
  const normalized =
    normalizeS3Path(folderPath)
      .replace(/\/+$/, "");

  return normalized
    ? `${normalized}/`
    : "";
}

function getFileNameFromKey(
  key: string
): string {
  const parts =
    key.split("/");

  return (
    parts.at(-1) ??
    key
  );
}

function isJSONPath(
  path: string
): boolean {
  return path
    .toLowerCase()
    .endsWith(".json");
}


/* =========================
   Publish explicit pull request
========================= */

/*
  Permet à une opération métier composée de publier
  un seul événement de synchronisation après avoir
  effectué plusieurs écritures et suppressions S3.

  La primitive interne est utilisée directement afin
  que l'écriture dans events/control ne génère jamais
  récursivement une nouvelle demande de Pull.
*/
export async function publishS3StoragePullRequest(
  definition: StoragePullRequestDefinition
): Promise<StoragePullRequestEvent> {
  assertConfig();

  return await publishStoragePullRequest(
    definition,
    writeS3JSONPrimitive
  );
}


/* =========================
   Read text
========================= */

export async function readS3Text(
  path: string
): Promise<string | null> {
  const key =
    normalizeS3Path(path);

  const response =
    await proxyFetch(
      "/api/s3/read",
      { method: "GET" },
      { key }
    );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `S3 proxy read failed: HTTP ${response.status} for ${key}`
    );
  }

  return await response.text();
}


/* =========================
   Read JSON
========================= */

export async function readS3JSON<
  T = unknown
>(
  path: string
): Promise<T | null> {
  const text =
    await readS3Text(path);

  if (text === null) {
    return null;
  }

  try {
    return JSON.parse(text) as T;

  } catch (err) {
    throw new Error(
      `Invalid JSON in S3 object "${path}": ${
        err instanceof Error
          ? err.message
          : String(err)
      }`
    );
  }
}


/* =========================
   Write text
========================= */

export async function writeS3Text(
  path: string,
  content: string,
  contentType =
    "text/plain; charset=utf-8"
): Promise<void> {
  const key =
    normalizeS3Path(path);

  const response =
    await proxyFetch(
      "/api/s3/write",
      {
        method: "PUT",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          key,
          content,
          contentType,
        }),
      }
    );

  if (!response.ok) {
    throw new Error(
      `S3 proxy write failed: HTTP ${response.status} for ${key}`
    );
  }
}


/* =========================
   Primitive JSON writer
========================= */

const writeS3JSONPrimitive:
  S3WriteJSONPrimitive =
  async (
    path,
    data
  ): Promise<void> => {
    await writeS3Text(
      path,
      JSON.stringify(data, null, 2),
      "application/json; charset=utf-8"
    );
  };


/* =========================
   Write JSON
========================= */

export async function writeS3JSON(
  path: string,
  data: unknown,
  options:
    S3WriteJSONOptions = {}
): Promise<void> {
  const key =
    normalizeS3Path(path);

  /*
    1. Écriture de l'objet métier.
  */
  await writeS3JSONPrimitive(
    key,
    data
  );

  /*
    2. Publication éventuelle d'une demande
       de Pull ciblée pour le Mac.

    Les événements de contrôle eux-mêmes
    sont exclus par shouldRequestStoragePull().
  */
  const requestPull =
    options.requestPull ??
    shouldRequestStoragePull(key);

  if (!requestPull) {
    return;
  }

  await publishStoragePullRequest(
    {
      downloadPaths: [key],
      deletePaths: [],

      reason:
        options.reason ??
        "S3_FILE_WRITTEN",
    },
    writeS3JSONPrimitive
  );
}


/* =========================
   Find file
========================= */

interface ProxyHeadResponse {
  key: string;
  contentType: string | null;
  lastModified: string | null;
  size: number | null;
  etag: string | null;
}

export async function findS3FileByName(
  folderPath: string,
  fileName: string
): Promise<S3StorageItem | null> {
  const key =
    buildS3Key(folderPath, fileName);

  const response =
    await proxyFetch(
      "/api/s3/head",
      { method: "GET" },
      { key }
    );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `S3 proxy head failed: HTTP ${response.status} for ${key}`
    );
  }

  const data =
    (await response.json()) as ProxyHeadResponse;

  return {
    id: key,
    key,
    name: fileName,

    mimeType:
      data.contentType ??
      "application/octet-stream",

    modifiedTime:
      data.lastModified,

    size:
      data.size,

    etag:
      data.etag,
  };
}


/* =========================
   Download file
========================= */

export async function downloadS3File(
  key: string
): Promise<string> {
  const content =
    await readS3Text(key);

  if (content === null) {
    throw new Error(
      `S3 object not found: ${key}`
    );
  }

  return content;
}


/* =========================
   List files
========================= */

interface ProxyListItem {
  key: string;
  lastModified: string | null;
  size: number | null;
  etag: string | null;
}

interface ProxyListResponse {
  items: ProxyListItem[];
}

export async function listS3FilesInFolder(
  folderPath: string
): Promise<S3StorageItem[]> {
  const prefix =
    buildFolderPrefix(folderPath);

  const response =
    await proxyFetch(
      "/api/s3/list",
      { method: "GET" },
      { prefix }
    );

  if (!response.ok) {
    throw new Error(
      `S3 proxy list failed: HTTP ${response.status} for prefix "${prefix}"`
    );
  }

  const data =
    (await response.json()) as ProxyListResponse;

  return data.items.map((item) => ({
    id: item.key,
    key: item.key,

    name:
      getFileNameFromKey(item.key),

    mimeType:
      isJSONPath(item.key)
        ? "application/json"
        : "application/octet-stream",

    modifiedTime:
      item.lastModified,

    size:
      item.size,

    etag:
      item.etag,
  }));
}


/* =========================
   Delete file
========================= */

export async function deleteS3File(
  folderPath: string,
  fileName: string
): Promise<void> {
  const key =
    buildS3Key(folderPath, fileName);

  const response =
    await proxyFetch(
      "/api/s3/delete",
      { method: "DELETE" },
      { key }
    );

  if (!response.ok) {
    throw new Error(
      `S3 proxy delete failed: HTTP ${response.status} for ${key}`
    );
  }
}


/* =========================
   Metadata
========================= */

export async function getS3FileModifiedTime(
  folderPath: string,
  fileName: string
): Promise<string | null> {
  const file =
    await findS3FileByName(
      folderPath,
      fileName
    );

  return (
    file?.modifiedTime ??
    null
  );
}
