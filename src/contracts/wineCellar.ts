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
   (§ 2 format, § 7 côté PWA). Capacité
   wineCellar (contrat multi-environnements § 3.4).

   wine/cellar.json (exportWineCellar, version 2, republié
   après chaque événement WIN et par le housekeeping) :
   listes de référence complètes (éléments inutilisés
   compris) et identifiants dans les vins, qui gardent les
   libellés résolus :
     { "version": 2, "generatedAt": "…",
       "countries":   [ { "id": 1, "name": "France" } ],
       "regions":     [ { "id": 9, "countryId": 1,
                          "name": "Pauillac" } ],
       "wineries":    [ { "id": 1, "name": "…" } ],
       "bottleSizes": [ { "id": 1, "name": "Bottle 75 cl",
                          "factor": 1, "sortOrder": 10 } ],
       "locations":   [ { "id": 3, "name": "EC",
                          "levelCount": 7 } ],
       "wines": [ { "id": 12, "name": "…", "vintage": 1989,
                    "country": "France", "countryId": 1,
                    "region": "Pauillac", "regionId": 9,
                    "color": "Red", "winery": null,
                    "wineryId": null, "bottleSizeId": 1,
                    "bottleSize": "Bottle 75 cl",
                    "quantity": 1, "locationId": 3,
                    "location": "EC", "locationLevel": 6,
                    "locationLabel": "EC6",
                    "priceChf": 100.0, "favorite": false,
                    "drinkBefore": 2010, "holdUntil": null,
                    "purchasedAt": null, "comments": "…",
                    "photo": "wine/Etiquettes/w12.jpg",
                    "updatedAt": "…",
                    "tastings": [ { "id": 31, "date": "2016-12",
                                    "note": "…" } ] } ] }
   Un emplacement y est un meuble nommé, avec un nombre
   d'étages facultatif (1 en haut) ; l'étage est dans le vin.

   Vins triés par nom puis millésime, tous compris
   (quantity 0 = vin bu, historique). Dégustations de la plus
   récente à la plus ancienne ; dates partielles possibles
   (AAAA, AAAA-MM, AAAA-xx), gardées telles quelles.

   Valeur absente ou invalide : null ; favorite : false ;
   listes : []. La version 1 (avant W6) n'est plus produite
   par le backend : refusée.
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

/* Meuble nommé, étages facultatifs (1 en haut). */
export interface WineLocation {
  id: number;
  name: string;
  levelCount: number | null;
}

export interface WineCountry {
  id: number;
  name: string;
}

export interface WineRegion {
  id: number;
  countryId: number | null;
  name: string;
}

export interface Winery {
  id: number;
  name: string;
}

export interface WineBottleSize {
  id: number;
  name: string;
  factor: number | null;
  sortOrder: number | null;
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

  /* Libellé affiché de l'emplacement, avec l'étage. */
  locationLabel: string | null;

  countryId: number | null;
  regionId: number | null;
  wineryId: number | null;
  bottleSizeId: number | null;
  bottleSize: string | null;
  location: string | null;
  locationLevel: number | null;
}

export interface WineCellar {
  generatedAt: string | null;
  locations: WineLocation[];
  countries: WineCountry[];
  regions: WineRegion[];
  wineries: Winery[];
  bottleSizes: WineBottleSize[];
  wines: Wine[];
}

/* Éléments d'une liste, ceux sans identifiant entier ignorés. */
function items<T>(
  value: unknown,
  read: (item: JsonObject) => T | null
): T[] {
  return asArray(value)
    .map(asObject)
    .filter(
      (item): item is JsonObject =>
        item !== null
    )
    .map(read)
    .filter(
      (item): item is T =>
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

/* Entier facultatif (identifiant, étage) : sinon null. */
function asId(
  value: unknown
): number | null {
  const id =
    asNullableNumber(value);

  return id !== null && Number.isInteger(id)
    ? id
    : null;
}

/* Élément nommé d'une liste de référence. */
function readNamed(
  item: JsonObject
): { id: number; name: string } | null {
  const id =
    asId(item.id);

  return id === null
    ? null
    : { id, name: asString(item.name) };
}

function readLocation(
  location: JsonObject
): WineLocation | null {
  const named =
    readNamed(location);

  return named && {
    ...named,
    levelCount: asId(location.levelCount),
  };
}

function readRegion(
  region: JsonObject
): WineRegion | null {
  const named =
    readNamed(region);

  return named && {
    ...named,
    countryId: asId(region.countryId),
  };
}

function readBottleSize(
  size: JsonObject
): WineBottleSize | null {
  const named =
    readNamed(size);

  return named && {
    ...named,
    factor: asNullableNumber(size.factor),
    sortOrder: asId(size.sortOrder),
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
    tastings: items(wine.tastings, readTasting),

    locationLabel: asNullableText(wine.locationLabel),
    countryId: asId(wine.countryId),
    regionId: asId(wine.regionId),
    wineryId: asId(wine.wineryId),
    bottleSizeId: asId(wine.bottleSizeId),
    bottleSize: asNullableText(wine.bottleSize),
    location: asNullableText(wine.location),
    locationLevel: asId(wine.locationLevel),
  };
}

export function readWineCellar(
  raw: unknown
): WineCellar {
  const file =
    asObject(raw);

  if (
    !file ||
    asNumber(file.version) !== 2 ||
    !Array.isArray(file.wines)
  ) {
    throw new ContractError(
      WINE_CELLAR_FILE,
      "invalid format"
    );
  }

  return {
    generatedAt: asNullableText(file.generatedAt),
    locations: items(file.locations, readLocation),
    countries: items(file.countries, readNamed),
    regions: items(file.regions, readRegion),
    wineries: items(file.wineries, readNamed),
    bottleSizes: items(file.bottleSizes, readBottleSize),
    wines: items(file.wines, readWine),
  };
}

/* =========================
   Événements émis par la PWA (§ 3)

   events/PWA-WIN_<AAAAMMJJHHMMSS>_W<WineID ou NEW>.json
   (vins, stock, dégustations, photos) et suffixe
   <C|G|P|L|B><id ou NEW> pour les données de base.
   { eventType, version, timestamp, payload: { …, source } } ;
   version 1, sauf WINE_SAVED en version 2 ; statut écrit
   par processEvent_WIN, message affiché tel quel.
========================= */

export const WINE_EVENT_TRIGRAM = "WIN";

export const WINE_EVENT_VERSION = 1;

export type WineEventType =
  | "WINE_SAVED"
  | "WINE_STOCK_CHANGED"
  | "WINE_TASTING_SAVED"
  | "WINE_TASTING_DELETED"
  | "WINE_DELETED"
  | "WINE_PHOTO_SAVED"
  | "WINE_PHOTO_DELETED"
  | "WINE_REFERENCE_SAVED"
  | "WINE_REFERENCE_DELETED";

/*
  WINE_SAVED, version 2 : payload { wineId, name, vintage,
  country, region, color, winery, bottleSizeId, locationId,
  locationLevel, priceChf, favorite, drinkBefore, holdUntil,
  purchasedAt, comments, quantity, photo?, source }.
  wineId null : création, quantity = stock initial ;
  modification : tous les champs remplacés, quantity ignoré.
  country, region et winery sont des références : { id }
  pour un élément existant, { id: null, name } pour un nom
  saisi (réutilisé s'il existe au sens de la collation,
  sinon créé avec le vin ; région cherchée dans le pays du
  vin), null sans valeur. Refus : nom vide ou de plus de 100
  caractères, années hors de 1900–2100, couleur hors de
  WINE_COLORS, emplacement ou taille inconnus, prix négatif,
  date d'achat invalide, quantity négative, vin inconnu,
  région sans pays ou d'un autre pays, nom de référence de
  plus de 50 caractères (100 pour un producteur), étage sans
  emplacement ou hors de ses levelCount étages. La version 1
  est refusée par le Mac depuis W6.

  photo (facultatif, W7) : { copyFrom: <WineID> } (héritage,
  copie de la photo de ce vin) ou { image } (nouvelle image,
  mêmes règles que WINE_PHOTO_SAVED) ; absent : pas de photo
  à la création, photo inchangée à la modification. Une
  image refusée refuse toute la saisie ; copyFrom d'un vin
  sans photo n'est pas un refus (fiche enregistrée sans
  photo, statut qui le dit).
*/
export const WINE_NAME_MAX_LENGTH = 100;
export const WINE_COUNTRY_MAX_LENGTH = 50;
export const WINE_REGION_MAX_LENGTH = 50;
export const WINE_WINERY_MAX_LENGTH = 100;
export const WINE_YEAR_MIN = 1900;
export const WINE_YEAR_MAX = 2100;

export const WINE_SAVED_VERSION = 2;

export type WineReference =
  | { id: number }
  | { id: null; name: string };

export interface WineSave {
  wineId: number | null;
  name: string;
  vintage: number | null;
  country: WineReference | null;
  region: WineReference | null;
  color: string | null;
  winery: WineReference | null;
  bottleSizeId: number;
  locationId: number | null;
  locationLevel: number | null;
  priceChf: number | null;
  favorite: boolean;
  drinkBefore: number | null;
  holdUntil: number | null;
  purchasedAt: string | null;
  comments: string | null;
  quantity: number;
  photo?: WinePhotoSave;
}

/*
  WINE_PHOTO_SAVED (W7) : payload { wineId, image, source },
  ajout ou remplacement de la photo d'un vin existant.
  WINE_PHOTO_DELETED : payload { wineId, source }, retrait
  (un vin déjà sans photo n'est pas une erreur). Fichier
  …_W<WineID>.json, version 1.

  Image : JPEG brut en base64 (sans préfixe data:), relu par
  sips sur le Mac, dont les dimensions font foi (width et
  height de l'événement : journal seulement) ; pixels déjà
  dans le bon sens (l'orientation EXIF n'est pas lue).
  Refus : 1 Mo au plus avant encodage, grand côté de
  1600 px au plus, petit côté de 100 px au moins.
  Chaque nouvelle image prend une nouvelle clé
  (w<WineID>_<AAAAMMJJHHMMSS>.jpg), exportée dans photo.
*/
export const WINE_PHOTO_MIME_TYPE = "image/jpeg";
export const WINE_PHOTO_MAX_BYTES = 1024 * 1024;
export const WINE_PHOTO_MAX_SIDE = 1600;
export const WINE_PHOTO_MIN_SIDE = 100;

export interface WineImage {
  mimeType: typeof WINE_PHOTO_MIME_TYPE;
  width: number;
  height: number;
  data: string;
}

export type WinePhotoSave =
  | { copyFrom: number }
  | { image: WineImage };

/*
  WINE_DELETED : payload { wineId, source }. Efface
  définitivement la fiche, ses dégustations et son journal
  du stock ; un vin bu reste normalement dans l'historique
  (quantity 0). Sa photo est supprimée avec elle.
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
  Données de base (section « Wine cellar » de Master data) :
  payload.kind désigne la table.
  - WINE_REFERENCE_SAVED { kind, id, name, … } ; id null :
    création. countryId (région), levelCount 1–99 ou null
    (emplacement), factor > 0 et sortOrder 0–999 (taille).
    Refus : nom vide, trop long ou déjà porté par un élément
    du même type (région : du même pays), étage utilisé qui
    disparaîtrait.
  - WINE_REFERENCE_DELETED { kind, id } : refus tant que
    l'élément est utilisé.
  Pas de fusion : un doublon se corrige depuis la fiche des
  vins, puis l'élément inutilisé est supprimé.
  Fichier : suffixe <C|G|P|L|B><id ou NEW>.
*/
export type WineReferenceKind =
  | "country"
  | "region"
  | "winery"
  | "location"
  | "bottleSize";

const REFERENCE_SUFFIX_LETTERS: Record<WineReferenceKind, string> = {
  country: "C",
  region: "G",
  winery: "P",
  location: "L",
  bottleSize: "B",
};

/* Longueurs des noms (colonnes du § 1). */
export const REFERENCE_NAME_MAX_LENGTH: Record<WineReferenceKind, number> = {
  country: 50,
  region: 50,
  winery: 100,
  location: 50,
  bottleSize: 30,
};

export const LOCATION_LEVEL_COUNT_MAX = 99;
export const BOTTLE_SIZE_FACTOR_MAX = 999.99;
export const BOTTLE_SIZE_SORT_ORDER_MAX = 999;

export interface WineReferenceSave {
  kind: WineReferenceKind;
  id: number | null;
  name: string;
  countryId?: number;
  levelCount?: number | null;
  factor?: number;
  sortOrder?: number;
}

/* Suffixe du nom de fichier d'un événement de données de base (null : création). */
export function referenceEventSuffix(
  kind: WineReferenceKind,
  id: number | null
): string {
  return `${REFERENCE_SUFFIX_LETTERS[kind]}${id ?? "NEW"}`;
}

/* Le suffixe désigne-t-il un élément de données de base ? */
export function isReferenceEventSuffix(
  suffix: string
): boolean {
  return Object.values(REFERENCE_SUFFIX_LETTERS).includes(suffix.charAt(0));
}

/* Suffixe du nom de fichier d'un événement de vin (null : création). */
export function wineEventSuffix(
  wineId: number | null
): string {
  return `W${wineId ?? "NEW"}`;
}

