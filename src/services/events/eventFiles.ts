import {
  loadJSONFromFolder,
  saveJSONToFolder,
} from "@/services/driveAdapter";

import {
  asObject,
  asString,
} from "@/contracts/read";

/* =========================
   Événements émis par la PWA

   events/PWA-<TRI>_<AAAAMMJJHHMMSS>[_<suffixe>].json

   Le trigramme désigne le script qui traite l’événement
   (processEvent_<TRI>). Toujours préfixé « PWA- », Local
   Drive compris : le Mac n’écrit un statut dans
   events/status/<même nom> que pour les événements ainsi
   nommés.

   Statut écrit par processEvents :
     { "status": "success" | "error", "message": "…",
       "finishedAt": "…" }
========================= */

export const EVENTS_FOLDER = "events";
export const EVENT_STATUS_FOLDER = "events/status";

export interface EventStatus {
  status: string;
  message: string;
}

function timestamp(
  date: Date
): string {
  const pad = (value: number) =>
    String(value).padStart(2, "0");

  return (
    `${date.getFullYear()}` +
    `${pad(date.getMonth() + 1)}` +
    `${pad(date.getDate())}` +
    `${pad(date.getHours())}` +
    `${pad(date.getMinutes())}` +
    `${pad(date.getSeconds())}`
  );
}

export function buildEventFileName(
  trigram: string,
  suffix?: string
): string {
  const stamp =
    timestamp(new Date());

  return suffix
    ? `PWA-${trigram}_${stamp}_${suffix}.json`
    : `PWA-${trigram}_${stamp}.json`;
}

/*
  Reconnaît aussi les noms sans préfixe, émis par les
  versions précédentes en Local Drive. Groupe 1 : suffixe.
*/
export function eventFilePattern(
  trigram: string
): RegExp {
  return new RegExp(
    `^(?:PWA-)?${trigram}_\\d{14}(?:_(.+))?\\.json$`
  );
}

/*
  Écrit l’événement dans events/ et retourne le nom du
  fichier, qui sert ensuite à suivre son statut.
*/
export async function emitEvent(
  trigram: string,
  event: object,
  suffix?: string
): Promise<string> {
  const fileName =
    buildEventFileName(
      trigram,
      suffix
    );

  await saveJSONToFolder(
    EVENTS_FOLDER,
    fileName,
    event
  );

  return fileName;
}

export async function loadEventStatus(
  fileName: string
): Promise<EventStatus | null> {
  const raw =
    await loadJSONFromFolder(
      EVENT_STATUS_FOLDER,
      fileName
    ).catch(() => null);

  const status =
    asObject(raw);

  if (!status) {
    return null;
  }

  return {
    status:
      asString(status.status),

    message:
      asString(status.message),
  };
}
