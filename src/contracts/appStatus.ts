import {
  asBoolean,
  asObject,
  asString,
} from "@/contracts/read";

/* =========================
   settings/appStatus.json

     { "version": 1, "maintenance": true,
       "message": "…", "since": "2026-11-02T14:00:00Z" }

   Écrit par le Mac (app myTooling, section Maintenance) ;
   contrat : ../Backend/docs/app-status-contract.md.
   Fichier absent ou illisible : app disponible.
========================= */

export const APP_STATUS_FOLDER = "settings";

export const APP_STATUS_FILE = "appStatus.json";

export interface AppStatus {
  maintenance: boolean;
  message: string;
  since: string | null;
}

export function readAppStatus(
  raw: unknown
): AppStatus {
  const data =
    asObject(raw);

  return {
    maintenance:
      asBoolean(data?.maintenance),

    message:
      asString(data?.message).trim(),

    since:
      asString(data?.since) || null,
  };
}
