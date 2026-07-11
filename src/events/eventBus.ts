import { writeS3JSON } from "@/services/s3/s3StorageAdapter";

export type EventSource =
  | "pwa"
  | "ipad"
  | "mac"
  | "scheduler"
  | "manual";

export interface HomeToolsEvent<TPayload = unknown> {
  eventId: string;
  type: string;
  typeVersion: number;
  source: EventSource;
  createdAt: string;
  schemaVersion: number;
  payload: TPayload;
}

function uuid(): string {
  return crypto.randomUUID();
}

function timestampForFileName(date = new Date()): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function detectEventSource(): EventSource {
  const ua = navigator.userAgent;
  const isTouch = navigator.maxTouchPoints > 1;

  if (isTouch && /iPad|Macintosh/.test(ua)) {
    return "ipad";
  }

  return "pwa";
}

export function buildEventId(
  type: string,
  source: EventSource = detectEventSource()
): string {
  const ts = timestampForFileName();
  const shortUuid = uuid().slice(0, 8);

  return `${ts}-${source}-${type}-${shortUuid}`;
}

export async function publishEvent<TPayload>(
  type: string,
  payload: TPayload,
  options?: {
    source?: EventSource;
    typeVersion?: number;
  }
): Promise<HomeToolsEvent<TPayload>> {
  const source = options?.source ?? detectEventSource();

  const event: HomeToolsEvent<TPayload> = {
    eventId: buildEventId(type, source),
    type,
    typeVersion: options?.typeVersion ?? 1,
    source,
    createdAt: new Date().toISOString(),
    schemaVersion: 1,
    payload,
  };

  await writeS3JSON(
    `events/pending/${event.eventId}.json`,
    event
  );

  return event;
}