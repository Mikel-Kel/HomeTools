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
                      "contradicted": 0,
                      "lastMovement": "2026-10-28" },
           "review": { "reason": "contradicted",
                       "movements": 12,
                       "learn": { "allocPartyId": null,
                                  "subCategoryId": 41,
                                  "tagId": 0,
                                  "commentTemplate": "… {M-1}",
                                  "refMonthOffset": 0 } }
         } ] }

   kind « party » : règle sur la partie du mouvement
   (partyId) ; « text » : texte cherché dans le libellé de
   la banque (matchText, espaces significatifs).
   transferTypeId et holder null : tous les types, tous les
   porteurs. allocPartyId null : partie du mouvement.
   subCategoryId null : la règle ne propose que la partie.
   tagId 0 : sans tag. usage : 12 derniers mois (mouvements
   concernés, fois en tête, fois contredite par l'historique ;
   lastMovement : dernier mouvement concerné sur 72 mois,
   null sinon).
   review (lot 4, § 25), absent sans rien à revoir :
   « contradicted » (12 mois : au moins 3 mouvements et la
   moitié contredits par l'historique, règles pwa
   comprises ; learn = l'allocation que l'historique propose
   à sa place, allocPartyId null = partie du mouvement) ou
   « unused » (aucun mouvement depuis 24 mois ; learn null).
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
  lastMovement: string | null;
}

export type AllocationRuleReviewReason =
  | "contradicted"
  | "unused";

/* Allocation proposée par l'historique à la place d'une règle contredite. */
export interface AllocationRuleLearn {
  allocPartyId: number | null;
  subCategoryId: number | null;
  tagId: number;
  commentTemplate: string | null;
  refMonthOffset: number;
}

export interface AllocationRuleReview {
  reason: AllocationRuleReviewReason;
  movements: number;
  learn: AllocationRuleLearn | null;
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
  review: AllocationRuleReview | null;
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

function readReview(
  value: unknown
): AllocationRuleReview | null {
  const review =
    asObject(value);

  if (
    !review ||
    (review.reason !== "contradicted" && review.reason !== "unused")
  ) {
    return null;
  }

  const learn =
    asObject(review.learn);

  return {
    reason: review.reason,
    movements: asNumber(review.movements),
    learn: learn && {
      allocPartyId: asOptionalId(learn.allocPartyId),
      subCategoryId: asOptionalId(learn.subCategoryId),
      tagId: asOptionalId(learn.tagId) ?? 0,
      commentTemplate: asNullableText(learn.commentTemplate),
      refMonthOffset: asNumber(learn.refMonthOffset),
    },
  };
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
      lastMovement: asNullableText(usage?.lastMovement),
    },
    review: readReview(rule.review),
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

/* =========================
   Événements émis par la PWA (§ 18)

   events/PWA-RUL_<AAAAMMJJHHMMSS>[_R<id>].json, version 1 :
   - RULE_SAVED { rule, fromAllocation, source } ; rule.id
     null : création (une création aux conditions d'une
     règle existante la remplace) ; toute règle enregistrée
     depuis la PWA prend origin « pwa » ;
   - RULE_DELETED { id, source } (règle absente : pas une
     erreur) ;
   - RULES_DELETED { ids, source } (lot 4, § 26.4) :
     suppression groupée, fichier …_BATCH.json, au plus
     RULES_DELETED_MAX règles, règles absentes ignorées.
   Contrôles du § 2.2 ; le Mac reste juge, son message est
   affiché tel quel. Après traitement, allocationRules.json
   et spending.json sont republiés.
========================= */

export const RULE_EVENT_TRIGRAM = "RUL";

export const RULE_EVENT_VERSION = 1;

export const RULES_DELETED_MAX = 500;

export const RULES_DELETED_SUFFIX = "BATCH";

export const MATCH_TEXT_MIN_LENGTH = 3;
export const MATCH_TEXT_MAX_LENGTH = 50;
export const COMMENT_MAX_LENGTH = 50;
export const REF_MONTH_OFFSET_MAX = 12;

export interface AllocationRuleSave {
  id: number | null;
  kind: AllocationRuleKind;
  partyId: number | null;
  matchText: string | null;
  transferTypeId: number | null;
  holder: string | null;
  allocPartyId: number | null;
  subCategoryId: number | null;
  tagId: number;
  commentTemplate: string | null;
  refMonthOffset: number | null;
  autoConfirm: boolean;
}

/* Remember : allocation saisie, convertie en modèle par le Mac. */
export interface RuleFromAllocation {
  fitid: string;
  comment: string;
  allocDate: string;
}

/* Suffixe du fichier : la règle modifiée ou supprimée ; aucun pour une création. */
export function ruleEventSuffix(
  id: number | null
): string | undefined {
  return id === null
    ? undefined
    : `R${id}`;
}

/* =========================
   Modèle de commentaire (§ 3)

   Jetons entre accolades, rendus à partir de la date de
   valeur du mouvement :
   - {M}, {M±n}  mois (n 1–24)        2026-11
   - {Y}, {Y±n}  année (n 1–9)        2026
   - {YY}, {YY±n} année sur 2 chiffres 26
   - {Q}, {Q±n}  trimestre (n 1–8)    2026 Q4
   - {R}, {R±n}  3 mois depuis le mois décalé (n 1–12),
                 format legacy        Sep - Nov 26,
                                      Nov 26 - Jan 27
   Une accolade hors d'un jeton valide rend le modèle
   invalide ; le résultat est rogné. Le rendu le plus long
   tient en COMMENT_MAX_LENGTH caractères. Même règles que le
   Mac, qui reste juge.
========================= */

type TokenKind = "M" | "Y" | "YY" | "Q" | "R";

const TOKEN_MAX_OFFSET: Record<TokenKind, number> = {
  M: 24,
  Y: 9,
  YY: 9,
  Q: 8,
  R: 12,
};

/* Longueur maximale du rendu de chaque jeton. */
const TOKEN_MAX_LENGTH: Record<TokenKind, number> = {
  M: 7,
  Y: 4,
  YY: 2,
  Q: 7,
  R: 15,
};

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const TOKEN_PATTERN =
  /\{(YY|M|Y|Q|R)(?:([+-])(\d{1,2}))?\}/g;

interface TemplateToken {
  kind: TokenKind;
  offset: number;
}

export type TemplateCheck =
  | { ok: true; maxLength: number }
  | { ok: false; error: string };

/* Jetons du modèle, ou l'erreur qui le rend invalide. */
function parseTemplate(
  template: string
): { tokens: TemplateToken[]; literal: string } | { error: string } {
  const tokens: TemplateToken[] = [];

  for (const match of template.matchAll(TOKEN_PATTERN)) {
    const kind =
      match[1] as TokenKind;

    const offset =
      match[3] === undefined
        ? 0
        : Number(match[3]) * (match[2] === "-" ? -1 : 1);

    if (
      match[3] !== undefined &&
      (Math.abs(offset) < 1 || Math.abs(offset) > TOKEN_MAX_OFFSET[kind])
    ) {
      return {
        error: `offset of ${match[0]} out of range`,
      };
    }

    tokens.push({ kind, offset });
  }

  const literal =
    template.replace(TOKEN_PATTERN, "");

  if (/[{}]/.test(literal)) {
    return { error: "brace outside a token" };
  }

  return { tokens, literal };
}

/* Modèle rogné, comme le Mac à l'enregistrement. */
export function checkCommentTemplate(
  template: string
): TemplateCheck {
  const parsed =
    parseTemplate(template.trim());

  if ("error" in parsed) {
    return { ok: false, error: parsed.error };
  }

  const maxLength =
    parsed.literal.length +
    parsed.tokens.reduce((total, token) => total + TOKEN_MAX_LENGTH[token.kind], 0);

  return maxLength > COMMENT_MAX_LENGTH
    ? {
        ok: false,
        error: `rendered comment up to ${maxLength} characters, ${COMMENT_MAX_LENGTH} at most`,
      }
    : { ok: true, maxLength };
}

/* Année et mois (1–12) décalés de months mois. */
function shiftMonth(
  year: number,
  month: number,
  months: number
): { year: number; month: number } {
  const index =
    year * 12 + (month - 1) + months;

  return {
    year: Math.floor(index / 12),
    month: (index % 12) + 1,
  };
}

function renderToken(
  token: TemplateToken,
  year: number,
  month: number
): string {
  switch (token.kind) {
    case "M": {
      const shifted =
        shiftMonth(year, month, token.offset);

      return `${shifted.year}-${String(shifted.month).padStart(2, "0")}`;
    }

    case "Y":
      return String(year + token.offset);

    case "YY":
      return String((year + token.offset) % 100).padStart(2, "0");

    case "Q": {
      const shifted =
        shiftMonth(year, Math.floor((month - 1) / 3) * 3 + 1, token.offset * 3);

      return `${shifted.year} Q${Math.floor((shifted.month - 1) / 3) + 1}`;
    }

    case "R": {
      const start =
        shiftMonth(year, month, token.offset);

      const end =
        shiftMonth(start.year, start.month, 2);

      const yy = (value: number) =>
        String(value % 100).padStart(2, "0");

      return start.year === end.year
        ? `${MONTH_NAMES[start.month - 1]} - ${MONTH_NAMES[end.month - 1]} ${yy(end.year)}`
        : `${MONTH_NAMES[start.month - 1]} ${yy(start.year)} - ${MONTH_NAMES[end.month - 1]} ${yy(end.year)}`;
    }
  }
}

/* Rendu pour une date de valeur AAAA-MM-JJ ; null si le modèle ou la date est invalide. */
export function renderCommentTemplate(
  template: string,
  valueDate: string
): string | null {
  const date =
    /^(\d{4})-(\d{2})-\d{2}$/.exec(valueDate);

  if (!date || "error" in parseTemplate(template)) {
    return null;
  }

  const year =
    Number(date[1]);

  const month =
    Number(date[2]);

  return template
    .replace(TOKEN_PATTERN, (_match, kind: TokenKind, sign?: string, digits?: string) =>
      renderToken(
        {
          kind,
          offset: digits === undefined ? 0 : Number(digits) * (sign === "-" ? -1 : 1),
        },
        year,
        month
      )
    )
    .trim();
}
