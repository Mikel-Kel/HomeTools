import {
  asArray,
  asBoolean,
  asNumber,
  asObject,
  asString,
  ContractError,
  type JsonObject,
} from "@/contracts/read";

/* =========================
   Tags des documents (tags « Doc »)

   Contrat complet : ../Backend/docs/tags-contract.md (§ 6).

   settings/documentTags.json (exportDocumentTags) :
     { "version": 2, "updatedAt": "…",
       "tags": [ { "id": 0, "tagName": "To be reimbursed",
                   "seqNb": 10, "color": "#0000ff",
                   "reserved": false,
                   "usage": { "documents": 66 } } ] }

   Identifiants écrits dans les noms des PDF archivés
   (-TAG<id>[_<id>…]) : 0 est un vrai tag. La version 1
   (sans reserved ni usage) reste lue pendant la transition.
========================= */

export const DOCUMENT_TAGS_FOLDER = "settings";

export const DOCUMENT_TAGS_FILE = "documentTags.json";

/* Type des tags des documents dans la table Tags. */
export const DOC_TAG_TYPE = "Doc" as const;

export interface DocumentTagUsage {
  documents: number;
}

export interface DocumentTag {
  id: number;
  tagName: string;
  seqNb: number;

  /* #rrggbb */
  color: string;

  /* Renommable, jamais supprimable. */
  reserved: boolean;

  /* null : inconnu (version 1). */
  usage: DocumentTagUsage | null;
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
  Tags triés par numéro d'ordre puis identifiant.
*/
export function readDocumentTags(
  raw: unknown
): DocumentTag[] {
  const file =
    asObject(raw);

  const version =
    asNumber(file?.version);

  if (
    !file ||
    (version !== 1 && version !== 2) ||
    !Array.isArray(file.tags)
  ) {
    throw new ContractError(
      DOCUMENT_TAGS_FILE,
      "invalid format"
    );
  }

  return objects(file.tags)
    .map(
      tag => {
        const usage =
          asObject(tag.usage);

        return {
          id: asNumber(tag.id),
          tagName: asString(tag.tagName),
          seqNb: asNumber(tag.seqNb),
          color: asString(tag.color).toLowerCase(),
          reserved: asBoolean(tag.reserved),
          usage:
            usage
              ? { documents: asNumber(usage.documents) }
              : null,
        };
      }
    )
    .sort(
      (a, b) =>
        a.seqNb - b.seqNb ||
        a.id - b.id
    );
}
