import {
  asArray,
  asBoolean,
  asNullableNumber,
  asNumber,
  asObject,
  asString,
  ContractError,
  type JsonObject,
} from "@/contracts/read";

/* =========================
   Cartes bancaires proposées à l'iPhone

   Contrat : ../Backend/docs/mobile-expense-contract.md, § 3.4
   (capacité mobileExpense).

   settings/bankingCards.json (exportBankingCards) :
     { "version": 1, "generatedAt": "…",
       "accounts": [ { "accountId": 3, "label": "Example Card",
                       "kind": "credit", "currency": "CHF",
                       "active": true } ],
       "owners": [ "alex", "sam" ],
       "ownerSubCategories": [ { "owner": "alex",
                                 "subCategoryIds": [ 3, 5 ] } ],
       "cards": [ { "cardId": 9, "internalId": "**0000",
                    "holder": "Alex", "accountId": 3,
                    "currency": "EUR", "mobileLabel": "Card EUR",
                    "mobileOwner": "alex",
                    "mobileColor": "#1E88E5",
                    "usage": { "movements12m": 120,
                               "lastMovement": "2026-11-28" } } ] }

   cards : triées par dernier mouvement, les plus récentes
   d'abord (ordre conservé). currency null : devise du compte ;
   mobileLabel null : carte non proposée sur l'iPhone.

   Cartes nominatives (contrat 0.3, multi-environnements
   1.8.0) : owners = propriétaires des appareils de
   l'environnement, seuls choix possibles (absent = liste
   vide) ; mobileOwner = propriétaire de la carte, qui n'est
   proposée qu'à ses appareils (absent = null). Un
   propriétaire retiré d'owners reste porté par ses cartes.

   Contrat 0.4 : mobileColor = couleur de la carte sur
   l'iPhone, #RRGGBB en majuscules (absente ou invalide =
   null) ; libellé unique par propriétaire (les cartes sans
   propriétaire entre elles). ownerSubCategories (§ 3.3) =
   sous-catégories proposées à chaque propriétaire, un
   élément par propriétaire d'owners, plus les propriétaires
   retirés qui en ont encore, sous-catégories clôturées
   comprises.

   Contrat 0.10 (§ 3.5) : mobileTracked (absent = true) =
   false pour une carte d'un compte non suivi dans HomeTools
   (dépenses hors suivi, jamais liées à un mouvement) ; elle
   peut n'avoir aucun compte (devise de la carte, sinon CHF).

   Saisies par événements PWA-MEX_<AAAAMMJJHHMMSS>_… :
   - _C<cardId>.json, MOBILE_CARD_SAVED : les six champs
     toujours envoyés ;
   - _O<owner>.json, MOBILE_OWNER_SAVED : liste complète des
     sous-catégories du propriétaire, qui remplace l'ancienne.

   Devises acceptées par le Mac : CHF et celles de
   settings/exchangeRates.json (clés de rates).
========================= */

export const BANKING_CARDS_FOLDER = "settings";

export const BANKING_CARDS_FILE = "bankingCards.json";

export const EXCHANGE_RATES_FOLDER = "settings";

export const EXCHANGE_RATES_FILE = "exchangeRates.json";

export const MOBILE_EXPENSE_EVENT_TRIGRAM = "MEX";

export const MOBILE_EXPENSE_EVENT_VERSION = 1;

export const MOBILE_LABEL_MAX = 30;

export const BASE_CURRENCY = "CHF";

export type BankingAccountKind = "credit" | "debit";

export interface BankingAccount {
  accountId: number;
  label: string;
  kind: BankingAccountKind;
  currency: string;
  active: boolean;
}

export interface BankingCard {
  cardId: number;
  internalId: string;
  holder: string;
  accountId: number | null;
  currency: string | null;
  mobileLabel: string | null;
  mobileOwner: string | null;
  mobileColor: string | null;
  mobileTracked: boolean;
  movements12m: number;
  lastMovement: string | null;
}

export interface OwnerSubCategories {
  owner: string;
  subCategoryIds: number[];
}

export interface BankingCards {
  generatedAt: string;
  accounts: BankingAccount[];
  owners: string[];
  ownerSubCategories: OwnerSubCategories[];
  cards: BankingCard[];
}

/* Charge utile de MOBILE_CARD_SAVED (sans source). */
export interface BankingCardSave {
  cardId: number;
  accountId: number | null;
  currency: string | null;
  mobileLabel: string | null;

  /* null : aucun propriétaire. */
  mobileOwner: string | null;

  /* #RRGGBB ; null : aucune couleur. */
  mobileColor: string | null;

  /* false : carte hors suivi (compte facultatif). */
  mobileTracked: boolean;
}

/* Charge utile de MOBILE_OWNER_SAVED (sans source). */
export interface OwnerSubCategoriesSave {
  owner: string;
  subCategoryIds: number[];
}

const COLOR_PATTERN =
  /^#[0-9A-F]{6}$/;

/* #RRGGBB en majuscules ; null si absente ou invalide. */
export function normalizeColor(
  value: unknown
): string | null {
  const color =
    asString(value).trim().toUpperCase();

  return COLOR_PATTERN.test(color)
    ? color
    : null;
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

function nullableString(
  value: unknown
): string | null {
  return asString(value).trim() || null;
}

export function readBankingCards(
  raw: unknown
): BankingCards {
  const file =
    asObject(raw);

  if (
    !file ||
    asNumber(file.version) !== 1 ||
    !Array.isArray(file.cards)
  ) {
    throw new ContractError(
      BANKING_CARDS_FILE,
      "invalid format"
    );
  }

  return {
    generatedAt:
      asString(file.generatedAt),

    accounts: objects(file.accounts)
      .map(account => ({
        accountId: asNumber(account.accountId),
        label: asString(account.label),
        kind: (account.kind === "credit" ? "credit" : "debit") as BankingAccountKind,
        currency: asString(account.currency, BASE_CURRENCY),
        active: asBoolean(account.active),
      })),

    owners: [
      ...new Set(
        asArray(file.owners)
          .map(owner => asString(owner).trim())
          .filter(Boolean)
      ),
    ],

    ownerSubCategories: objects(file.ownerSubCategories)
      .map(item => ({
        owner: asString(item.owner).trim(),
        subCategoryIds: [
          ...new Set(
            asArray(item.subCategoryIds)
              .map(id => asNumber(id))
              .filter(id => Number.isInteger(id) && id > 0)
          ),
        ],
      }))
      .filter(item => item.owner),

    cards: objects(file.cards)
      .map(card => {
        const usage =
          asObject(card.usage);

        return {
          cardId: asNumber(card.cardId),
          internalId: asString(card.internalId),
          holder: asString(card.holder),
          accountId: asNullableNumber(card.accountId),
          currency: nullableString(card.currency),
          mobileLabel: nullableString(card.mobileLabel),
          mobileOwner: nullableString(card.mobileOwner),
          mobileColor: normalizeColor(card.mobileColor),
          mobileTracked: card.mobileTracked !== false,
          movements12m: asNumber(usage?.movements12m),
          lastMovement: nullableString(usage?.lastMovement),
        };
      }),
  };
}

/* CHF, puis les devises du fichier des cours, triées. */
export function readExchangeCurrencies(
  raw: unknown
): string[] {
  const rates =
    asObject(asObject(raw)?.rates);

  return [
    BASE_CURRENCY,
    ...Object.keys(rates ?? {})
      .filter(code => /^[A-Z]{3}$/.test(code) && code !== BASE_CURRENCY)
      .sort(),
  ];
}

export function cardEventSuffix(
  cardId: number
): string {
  return `C${cardId}`;
}

/* Propriétaire tel quel (contrat § 3.4). */
export function ownerEventSuffix(
  owner: string
): string {
  return `O${owner}`;
}
