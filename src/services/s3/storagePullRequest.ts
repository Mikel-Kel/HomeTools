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

export interface StoragePullRequestPayload {
  paths: string[];
  reason: string;
}

export interface StoragePullRequestEvent {
  eventId: string;
  type: "STORAGE_PULL_REQUESTED";
  typeVersion: 1;
  source: StoragePullSource;
  createdAt: string;
  schemaVersion: 1;
  payload: StoragePullRequestPayload;
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
   Helpers
========================= */

function normalizePath(
  path: string
): string {
  return path
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/");
}

function detectSource():
  StoragePullSource {

  const ua =
    navigator.userAgent;

  const isTouchDevice =
    navigator.maxTouchPoints > 1;

  const isIPad =
    /iPad/i.test(ua) ||
    (
      /Macintosh/i.test(ua) &&
      isTouchDevice
    );

  if (isIPad) {
    return "ipad";
  }

  const isRealMac =
    /Macintosh/i.test(ua) &&
    !isTouchDevice;

  if (isRealMac) {
    return "mac-pwa";
  }

  return "browser";
}

function buildTimestampForId(
  date = new Date()
): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function buildEventId(
  source: StoragePullSource
): string {
  const timestamp =
    buildTimestampForId();

  const uuid =
    crypto.randomUUID();

  return `${timestamp}-${source}-${uuid}`;
}

/* =========================
   Public path decision
========================= */

export function shouldRequestStoragePull(
  path: string
): boolean {
  const normalized =
    normalizePath(path);

  const excluded =
    EXCLUDED_EVENT_PREFIXES.some(
      prefix =>
        normalized.startsWith(prefix)
    );

  if (excluded) {
    return false;
  }

  return PULLABLE_PREFIXES.some(
    prefix =>
      normalized.startsWith(prefix)
  );
}

/* =========================
   Publish pull request
========================= */

export async function publishStoragePullRequest(
  paths: string[],
  reason: string,
  writePrimitive: S3WriteJSONPrimitive
): Promise<StoragePullRequestEvent> {
  const normalizedPaths = [
    ...new Set(
      paths
        .map(normalizePath)
        .filter(Boolean)
    ),
  ];

  if (!normalizedPaths.length) {
    throw new Error(
      "STORAGE_PULL_REQUEST_REQUIRES_PATH"
    );
  }

  const source =
    detectSource();

  const eventId =
    buildEventId(source);

  const event:
    StoragePullRequestEvent = {
      eventId,
      type:
        "STORAGE_PULL_REQUESTED",
      typeVersion: 1,
      source,
      createdAt:
        new Date().toISOString(),
      schemaVersion: 1,

      payload: {
        paths:
          normalizedPaths,
        reason,
      },
    };

  await writePrimitive(
    `events/control/${eventId}.json`,
    event
  );

  return event;
}