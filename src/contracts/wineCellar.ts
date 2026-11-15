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
