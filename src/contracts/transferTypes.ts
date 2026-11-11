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
   Types d'opération bancaire (transfer types)

   Contrat complet : ../Backend/docs/transfertypes-contract.md.

   settings/transferTypes.json (exportTransferTypes) :
     { "version": 1, "updatedAt": "…",
       "operations": ["Bonification", "Paiement TWINT"],
       "transferTypes": [ { "id": 309,
                            "label": "UBS-K70 Paiement TWINT",
                            "operation": "Paiement TWINT" | null,
                            "usesCard": false, "displaySeq": 1,
                            "reversal": false,
                            "allocRule": { "withDescription": false,
                                           "withParty": true,
                                           "withCard": false },
                            "keyword": "TWINT" | null,
                            "descriptionPattern": "Twint à *" | null,
                            "reserved": false,
                            "usage": { "movements": 0, "rules": 0 } } ] }

   Types triés par id ; operations : opérations existantes,
   distinctes et triées, proposées à la saisie. Le libellé
   contient le code bancaire par lequel l'import retrouve le
   type (« UBS-K70 », « PMNT-ICDT-PNET ») : le renommer sans
   garder ce code fait échouer l'import suivant.
   Réservés (0, 998, 999) : modifiables, jamais supprimables.
========================= */

export const TRANSFER_TYPES_FOLDER = "settings";

export const TRANSFER_TYPES_FILE = "transferTypes.json";

/* Identifiant saisi à la création. */
export const TRANSFER_TYPE_ID_MIN = 1;
export const TRANSFER_TYPE_ID_MAX = 99999;

export interface TransferTypeAllocRule {
  withDescription: boolean;
  withParty: boolean;
  withCard: boolean;
}

export interface TransferTypeUsage {
  movements: number;
  rules: number;
}

export interface TransferType {
  id: number;
  label: string;
  operation: string | null;
  usesCard: boolean;
  displaySeq: number;
  reversal: boolean;
  allocRule: TransferTypeAllocRule;
  keyword: string | null;
  descriptionPattern: string | null;
  reserved: boolean;
  usage: TransferTypeUsage;
}

export interface TransferTypesData {
  operations: string[];
  transferTypes: TransferType[];
}

export function isTransferTypeUsed(
  type: TransferType
): boolean {
  return (
    type.usage.movements +
    type.usage.rules
  ) > 0;
}

/* Suppression proposée : type inutilisé et non réservé. */
export function isTransferTypeDeletable(
  type: TransferType
): boolean {
  return (
    !type.reserved &&
    !isTransferTypeUsed(type)
  );
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
  return asString(value) || null;
}

export function readTransferTypes(
  raw: unknown
): TransferTypesData {
  const file =
    asObject(raw);

  if (
    !file ||
    asNumber(file.version) !== 1 ||
    !Array.isArray(file.transferTypes)
  ) {
    throw new ContractError(
      TRANSFER_TYPES_FILE,
      "invalid format"
    );
  }

  return {
    operations: asArray(file.operations)
      .filter(
        (operation): operation is string =>
          typeof operation === "string" &&
          operation !== ""
      ),

    transferTypes: objects(file.transferTypes)
      .map(
        type => {
          const allocRule =
            asObject(type.allocRule);

          const usage =
            asObject(type.usage);

          return {
            id: asNumber(type.id),
            label: asString(type.label),
            operation: asNullableText(type.operation),
            usesCard: asBoolean(type.usesCard),
            displaySeq: asNumber(type.displaySeq),
            reversal: asBoolean(type.reversal),

            allocRule: {
              withDescription: asBoolean(allocRule?.withDescription),
              withParty: asBoolean(allocRule?.withParty),
              withCard: asBoolean(allocRule?.withCard),
            },

            keyword: asNullableText(type.keyword),
            descriptionPattern: asNullableText(type.descriptionPattern),
            reserved: asBoolean(type.reserved),

            usage: {
              movements: asNumber(usage?.movements),
              rules: asNumber(usage?.rules),
            },
          };
        }
      )
      .sort((a, b) => a.id - b.id),
  };
}
