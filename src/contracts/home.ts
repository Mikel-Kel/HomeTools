import {
  asArray,
  asNumber,
  asObject,
  asString,
  type JsonObject,
} from "@/contracts/read";

/* =========================
   Fichiers
========================= */

export const HOME_SUMMARY_FOLDER = "settings";
export const HOME_SUMMARY_FILE = "homeSummary.json";

export const APP_PARAMETERS_FOLDER = "settings";
export const APP_PARAMETERS_FILE = "AppParameters.json";

export const HOME_MESSAGES_FOLDER = "diagnostics";
export const HOME_MESSAGES_FILE = "homeMessages.json";

/* =========================
   Lecture des nombres
========================= */

function asNullableNumber(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function asNullableString(
  value: unknown
): string | null {
  return typeof value === "string" &&
    value.length > 0
    ? value
    : null;
}

/* =========================
   diagnostics/homeMessages.json

   Réinitialisé chaque nuit par housekeeping.applescript,
   complété par les étapes et les exécutions manuelles :
     { "messages": [ { "id": "…", "level": "ok" | "warning" | "error",
                       "text": "…" } ] }
   Du plus récent au plus ancien.
========================= */

export type HomeMessageLevel =
  | "ok"
  | "warning"
  | "error";

export interface HomeMessage {
  id: string;
  level: HomeMessageLevel;
  text: string;
}

export function readHomeMessages(
  raw: unknown
): HomeMessage[] {
  return asArray(
    asObject(raw)?.messages
  )
    .map(asObject)
    .filter(
      (message): message is JsonObject =>
        message !== null
    )
    .map(
      (message, index) => {
        const level =
          asString(message.level);

        return {
          id:
            String(message.id ?? index),

          level:
            level === "warning" ||
            level === "error"
              ? level
              : "ok",

          text:
            asString(message.text),
        };
      }
    );
}

/* =========================
   settings/homeSummary.json

   Exporté par exportHomeSummary :
     { "markets": {
         "indices":    [ { id, code, close, delta, ytd, y1, asOf } ],
         "fx":         [ { id, code, rate, tag, delta, ytd, y1, asOf } ],
         "securities": [ { id, code, close, delta, ytd, y1, asOf } ]
     } }
   Seuls les taux de change marqués tag "S" sont affichés.
========================= */

export interface Performance {
  change: number | null;
  ytd: number | null;
  y1: number | null;
  asOf: string | null;
}

export interface MarketIndex
  extends Performance {
  id: number;
  code: string;
  value: number;
}

export interface FXRate
  extends Performance {
  id: number;
  code: string;
  rate: number;
}

export interface SecurityQuote
  extends Performance {
  id: number;
  code: string;
  value: number | null;
}

export interface HomeSummary {
  indices: MarketIndex[];
  fx: FXRate[];
  securities: SecurityQuote[];
}

function readPerformance(
  item: JsonObject
): Performance {
  return {
    change: asNullableNumber(item.delta),
    ytd: asNullableNumber(item.ytd),
    y1: asNullableNumber(item.y1),
    asOf: asNullableString(item.asOf),
  };
}

function objects(
  value: unknown
): JsonObject[] {
  return asArray(value)
    .map(asObject)
    .filter(
      (item): item is JsonObject =>
        item !== null
    );
}

export function readHomeSummary(
  raw: unknown
): HomeSummary {
  const summary =
    asObject(raw);

  const markets =
    asObject(summary?.markets);

  return {
    indices:
      objects(markets?.indices).map(
        (item, index) => ({
          ...readPerformance(item),
          id: asNumber(item.id, index),
          code: asString(item.code),
          value: asNumber(item.close ?? item.value),
        })
      ),

    fx:
      objects(markets?.fx)
        .filter(
          item =>
            item.tag === "S"
        )
        .map(
          (item, index) => ({
            ...readPerformance(item),
            id: asNumber(item.id, index),
            code: asString(item.code),
            rate: asNumber(item.rate),
          })
        ),

    /*
      Emplacement attendu : markets.securities. La racine
      du fichier est tolérée si la section y est déplacée.
    */
    securities:
      objects(
        markets?.securities ??
        summary?.securities
      ).map(
        (item, index) => ({
          ...readPerformance(item),
          id: asNumber(item.id, index),
          code: asString(item.code),
          value:
            asNullableNumber(
              item.close ??
              item.value ??
              item.rate ??
              item.price
            ),
        })
      ),
  };
}

/* =========================
   settings/AppParameters.json — titres suivis

   securities.list : les titres affichés sur la page
   d’accueil, dans cet ordre, s’ils sont « enabled ».
========================= */

export interface SecurityParameter {
  code: string;
  description: string;
  isin: string | null;
  currency: string | null;
}

export function readSecurityParameters(
  raw: unknown
): SecurityParameter[] {
  return objects(
    asObject(
      asObject(raw)?.securities
    )?.list
  )
    .filter(
      security =>
        security.enabled === true
    )
    .map(
      security => ({
        code:
          asString(security.code),

        description:
          asString(
            security.description,
            asString(security.code)
          ),

        isin:
          asNullableString(security.isin),

        currency:
          asNullableString(security.currency),
      })
    );
}
