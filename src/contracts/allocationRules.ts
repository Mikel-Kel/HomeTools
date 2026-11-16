import {
  asArray,
  asNumber,
  asObject,
  asString,
  ContractError,
} from "@/contracts/read";

/* =========================
   Règles d'allocation

   Contrat complet : ../Backend/docs/allocation-rules-contract.md
   (§ 2 modèle, § 3 jetons des modèles de commentaire, § 17
   export, § 18 événements).

   settings/allocationRules.json (exportAllocationRules, de
   nuit, sur demande et après chaque événement RUL) :
     { "version": 1, "updatedAt": "…",
       "holders": ["…"],
       "rules": [
         { "id": 12, "kind": "party", "partyId": 913,
           "matchText": null, "transferTypeId": null,
           "holder": null, "allocPartyId": null,
           "subCategoryId": 49, "tagId": 0,
           "commentTemplate": "… {M}", "refMonthOffset": 0,
           "autoConfirm": false, "origin": "migrated",
           "createdAt": "…", "updatedAt": "…",
           "usage": { "movements": 11, "first": 9,
                      "contradicted": 0 } } ] }

   kind « party » : règle sur la partie du mouvement
   (partyId) ; « text » : texte cherché dans le libellé de
   la banque (matchText, espaces significatifs).
   transferTypeId et holder null : tous les types, tous les
   porteurs. allocPartyId null : partie du mouvement.
   subCategoryId null : la règle ne propose que la partie.
   tagId 0 : sans tag. usage : 12 derniers mois (mouvements
   concernés, fois en tête, fois contredite par l'historique).
   Ordre du fichier : règles par texte, puis par nom de
   partie, la générale avant ses exceptions.

   Une règle sans identifiant ou de genre inconnu est
   ignorée. Fichier absent (pas encore publié) : null.
========================= */

export const ALLOCATION_RULES_FOLDER = "settings";
export const ALLOCATION_RULES_FILE = "allocationRules.json";

export type AllocationRuleKind =
  | "party"
  | "text";

export type AllocationRuleOrigin =
  | "migrated"
  | "pwa";

export interface AllocationRuleUsage {
  movements: number;
  first: number;
  contradicted: number;
}

export interface AllocationRule {
  id: number;
  kind: AllocationRuleKind;
  partyId: number | null;
  matchText: string | null;
  transferTypeId: number | null;
  holder: string | null;
  allocPartyId: number | null;
  subCategoryId: number | null;
  tagId: number;
  commentTemplate: string | null;
  refMonthOffset: number;
  autoConfirm: boolean;
  origin: AllocationRuleOrigin;
  createdAt: string | null;
  updatedAt: string | null;
  usage: AllocationRuleUsage;
}

export interface AllocationRulesData {
  updatedAt: string | null;
  holders: string[];
  rules: AllocationRule[];
}

/* Entier facultatif : absent, invalide ou 0 = null. */
function asOptionalId(
  value: unknown
): number | null {
  return typeof value === "number" && Number.isInteger(value) && value !== 0
    ? value
    : null;
}

function asNullableText(
  value: unknown
): string | null {
  return typeof value === "string" && value !== ""
    ? value
    : null;
}

function readRule(
  value: unknown
): AllocationRule | null {
  const rule =
    asObject(value);

  const id =
    asOptionalId(rule?.id);

  if (
    !rule ||
    id === null ||
    (rule.kind !== "party" && rule.kind !== "text")
  ) {
    return null;
  }

  const usage =
    asObject(rule.usage);

  return {
    id,
    kind: rule.kind,
    partyId: asOptionalId(rule.partyId),
    matchText: asNullableText(rule.matchText),
    transferTypeId: asOptionalId(rule.transferTypeId),
    holder: asNullableText(rule.holder),
    allocPartyId: asOptionalId(rule.allocPartyId),
    subCategoryId: asOptionalId(rule.subCategoryId),
    tagId: asOptionalId(rule.tagId) ?? 0,
    commentTemplate: asNullableText(rule.commentTemplate),
    refMonthOffset: asNumber(rule.refMonthOffset),
    autoConfirm: rule.autoConfirm === true,
    origin: rule.origin === "pwa" ? "pwa" : "migrated",
    createdAt: asNullableText(rule.createdAt),
    updatedAt: asNullableText(rule.updatedAt),
    usage: {
      movements: asNumber(usage?.movements),
      first: asNumber(usage?.first),
      contradicted: asNumber(usage?.contradicted),
    },
  };
}

export function readAllocationRules(
  raw: unknown
): AllocationRulesData {
  const file =
    asObject(raw);

  if (
    !file ||
    asNumber(file.version) !== 1 ||
    !Array.isArray(file.rules)
  ) {
    throw new ContractError(
      ALLOCATION_RULES_FILE,
      "invalid format"
    );
  }

  return {
    updatedAt: asNullableText(file.updatedAt),
    holders: asArray(file.holders)
      .map(holder => asString(holder))
      .filter(Boolean),
    rules: asArray(file.rules)
      .map(readRule)
      .filter(
        (rule): rule is AllocationRule =>
          rule !== null
      ),
  };
}
