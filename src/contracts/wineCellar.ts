import {
  asArray,
  asNumber,
  asObject,
  asString,
  ContractError,
  type JsonObject,
} from "@/contracts/read";

/* =========================
   Cave à vins

   Contrat complet : ../Backend/docs/wine-cellar-contract.md
   (§ 2 format, § 7 côté PWA). Capacité wineCellar
   (contrat multi-environnements § 3.4).

   wine/cellar.json (exportWineCellar, republié après chaque
   événement WIN et par le housekeeping) :
     { "version": 1, "generatedAt": "…",
       "locations": [ { "id": 7, "shelf": "EC", "level": "6",
                        "label": "EC6" } ],
       "wines": [ { "id": 12, "name": "…", "vintage": 1989,
                    "country": "France", "region": "Pauillac",
                    "color": "Red", "winery": null,
                    "quantity": 1, "locationId": 7,
                    "priceChf": 100.0, "favorite": false,
                    "drinkBefore": 2010, "holdUntil": null,
                    "purchasedAt": null, "comments": "…",
                    "photo": null, "updatedAt": "…",
                    "tastings": [ { "id": 31, "date": "2016-12",
                                    "note": "…" } ] } ] }

   Emplacements triés par étagère puis étage, vins par nom
   puis millésime, tous compris (quantity 0 = vin bu,
   historique). Dégustations de la plus récente à la plus
   ancienne ; dates partielles possibles (AAAA, AAAA-MM,
   AAAA-xx), gardées telles quelles.

   Valeur absente ou invalide : null ; favorite : false ;
   tastings et locations : [].
========================= */

export const WINE_CELLAR_FOLDER = "wine";

export const WINE_CELLAR_FILE = "cellar.json";

/* Couleurs admises par le backend (§ 1). */
export const WINE_COLORS = [
  "Red",
  "White",
  "Rosé",
  "Sparkling",
  "Dessert",
] as const;

export interface WineLocation {
  id: number;
  shelf: string;
  level: string | null;
  label: string;
}

export interface WineTasting {
  id: number;
  date: string;
  note: string;
}

export interface Wine {
  id: number;
  name: string;
  vintage: number | null;
  country: string | null;
  region: string | null;
  color: string | null;
  winery: string | null;
  quantity: number;
  locationId: number | null;
  priceChf: number | null;
  favorite: boolean;
  drinkBefore: number | null;
  holdUntil: number | null;
  purchasedAt: string | null;
  comments: string | null;
  photo: string | null;
  updatedAt: string | null;
  tastings: WineTasting[];
}

export interface WineCellarData {
  generatedAt: string | null;
  locations: WineLocation[];
  wines: Wine[];
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

/* Texte facultatif : vide ou absent = null. */
function asNullableText(
  value: unknown
): string | null {
  return asString(value).trim()
    ? asString(value)
    : null;
}

/* Nombre facultatif : absent ou invalide = null. */
function asNullableNumber(
  value: unknown
): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : null;
}

/* Identifiant : entier, sinon null (élément ignoré). */
function asId(
  value: unknown
): number | null {
  const id =
    asNullableNumber(value);

  return id !== null && Number.isInteger(id)
    ? id
    : null;
}

function readLocation(
  location: JsonObject
): WineLocation | null {
  const id =
    asId(location.id);

  if (id === null) {
    return null;
  }

  const shelf =
    asString(location.shelf);

  return {
    id,
    shelf,
    level: asNullableText(location.level),
    label: asNullableText(location.label) ?? shelf,
  };
}

function readTasting(
  tasting: JsonObject
): WineTasting | null {
  const id =
    asId(tasting.id);

  return id === null
    ? null
    : {
        id,
        date: asString(tasting.date),
        note: asString(tasting.note),
      };
}

function readWine(
  wine: JsonObject
): Wine | null {
  const id =
    asId(wine.id);

  if (id === null) {
    return null;
  }

  return {
    id,
    name: asString(wine.name),
    vintage: asNullableNumber(wine.vintage),
    country: asNullableText(wine.country),
    region: asNullableText(wine.region),
    color: asNullableText(wine.color),
    winery: asNullableText(wine.winery),
    quantity: Math.max(0, asNumber(wine.quantity)),
    locationId: asId(wine.locationId),
    priceChf: asNullableNumber(wine.priceChf),
    favorite: wine.favorite === true,
    drinkBefore: asNullableNumber(wine.drinkBefore),
    holdUntil: asNullableNumber(wine.holdUntil),
    purchasedAt: asNullableText(wine.purchasedAt),
    comments: asNullableText(wine.comments),
    photo: asNullableText(wine.photo),
    updatedAt: asNullableText(wine.updatedAt),

    tastings: objects(wine.tastings)
      .map(readTasting)
      .filter(
        (tasting): tasting is WineTasting =>
          tasting !== null
      ),
  };
}

export function readWineCellar(
  raw: unknown
): WineCellarData {
  const file =
    asObject(raw);

  if (
    !file ||
    asNumber(file.version) !== 1 ||
    !Array.isArray(file.wines)
  ) {
    throw new ContractError(
      WINE_CELLAR_FILE,
      "invalid format"
    );
  }

  return {
    generatedAt: asNullableText(file.generatedAt),

    locations: objects(file.locations)
      .map(readLocation)
      .filter(
        (location): location is WineLocation =>
          location !== null
      ),

    wines: objects(file.wines)
      .map(readWine)
      .filter(
        (wine): wine is Wine =>
          wine !== null
      ),
  };
}

/* =========================
   Événements émis par la PWA (§ 3)

   events/PWA-WIN_<AAAAMMJJHHMMSS>_W<WineID ou NEW>.json
   (vins, stock, dégustations) et
   events/PWA-WIN_<AAAAMMJJHHMMSS>_L<LocationID ou NEW>.json
   (emplacements). { eventType, version: 1, timestamp,
   payload: { …, source } } ; statut écrit par
   processEvent_WIN, message affiché tel quel.
========================= */

export const WINE_EVENT_TRIGRAM = "WIN";

export const WINE_EVENT_VERSION = 1;

export type WineEventType =
  | "WINE_SAVED"
  | "WINE_STOCK_CHANGED"
  | "WINE_TASTING_SAVED"
  | "WINE_TASTING_DELETED"
  | "WINE_DELETED"
  | "WINE_LOCATION_SAVED"
  | "WINE_LOCATION_DELETED";

/*
  WINE_SAVED : payload { wineId, name, vintage, country,
  region, color, winery, locationId, priceChf, favorite,
  drinkBefore, holdUntil, purchasedAt, comments, quantity,
  source }. wineId null : création, quantity = stock
  initial ; modification : tous les champs remplacés,
  quantity ignoré. Refus : nom vide ou de plus de 100
  caractères, années hors de 1900–2100, couleur hors de
  WINE_COLORS, emplacement inconnu, prix négatif, date
  d'achat invalide, quantity négative, vin inconnu.
  Longueurs des colonnes (§ 1) : pays et région 50,
  producteur 100.
*/
export const WINE_NAME_MAX_LENGTH = 100;
export const WINE_COUNTRY_MAX_LENGTH = 50;
export const WINE_REGION_MAX_LENGTH = 50;
export const WINE_WINERY_MAX_LENGTH = 100;
export const WINE_YEAR_MIN = 1900;
export const WINE_YEAR_MAX = 2100;

export interface WineSave {
  wineId: number | null;
  name: string;
  vintage: number | null;
  country: string | null;
  region: string | null;
  color: string | null;
  winery: string | null;
  locationId: number | null;
  priceChf: number | null;
  favorite: boolean;
  drinkBefore: number | null;
  holdUntil: number | null;
  purchasedAt: string | null;
  comments: string | null;
  quantity: number;
}

/*
  WINE_DELETED : payload { wineId, source }. Efface
  définitivement la fiche, ses dégustations et son journal
  du stock ; un vin bu reste normalement dans l'historique
  (quantity 0).
*/

/*
  WINE_STOCK_CHANGED : payload { wineId, delta, reason,
  source }. Variation (jamais une quantité) : deux appareils
  ne s'écrasent pas. Refus : delta nul ou non entier, stock
  qui deviendrait négatif.
*/
export type WineStockReason =
  | "purchase"
  | "opened"
  | "correction";

export interface WineStockChange {
  wineId: number;
  delta: number;
  reason: WineStockReason;
}

/*
  WINE_TASTING_SAVED : payload { wineId, tastingId, date,
  note, bottleOpened, source } ; tastingId null : ajout.
  date AAAA-MM-JJ, ni invalide ni future ; une date
  partielle importée peut rester inchangée. bottleOpened
  (ajout seulement) retire aussi une bouteille.
  WINE_TASTING_DELETED : payload { wineId, tastingId, source }.
*/
export const TASTING_NOTE_MAX_LENGTH = 500;

export interface WineTastingSave {
  wineId: number;
  tastingId: number | null;
  date: string;
  note: string;
  bottleOpened: boolean;
}

/*
  WINE_LOCATION_SAVED : payload { locationId, shelf, level,
  source } ; locationId null : création. Refus : étagère
  vide ou de plus de 50 caractères, étage de plus de 20,
  couple (shelf, level) déjà utilisé (casse, accents et
  espaces de fin ignorés ; deux emplacements sans étage ne
  partagent pas une étagère).
  WINE_LOCATION_DELETED : payload { locationId, source } ;
  refus si un vin s'y trouve (en stock ou bu).
*/
export const LOCATION_SHELF_MAX_LENGTH = 50;
export const LOCATION_LEVEL_MAX_LENGTH = 20;

export interface WineLocationSave {
  locationId: number | null;
  shelf: string;
  level: string | null;
}

/*
  Libellé calculé par le backend (§ 1), pour l'aperçu :
  <Shelf><Level> si l'étagère est faite de lettres et
  l'étage commence par un chiffre (EC6), <Shelf> (<Level>)
  sinon, <Shelf> sans étage.
*/
export function locationLabel(
  shelf: string,
  level: string | null
): string {
  if (!level) {
    return shelf;
  }

  return /^\p{L}+$/u.test(shelf) && /^\d/.test(level)
    ? `${shelf}${level}`
    : `${shelf} (${level})`;
}

/* Suffixe du nom de fichier d'un événement de vin (null : création). */
export function wineEventSuffix(
  wineId: number | null
): string {
  return `W${wineId ?? "NEW"}`;
}

/* Suffixe du nom de fichier d'un événement d'emplacement (null : création). */
export function locationEventSuffix(
  locationId: number | null
): string {
  return `L${locationId ?? "NEW"}`;
}
