import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

/* =========================
   Configuration
========================= */

const endpoint =
  import.meta.env.VITE_S3_ENDPOINT as string | undefined;

const region =
  import.meta.env.VITE_S3_REGION as string | undefined;

const bucket =
  import.meta.env.VITE_S3_BUCKET as string | undefined;

const accessKeyId =
  import.meta.env.VITE_S3_ACCESS_KEY_ID as string | undefined;

const secretAccessKey =
  import.meta.env.VITE_S3_SECRET_ACCESS_KEY as string | undefined;

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

/* =========================
   Configuration validation
========================= */

function assertConfig(): void {
  if (!endpoint) {
    throw new Error("Missing VITE_S3_ENDPOINT");
  }

  if (!region) {
    throw new Error("Missing VITE_S3_REGION");
  }

  if (!bucket) {
    throw new Error("Missing VITE_S3_BUCKET");
  }

  if (!accessKeyId) {
    throw new Error("Missing VITE_S3_ACCESS_KEY_ID");
  }

  if (!secretAccessKey) {
    throw new Error("Missing VITE_S3_SECRET_ACCESS_KEY");
  }
}

/* =========================
   S3 client
========================= */

const s3 = new S3Client({
  region,
  endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: accessKeyId ?? "",
    secretAccessKey: secretAccessKey ?? "",
  },
});

/* =========================
   Path helpers
========================= */

export function normalizeS3Path(path: string): string {
  return path
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/");
}

export function buildS3Key(
  folderPath: string,
  fileName: string
): string {
  const folder = normalizeS3Path(folderPath)
    .replace(/\/+$/, "");

  const file = normalizeS3Path(fileName);

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
  const parts = key.split("/");
  return parts.at(-1) ?? key;
}

/* =========================
   Error helpers
========================= */

function isNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== "object") {
    return false;
  }

  const candidate = err as {
    name?: string;
    Code?: string;
    $metadata?: {
      httpStatusCode?: number;
    };
  };

  return (
    candidate.name === "NoSuchKey" ||
    candidate.name === "NotFound" ||
    candidate.Code === "NoSuchKey" ||
    candidate.$metadata?.httpStatusCode === 404
  );
}

/* =========================
   Body conversion
========================= */

async function streamToText(
  body: unknown
): Promise<string> {
  if (!body) return "";

  const transformable = body as {
    transformToString?: (
      encoding?: string
    ) => Promise<string>;
  };

  if (
    typeof transformable.transformToString ===
    "function"
  ) {
    return await transformable.transformToString(
      "utf-8"
    );
  }

  return await new Response(
    body as BodyInit
  ).text();
}

/* =========================
   Read text
========================= */

export async function readS3Text(
  path: string
): Promise<string | null> {
  assertConfig();

  const key = normalizeS3Path(path);

  try {
    const response = await s3.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    return await streamToText(response.Body);

  } catch (err) {
    if (isNotFoundError(err)) {
      return null;
    }

    throw err;
  }
}

/* =========================
   Read JSON
========================= */

export async function readS3JSON<T = unknown>(
  path: string
): Promise<T | null> {
  const text = await readS3Text(path);

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
  contentType = "text/plain; charset=utf-8"
): Promise<void> {
  assertConfig();

  const key = normalizeS3Path(path);

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: content,
      ContentType: contentType,
    })
  );
}

/* =========================
   Write JSON
========================= */

export async function writeS3JSON(
  path: string,
  data: unknown
): Promise<void> {
  await writeS3Text(
    path,
    JSON.stringify(data, null, 2),
    "application/json; charset=utf-8"
  );
}

/* =========================
   Find file
========================= */

export async function findS3FileByName(
  folderPath: string,
  fileName: string
): Promise<S3StorageItem | null> {
  assertConfig();

  const key = buildS3Key(
    folderPath,
    fileName
  );

  try {
    const response = await s3.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    return {
      id: key,
      key,
      name: fileName,
      mimeType:
        response.ContentType ??
        "application/octet-stream",
      modifiedTime:
        response.LastModified?.toISOString() ??
        null,
      size:
        response.ContentLength ??
        null,
      etag:
        response.ETag?.replaceAll('"', "") ??
        null,
    };

  } catch (err) {
    if (isNotFoundError(err)) {
      return null;
    }

    throw err;
  }
}

/* =========================
   Download file
========================= */

export async function downloadS3File(
  key: string
): Promise<string> {
  const content = await readS3Text(key);

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

export async function listS3FilesInFolder(
  folderPath: string
): Promise<S3StorageItem[]> {
  assertConfig();

  const prefix =
    buildFolderPrefix(folderPath);

  const items: S3StorageItem[] = [];
  let continuationToken:
    | string
    | undefined;

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        Delimiter: "/",
        ContinuationToken:
          continuationToken,
      })
    );

    for (const object of response.Contents ?? []) {
      const key = object.Key;

      if (!key) continue;

      // Ignore un éventuel objet représentant
      // uniquement le dossier.
      if (key === prefix) continue;

      items.push({
        id: key,
        key,
        name: getFileNameFromKey(key),
        mimeType:
          key.toLowerCase().endsWith(".json")
            ? "application/json"
            : "application/octet-stream",
        modifiedTime:
          object.LastModified?.toISOString() ??
          null,
        size:
          object.Size ??
          null,
        etag:
          object.ETag?.replaceAll('"', "") ??
          null,
      });
    }

    continuationToken =
      response.IsTruncated
        ? response.NextContinuationToken
        : undefined;

  } while (continuationToken);

  return items;
}

/* =========================
   Delete file
========================= */

export async function deleteS3File(
  folderPath: string,
  fileName: string
): Promise<void> {
  assertConfig();

  const key = buildS3Key(
    folderPath,
    fileName
  );

  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}

/* =========================
   Metadata
========================= */

export async function getS3FileModifiedTime(
  folderPath: string,
  fileName: string
): Promise<string | null> {
  const file = await findS3FileByName(
    folderPath,
    fileName
  );

  return file?.modifiedTime ?? null;
}