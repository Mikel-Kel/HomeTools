import {
  asArray,
  asBoolean,
  asNumber,
  asObject,
  asString,
  type JsonObject,
} from "@/contracts/read";

/* =========================
   Indicateurs

   Contrat complet : ../Backend/docs/indicators-contract.md.
   Exports du dossier indicators/ (exportIndicators),
   republiés après chaque saisie.
========================= */

export const INDICATORS_FOLDER = "indicators";
export const INDICATORS_FILE = "indicators.json";

/*
  Familles saisies dans la PWA : Vehicles, Domestic,
  Weather. System et StockMarket sont alimentées par le
  backend.
*/
export const ENTRY_FAMILY_IDS = [1, 2, 3];

export const VEHICLES_FAMILY_ID = 1;

export function indicatorValuesFile(
  familyId: number
): string {
  return `values-${familyId}.json`;
}

/*
  Commentaire d'une valeur recopiée du mois précédent
  faute de relevé.
*/
export const LAST_KNOWN_VALUE_COMMENT =
  "<- last known value";

export function isCarriedForward(
  comment: string | null
): boolean {
  return (
    comment?.trim() ===
    LAST_KNOWN_VALUE_COMMENT
  );
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

function nullableNumber(
  value: unknown
): number | null {
  return typeof value === "number"
    ? value
    : null;
}

function nullableString(
  value: unknown
): string | null {
  return asString(value) || null;
}

/* =========================
   indicators/indicators.json

     { "families": [ { "familyId": 1, "label": "Vehicles",
                       "description": "…", "seq": 1 } ],
       "items": [ { "familyId": 1, "itemId": 16,
                    "label": "BMW Bagger",
                    "description": "Moto Michel",
                    "active": true, "seq": 4,
                    "openingDate": "2018-05-31",
                    "closingDate": null,
                    "cumulative": true,
                    "objectId": "878267" | null,
                    "groupTag": "Electricité" | null,
                    "service": { "intervalKm": 10000,
                                 "initialReviewKm": 1000,
                                 "lastServiceDate": "2025-07-24",
                                 "lastServiceKm": 48721,
                                 "nextServiceKm": 60000,
                                 "lastSanVisit": "2024-11-08",
                                 "sanFrequencyYears": 2 }
                               | null } ] }
========================= */

export interface IndicatorFamily {
  familyId: number;
  label: string;
  description: string;
  seq: number;
}

export interface VehicleService {
  intervalKm: number | null;
  initialReviewKm: number | null;
  lastServiceDate: string | null;
  lastServiceKm: number | null;
  nextServiceKm: number | null;
  lastSanVisit: string | null;

  /* Délai du contrôle périodique (SAN), en années. */
  sanFrequencyYears: number | null;
}

export interface IndicatorItem {
  familyId: number;
  itemId: number;
  label: string;
  description: string;
  seq: number;

  /*
    Période de mesure : première mesure, et dernière mesure
    d'un indicateur clôturé (null s'il est encore mesuré).
    Remplace l'attribut « actif » de l'export.
  */
  openingDate: string | null;
  closingDate: string | null;

  cumulative: boolean;

  /* Référence de l'objet mesuré (n° de compteur, plaque…). */
  objectId: string | null;

  /* Regroupement pour le reporting (somme de plusieurs indicateurs). */
  groupTag: string | null;

  service: VehicleService | null;
}

export interface IndicatorsFile {
  families: IndicatorFamily[];
  items: IndicatorItem[];
}

export function readIndicators(
  raw: unknown
): IndicatorsFile {
  const file =
    asObject(raw);

  return {
    families:
      objects(file?.families).map(
        family => ({
          familyId: asNumber(family.familyId),
          label: asString(family.label),
          description: asString(family.description).trim(),
          seq: asNumber(family.seq),
        })
      ),

    items:
      objects(file?.items).map(
        item => {
          const service =
            asObject(item.service);

          return {
            familyId: asNumber(item.familyId),
            itemId: asNumber(item.itemId),
            label: asString(item.label),
            description: asString(item.description),
            openingDate: nullableString(item.openingDate),
            closingDate: nullableString(item.closingDate),
            seq: asNumber(item.seq, Number.MAX_SAFE_INTEGER),
            cumulative: asBoolean(item.cumulative),
            objectId: nullableString(item.objectId),
            groupTag: asString(item.groupTag).trim() || null,

            service:
              service
                ? {
                    intervalKm: nullableNumber(service.intervalKm),
                    initialReviewKm: nullableNumber(service.initialReviewKm),
                    lastServiceDate: nullableString(service.lastServiceDate),
                    lastServiceKm: nullableNumber(service.lastServiceKm),
                    nextServiceKm: nullableNumber(service.nextServiceKm),
                    lastSanVisit: nullableString(service.lastSanVisit),
                    sanFrequencyYears: nullableNumber(service.sanFrequencyYears),
                  }
                : null,
          };
        }
      ),
  };
}

/*
  Indicateur mesuré pendant la période (dates ISO
  incluses) : ouvert au plus tard à la fin de la période,
  pas clôturé avant son début. Une date absente ne limite
  pas.
*/
export function isMeasuredDuring(
  item: IndicatorItem,
  from: string,
  to: string
): boolean {
  return (
    (item.openingDate === null || item.openingDate <= to) &&
    (item.closingDate === null || item.closingDate >= from)
  );
}

/* =========================
   indicators/values-<familyId>.json

     { "familyId": 1,
       "values": [ { "itemId": 16, "date": "2026-06-30",
                     "value": 50950, "comment": null,
                     "initialValue": null } ] }

   Dates : derniers jours de mois. initialValue : point de
   départ du calcul de consommation de ce relevé (achat,
   changement de compteur).
========================= */

export interface IndicatorValue {
  itemId: number;
  date: string;
  value: number;
  comment: string | null;
  initialValue: number | null;
}

export function readIndicatorValues(
  raw: unknown
): IndicatorValue[] {
  return objects(
    asObject(raw)?.values
  )
    .map(
      value => ({
        itemId: asNumber(value.itemId),
        date: asString(value.date),
        value: asNumber(value.value),
        comment: nullableString(value.comment),
        initialValue: nullableNumber(value.initialValue),
      })
    )
    .filter(
      value => value.date !== ""
    );
}

/* =========================
   indicators/history-<familyId>.json

   Historique préparé par le backend, affiché tel quel :
     { "familyId": 2,
       "groups": [ { "tag": "Electricité",
                     "description": "…",
                     "cumulative": true, "seq": 4,
                     "members": [4, 5, 7, 10, 11],
                     "years": [ { "year": 2026,
                                  "months": [12 × nombre | null],
                                  "monthAverage": 1403 | null,
                                  "quarters": [4 × nombre | null],
                                  "quarterAverage": 4209 | null } ] } ] }

   Un groupe par tag de regroupement ; règles de calcul dans
   le contrat (../Backend/docs/indicators-contract.md).
========================= */

export function indicatorHistoryFile(
  familyId: number
): string {
  return `history-${familyId}.json`;
}

export interface HistoryYear {
  year: number;
  months: (number | null)[];
  monthAverage: number | null;
  quarters: (number | null)[];
  quarterAverage: number | null;
}

export interface HistoryGroup {
  tag: string;
  description: string;
  cumulative: boolean;
  seq: number;
  years: HistoryYear[];
}

function nullableNumbers(
  value: unknown,
  length: number
): (number | null)[] {
  const values =
    asArray(value);

  return Array.from(
    { length },
    (_, index) => nullableNumber(values[index])
  );
}

export function readIndicatorHistory(
  raw: unknown
): HistoryGroup[] {
  return objects(
    asObject(raw)?.groups
  ).map(
    group => ({
      tag: asString(group.tag).trim(),
      description: asString(group.description).trim(),
      cumulative: asBoolean(group.cumulative),
      seq: asNumber(group.seq, Number.MAX_SAFE_INTEGER),

      years:
        objects(group.years).map(
          year => ({
            year: asNumber(year.year),
            months: nullableNumbers(year.months, 12),
            monthAverage: nullableNumber(year.monthAverage),
            quarters: nullableNumbers(year.quarters, 4),
            quarterAverage: nullableNumber(year.quarterAverage),
          })
        ),
    })
  );
}
