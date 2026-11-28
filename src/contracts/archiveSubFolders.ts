import {
  asArray,
  asNumber,
  asObject,
  asString,
  ContractError,
  type JsonObject,
} from "@/contracts/read";

/* =========================
   Sous-dossiers d'archives Various et Tourism

   Contrat : ../Backend/docs/parties-contract.md. Parties de
   type -1 (Various) et -2 (Tourism), publiées par
   exportParties -1 / -2 après chaque changement, ordre
   compris (PartySeq).

   settings/variousFolders.json :
     { "version": 1, "updatedAt": "…",
       "folders": [ { "id": 101, "label": "Example", "seqNb": 10 } ] }

   settings/tourismFolders.json : même forme, sans seqNb
   (fichier déjà trié par le Mac).
========================= */

export const ARCHIVE_SUB_FOLDERS_FOLDER = "settings";

export const VARIOUS_FOLDERS_FILE = "variousFolders.json";

export const TOURISM_FOLDERS_FILE = "tourismFolders.json";

export interface SubFolder {
  id: number;
  label: string;

  /* Absent de tourismFolders.json. */
  seqNb: number | null;
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

/*
  Sous-dossiers triés par seqNb ; sans seqNb, l'ordre du
  fichier est gardé (tri stable).
*/
function readSubFolders(
  raw: unknown,
  fileName: string
): SubFolder[] {
  const file =
    asObject(raw);

  if (
    !file ||
    !Array.isArray(file.folders)
  ) {
    throw new ContractError(
      fileName,
      "invalid format"
    );
  }

  return objects(file.folders)
    .map(
      folder => ({
        id: asNumber(folder.id),
        label: asString(folder.label),
        seqNb:
          folder.seqNb === undefined ||
          folder.seqNb === null
            ? null
            : asNumber(folder.seqNb),
      })
    )
    .sort(
      (a, b) =>
        (a.seqNb ?? 0) - (b.seqNb ?? 0)
    );
}

export function readVariousFolders(
  raw: unknown
): SubFolder[] {
  return readSubFolders(
    raw,
    VARIOUS_FOLDERS_FILE
  );
}

export function readTourismFolders(
  raw: unknown
): SubFolder[] {
  return readSubFolders(
    raw,
    TOURISM_FOLDERS_FILE
  );
}
