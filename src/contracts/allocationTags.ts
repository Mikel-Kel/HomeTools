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
   Tags des mouvements (tags « Acc »)

   Contrat complet : ../Backend/docs/tags-contract.md.

   settings/allocationTags.json (exportAllocationTags) :
     { "version": 3, "updatedAt": "…",
       "tags": [ { "id": 1, "tagName": "Hors budget",
                   "seqNb": 0, "reserved": true,
                   "offBudget": true,
                   "usage": { "allocations": 675,
                              "rules": 0 } } ] }

   Identifiants à partir de 1 ; 0 signifie « sans tag ». Le
   seul tag hors budget est le tag réservé « Hors budget ».
========================= */

export const ALLOCATION_TAGS_FOLDER = "settings";

export const ALLOCATION_TAGS_FILE = "allocationTags.json";

/* Type des tags des mouvements dans la table Tags. */
export const ACC_TAG_TYPE = "Acc";

export interface AllocationTagUsage {
  allocations: number;
  rules: number;
}

export interface AllocationTag {
  id: number;
  tagName: string;
  seqNb: number;

  /* Renommable, jamais supprimable. */
  reserved: boolean;

  offBudget: boolean;
  usage: AllocationTagUsage;
}

export function isTagUsed(
  tag: AllocationTag
): boolean {
  return (
    tag.usage.allocations +
    tag.usage.rules
  ) > 0;
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
export function readAllocationTags(
  raw: unknown
): AllocationTag[] {
  const file =
    asObject(raw);

  if (
    !file ||
    asNumber(file.version) !== 3 ||
    !Array.isArray(file.tags)
  ) {
    throw new ContractError(
      ALLOCATION_TAGS_FILE,
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
          reserved: asBoolean(tag.reserved),
          offBudget: asBoolean(tag.offBudget),
          usage: {
            allocations: asNumber(usage?.allocations),
            rules: asNumber(usage?.rules),
          },
        };
      }
    )
    .sort(
      (a, b) =>
        a.seqNb - b.seqNb ||
        a.id - b.id
    );
}
