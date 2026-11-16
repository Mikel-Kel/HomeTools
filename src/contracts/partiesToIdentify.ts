import {
  asArray,
  asNumber,
  asObject,
  asString,
  ContractError,
  type JsonObject,
} from "@/contracts/read";

/* =========================
   Contreparties à identifier

   Contrat complet : ../Backend/docs/parties-contract.md, § 5.

   settings/movementPartyIDToIdentify.json
   (exportMovementPartyIDToIdentify, republié avec
   parties.json après chaque PARTY_SAVED et chaque nuit) :
     { "version": 1, "updatedAt": "…",
       "months": 12, "since": "2025-11-13",
       "movements": 1120,
       "labels": [ { "label": "CARAVAN CLUB LTD",
                     "counterparty": "CARAVAN CLUB LTD",
                     "bank": "CB", "count": 15,
                     "firstDate": "2026-07-12",
                     "lastDate": "2026-09-25",
                     "amount": -729.00,
                     "suggestedParty": { "partyId": 474,
                       "allocations": 12, "share": 0.92,
                       "generic": false } } ] }

   Libellés bancaires des mouvements des derniers mois dont
   la contrepartie n'est pas identifiée (accmovement.PartyID
   NULL), un par libellé et par banque, dans l'ordre du
   fichier (count décroissant, puis lastDate décroissante).
   counterparty : texte avant « | », alias proposé.
   movements : somme des count.

   suggestedParty (lot 4 des règles d'allocation,
   ../Backend/docs/allocation-rules-contract.md, § 24) :
   partie d'allocation dominante des mouvements de même
   libellé (au moins 3 allocations et 80 %), absente sans
   suggestion ; share de 0 à 1 ; generic : partie générique
   (l'alias doit rester propre au tiers). Une indication,
   jamais une identification : la confirmation reste un
   PARTY_SAVED.
========================= */

export const PARTIES_TO_IDENTIFY_FOLDER = "settings";

export const PARTIES_TO_IDENTIFY_FILE = "movementPartyIDToIdentify.json";

export interface SuggestedParty {
  partyId: number;
  allocations: number;
  share: number;
  generic: boolean;
}

export interface LabelToIdentify {
  label: string;
  counterparty: string;
  bank: string;
  count: number;
  firstDate: string;
  lastDate: string;
  amount: number;
  suggestedParty: SuggestedParty | null;
}

export interface PartiesToIdentifyData {
  months: number;
  since: string;
  movements: number;
  labels: LabelToIdentify[];
}

function readSuggestedParty(
  value: unknown
): SuggestedParty | null {
  const suggestion =
    asObject(value);

  const partyId =
    asNumber(suggestion?.partyId);

  const share =
    asNumber(suggestion?.share);

  if (!suggestion || partyId <= 0 || share <= 0) {
    return null;
  }

  return {
    partyId,
    allocations: asNumber(suggestion.allocations),
    share,
    generic: suggestion.generic === true,
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

export function readPartiesToIdentify(
  raw: unknown
): PartiesToIdentifyData {
  const file =
    asObject(raw);

  if (
    !file ||
    asNumber(file.version) !== 1 ||
    !Array.isArray(file.labels)
  ) {
    throw new ContractError(
      PARTIES_TO_IDENTIFY_FILE,
      "invalid format"
    );
  }

  return {
    months: asNumber(file.months),
    since: asString(file.since),
    movements: asNumber(file.movements),

    labels: objects(file.labels)
      .map(
        entry => {
          const label =
            asString(entry.label);

          return {
            label,
            counterparty: asString(entry.counterparty) || label,
            bank: asString(entry.bank),
            count: asNumber(entry.count),
            firstDate: asString(entry.firstDate),
            lastDate: asString(entry.lastDate),
            amount: asNumber(entry.amount),
            suggestedParty: readSuggestedParty(entry.suggestedParty),
          };
        }
      )
      .filter(entry => entry.label !== ""),
  };
}
