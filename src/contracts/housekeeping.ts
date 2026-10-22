import {
  asArray,
  asBoolean,
  asNumber,
  asObject,
  asString,
  ContractError,
} from "@/contracts/read";

/* =========================
   Fichiers
========================= */

export const HOUSEKEEPING_STEPS_FOLDER = "settings";
export const HOUSEKEEPING_STEPS_FILE = "housekeepingSteps.json";

export const HOUSEKEEPING_LOGS_FOLDER = "diagnostics";
export const HOUSEKEEPING_LOG_INDEX_FILE = "housekeepingLogIndex.json";

export function housekeepingLogFile(
  date: string
): string {
  return `housekeepingLog-${date}.json`;
}

/* =========================
   settings/housekeepingSteps.json

   Exporté par chaque housekeeping depuis le catalogue du
   backend (scripts/config/housekeepingSteps.json) :
     {
       "generatedAt": "2026-10-21T08:49:56Z",
       "steps": [
         { "key": "archiveReconcile", "label": "Reconcile archives",
           "group": "Archives", "manual": true, "nightly": true,
           "forces": ["exportArchiveToc"] },
         ...
       ]
     }
========================= */

export interface HousekeepingStep {
  key: string;
  label: string;
  group: string;
  manual: boolean;
  nightly: boolean;
  forces: string[];
}

export function readHousekeepingSteps(
  raw: unknown
): HousekeepingStep[] {
  const steps =
    asArray(
      asObject(raw)?.steps
    )
      .map(asObject)
      .filter(
        step =>
          step !== null &&
          asString(step.key) !== ""
      )
      .map(
        step => ({
          key: asString(step!.key),
          label: asString(step!.label, asString(step!.key)),
          group: asString(step!.group, "Other"),
          manual: asBoolean(step!.manual),
          nightly: asBoolean(step!.nightly),
          forces:
            asArray(step!.forces)
              .map(value => asString(value))
              .filter(Boolean),
        })
      );

  if (!steps.length) {
    throw new ContractError(
      HOUSEKEEPING_STEPS_FILE,
      "no step"
    );
  }

  return steps;
}

/* =========================
   diagnostics/housekeepingLogIndex.json
   diagnostics/housekeepingLog-{date}.json

   Publiés par housekeeping.applescript :
     { "runs": [
         { "date": "2026-08-27", "summary": "green", "lineCount": 142 }
     ] }

     { "date": "2026-08-27", "job": "Housekeeping",
       "summary": "green",
       "lines": [
         { "time": "23:10:02", "job": "CLEAN-UP",
           "level": "INFO", "text": "Housekeeping started" }
       ] }

   "summary" accepte red/yellow/green ou ok/warning/error.
   Les niveaux de ligne sont ceux de logLine (largeur fixe
   de 4 caractères : "OK  ", "ERR ").
========================= */

export type HealthLevel =
  | "ok"
  | "warning"
  | "error";

export type LogLineLevel =
  | "info"
  | "ok"
  | "warning"
  | "error";

export interface HousekeepingDay {
  date: string;
  summary: HealthLevel;
  lineCount: number;
}

export interface HousekeepingLogLine {
  time: string | null;
  job: string;
  level: LogLineLevel;
  text: string;
}

export interface HousekeepingLog {
  date: string;
  job: string;
  summary: HealthLevel;
  lines: HousekeepingLogLine[];
}

function readHealth(
  value: unknown
): HealthLevel {
  const token =
    asString(value)
      .trim()
      .toLowerCase();

  if (
    token === "red" ||
    token === "error"
  ) {
    return "error";
  }

  if (
    token === "yellow" ||
    token === "warning"
  ) {
    return "warning";
  }

  return "ok";
}

function readLineLevel(
  value: unknown
): LogLineLevel {
  switch (
    asString(value)
      .trim()
      .toUpperCase()
  ) {
    case "OK":
      return "ok";

    case "WARN":
      return "warning";

    case "ERR":
      return "error";

    default:
      return "info";
  }
}

/*
  Jours disponibles, du plus récent au plus ancien.
*/
export function readHousekeepingLogIndex(
  raw: unknown
): HousekeepingDay[] {
  return asArray(
    asObject(raw)?.runs
  )
    .map(asObject)
    .filter(
      day =>
        day !== null &&
        asString(day.date) !== ""
    )
    .map(
      day => ({
        date: asString(day!.date),
        summary: readHealth(day!.summary),
        lineCount: asNumber(day!.lineCount),
      })
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date)
    );
}

export function readHousekeepingLog(
  raw: unknown,
  date: string
): HousekeepingLog {
  const log =
    asObject(raw);

  return {
    date:
      asString(log?.date, date),

    job:
      asString(log?.job, "Housekeeping"),

    summary:
      readHealth(log?.summary),

    lines:
      asArray(log?.lines)
        .map(asObject)
        .filter(
          (line): line is NonNullable<typeof line> =>
            line !== null
        )
        .map(
          line => ({
            time:
              typeof line.time === "string"
                ? line.time
                : null,

            job:
              asString(line.job).trim(),

            level:
              readLineLevel(line.level),

            text:
              asString(line.text),
          })
        ),
  };
}
