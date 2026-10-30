import {
  asArray,
  asNumber,
  asObject,
  asString,
  ContractError,
  type JsonObject,
} from "@/contracts/read";

/* =========================
   Parties, types de partie et alias

   Contrat complet : ../Backend/docs/parties-contract.md.

   settings/parties.json (exportParties 0) :
     { "version": 1, "updatedAt": "…",
       "partyTypes": [ { "id": 5, "label": "Boutique" } ],
       "parties": [ { "id": 852, "label": "Nike",
                      "typeId": 5, "seq": 100,
                      "aliases": ["NIKE FACT"],
                      "usage": { "allocations": 12, "rules": 1,
                                 "archives": 0, "banks": 0 } } ] }

   Toutes les parties, dossiers d'archives compris (types -1
   et -2). Les alias sont gardés tels quels : leurs espaces de
   début et de fin sont significatifs.
========================= */

export const PARTIES_FOLDER = "settings";

export const PARTIES_FILE = "parties.json";

/* Dossiers d'archives « Various » et « Tourism ». */
export const VARIOUS_FOLDER_TYPE_ID = -1;
export const TOURISM_FOLDER_TYPE_ID = -2;

export function isFolderType(
  typeId: number
): boolean {
  return (
    typeId === VARIOUS_FOLDER_TYPE_ID ||
    typeId === TOURISM_FOLDER_TYPE_ID
  );
}

/* Ni modifiables ni supprimables. */
export const RESERVED_PARTY_IDS = [-1, 0];
export const RESERVED_PARTY_TYPE_IDS = [-2, -1, 0];

/*
  Parties réservées (-1 N/A, 0 To assign) : jamais affichées
  ni proposées dans la PWA.
*/
export function isVisibleParty(
  party: Party
): boolean {
  return !RESERVED_PARTY_IDS.includes(party.id);
}

/* Vraie partie : ni réservée, ni dossier d'archives. */
export function isStandardParty(
  party: Party
): boolean {
  return (
    isVisibleParty(party) &&
    !isFolderType(party.typeId)
  );
}

export interface PartyUsage {
  allocations: number;
  rules: number;
  archives: number;
  banks: number;
}

export interface Party {
  id: number;
  label: string;
  typeId: number;
  seq: number;
  aliases: string[];
  usage: PartyUsage;
}

export interface PartyType {
  id: number;
  label: string;
}

export interface PartiesData {
  partyTypes: PartyType[];
  parties: Party[];
}

export function isPartyUsed(
  party: Party
): boolean {
  const usage =
    party.usage;

  return (
    usage.allocations +
    usage.rules +
    usage.archives +
    usage.banks
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
  Types triés par id, parties par nom (ordre de l'export).
*/
export function readParties(
  raw: unknown
): PartiesData {
  const file =
    asObject(raw);

  if (
    !file ||
    asNumber(file.version) !== 1 ||
    !Array.isArray(file.parties)
  ) {
    throw new ContractError(
      PARTIES_FILE,
      "invalid format"
    );
  }

  return {
    partyTypes: objects(file.partyTypes)
      .map(
        type => ({
          id: asNumber(type.id),
          label: asString(type.label),
        })
      )
      .sort((a, b) => a.id - b.id),

    parties: objects(file.parties)
      .map(
        party => {
          const usage =
            asObject(party.usage);

          return {
            id: asNumber(party.id),
            label: asString(party.label),
            typeId: asNumber(party.typeId),
            seq: asNumber(party.seq),

            aliases: asArray(party.aliases)
              .filter(
                (alias): alias is string =>
                  typeof alias === "string" &&
                  alias !== ""
              ),

            usage: {
              allocations: asNumber(usage?.allocations),
              rules: asNumber(usage?.rules),
              archives: asNumber(usage?.archives),
              banks: asNumber(usage?.banks),
            },
          };
        }
      ),
  };
}
