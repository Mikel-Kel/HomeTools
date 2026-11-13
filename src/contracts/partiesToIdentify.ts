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
                     "amount": -729.00 } ] }

   Libellés bancaires des mouvements des derniers mois dont
   la contrepartie n'est pas identifiée (accmovement.PartyID
   NULL), un par libellé et par banque, dans l'ordre du
   fichier (count décroissant, puis lastDate décroissante).
   counterparty : texte avant « | », alias proposé.
   movements : somme des count.
========================= */

export const PARTIES_TO_IDENTIFY_FOLDER = "settings";

export const PARTIES_TO_IDENTIFY_FILE = "movementPartyIDToIdentify.json";

export interface LabelToIdentify {
  label: string;
  counterparty: string;
  bank: string;
  count: number;
  firstDate: string;
  lastDate: string;
  amount: number;
}

export interface PartiesToIdentifyData {
  months: number;
  since: string;
  movements: number;
  labels: LabelToIdentify[];
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
          };
        }
      )
      .filter(entry => entry.label !== ""),
  };
}
