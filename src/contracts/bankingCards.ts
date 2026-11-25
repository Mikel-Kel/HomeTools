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
       "owners": [ "alex" ],
       "cards": [ { "cardId": 9, "internalId": "**0000",
                    "holder": "Alex", "accountId": 3,
                    "currency": "EUR", "mobileLabel": "Card EUR",
                    "mobileOwner": "alex",
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

   Saisie par événement PWA-MEX_<AAAAMMJJHHMMSS>_C<cardId>.json,
   MOBILE_CARD_SAVED ; les quatre champs sont toujours envoyés.

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
  movements12m: number;
  lastMovement: string | null;
}

export interface BankingCards {
  generatedAt: string;
  accounts: BankingAccount[];
  owners: string[];
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
