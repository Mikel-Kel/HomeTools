import {
  asArray,
  asNullableNumber,
  asNumber,
  asObject,
  asString,
  type JsonObject,
} from "@/contracts/read";

/* =========================
   Fichiers

   Exportés dans archive/ par exportArchiveToc (index de
   archivetoc et DocumentTag), et republiés partiellement
   par processEvent_TOC après chaque classement.
========================= */

export const ARCHIVE_FOLDER = "archive";
export const ARCHIVE_INDEX_FILE = "index.json";
export const ARCHIVE_TO_FILE_FILE = "toFile.json";

/*
  Dossier des documents à classer (archive/toFile.json).
*/
export const TO_FILE_FOLDER = "A Classer";
export const TO_FILE_BUCKET = "toFile";

export function archiveYearFile(
  year: number | string
): string {
  return `${year}.json`;
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

/* =========================
   archive/index.json

     { "updatedAt": "…", "totalCount": 9963,
       "toFile": { "count": 9 },
       "years": [2026, 2025, …],
       "foldersUpdated": ["2026", "toFile"] }

   foldersUpdated : fichiers republiés par le dernier
   classement ; absent ou vide = tout relire.
========================= */

export interface ArchiveIndex {
  updatedAt: string | null;
  years: number[];
  foldersUpdated: string[];
}

export function readArchiveIndex(
  raw: unknown
): ArchiveIndex {
  const index =
    asObject(raw);

  return {
    updatedAt:
      asString(index?.updatedAt) || null,

    years:
      asArray(index?.years)
        .map(year => asNumber(year, Number.NaN))
        .filter(year => Number.isInteger(year)),

    foldersUpdated:
      asArray(index?.foldersUpdated)
        .map(folder => asString(folder))
        .filter(Boolean),
  };
}

/* =========================
   Documents

   archive/toFile.json : { "items": [ <document> ] }
   archive/<année>.json : { "groups": { "<label du dossier>":
                                         { "items": [ <document> ] } } }

   <document> :
     { "tocid": 13612, "documentDate": "2026-10-19",
       "dtaDate": "2026-11-13" | null, "info1": "…", "info2": "…",
       "indicatorDTA": 1, "physicalName": "2026/Factures/P01364/…",
       "partyID": 1364, "refAmount": 9473.88 | null,
       "tagIDs": [0, 1],
       "qrBill": { … } }

   qrBill : QR-facture lue par le Mac au dépôt, documents de
   toFile.json seulement, absent sans QR-facture (contrat
   ../Backend/docs/archive-qrbill-contract.md, § 2 et § 4) :
     { "amount": 123.45 | null, "currency": "CHF" | "EUR",
       "creditorName": "…", "creditorIban": "…",
       "referenceType": "QRR" | "SCOR" | "NON",
       "reference": "…" | null, "message": "…" | null,
       "billDate": "AAAA-MM-JJ" | null, "page": 2 }

   Les groupes d’une année portent le libellé du dossier
   (« Bills », « Tourism »…) : ils sont ramenés au nom du
   dossier (« Factures », « Tourisme »…) par la configuration
   archiveFolders d’AppParameters.json.
========================= */

export interface ArchiveQrBill {
  /* null : facture sans montant imposé. */
  amount: number | null;
  currency: string;
  creditorName: string;
  creditorIban: string;
  referenceType: string;
  reference: string | null;
  message: string | null;
  billDate: string | null;
  page: number | null;
}

function readQrBill(
  value: unknown
): ArchiveQrBill | null {
  const qrBill =
    asObject(value);

  if (!qrBill) {
    return null;
  }

  return {
    amount: asNullableNumber(qrBill.amount),
    currency: asString(qrBill.currency, "CHF") || "CHF",
    creditorName: asString(qrBill.creditorName).trim(),
    creditorIban: asString(qrBill.creditorIban),
    referenceType: asString(qrBill.referenceType),
    reference: asString(qrBill.reference) || null,
    message: asString(qrBill.message) || null,
    billDate: /^\d{4}-\d{2}-\d{2}$/.test(asString(qrBill.billDate))
      ? asString(qrBill.billDate)
      : null,
    page: asNullableNumber(qrBill.page),
  };
}

export interface ArchiveItem {
  tocid: number;
  folder: string;
  documentDate: string;
  dtaDate: string | null;
  info1: string;
  info2: string;
  indicatorDTA: number;
  physicalName: string;
  partyID: number;
  refAmount: number | null;
  tagIDs: number[];

  /* QR-facture lue au dépôt (« A Classer » seulement). */
  qrBill: ArchiveQrBill | null;

  /*
    Fichier d’origine (« toFile » ou l’année), pour le
    rechargement partiel après un classement.
  */
  sourceBucket: string;
}

function readArchiveItem(
  item: JsonObject,
  folder: string,
  sourceBucket: string
): ArchiveItem {
  return {
    tocid:
      asNumber(item.tocid),

    folder,

    documentDate:
      asString(item.documentDate),

    dtaDate:
      asString(item.dtaDate) || null,

    info1:
      asString(item.info1),

    info2:
      asString(item.info2),

    indicatorDTA:
      asNumber(item.indicatorDTA),

    physicalName:
      asString(item.physicalName),

    partyID:
      asNumber(item.partyID),

    refAmount:
      asNullableNumber(item.refAmount),

    tagIDs:
      asArray(item.tagIDs)
        .map(tag => asNumber(tag, Number.NaN))
        .filter(tag => Number.isInteger(tag)),

    qrBill:
      readQrBill(item.qrBill),

    sourceBucket,
  };
}

export function readArchiveToFile(
  raw: unknown
): ArchiveItem[] {
  return objects(
    asObject(raw)?.items
  ).map(
    item =>
      readArchiveItem(
        item,
        TO_FILE_FOLDER,
        TO_FILE_BUCKET
      )
  );
}

export function readArchiveYear(
  raw: unknown,
  year: string,
  folderOfLabel: (label: string) => string
): ArchiveItem[] {
  const groups =
    asObject(
      asObject(raw)?.groups
    ) ?? {};

  return Object.entries(groups).flatMap(
    ([label, group]) =>
      objects(
        asObject(group)?.items
      ).map(
        item =>
          readArchiveItem(
            item,
            folderOfLabel(label),
            year
          )
      )
  );
}
