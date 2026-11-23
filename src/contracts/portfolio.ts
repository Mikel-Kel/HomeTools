import {
  readMarketHistory,
} from "@/contracts/indicators";

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
   portfolio/ : positions en titres et liquidités (version 1)

   Contrat complet : ../Backend/docs/portfolio-contract.md.

   Le Mac rejoue le journal des transactions et publie tous
   les calculs : la PWA ne calcule ni position ni P&L.

   portfolio.json (§ 5.1) : totaux, titres, positions
   consolidées avec leur détail par dépositaire, positions
   soldées, liquidités par dépositaire et devise,
   avertissements. Listes vides sans transaction.

   - Change : CHF pour 1 unité de devise ; pour le CHF, fx = 1,
     fxDate et fxSource à null.
   - priceSource, fxSource : market (dernière valeur de la
     famille 5) ou transaction (dernier prix ou change du
     journal), la date étant publiée.
   - weight : part de la valeur totale, liquidités comprises
     (0 à 1).

   Une version autre que 1, ou une ligne sans identifiant,
   rend le fichier invalide.

   transactions.json (§ 5.2) : journal, du plus récent au plus
   ancien. price est le prix réel de l'avis ; adjustedPrice
   le place sur une courbe ajustée des splits. cashAmount est
   signé (+ crédit, − débit).

   Saisies par événements (§ 7) :
     events/PWA-PFL_<AAAAMMJJHHMMSS>_S<securityId|NEW>.json
       { "version": 1, "eventType": "SECURITY_SAVED",
         "payload": { "securityId" | null, "label", "isin",
                      "currency", "priceIndicatorType",
                      "quoteFactor", "seriesSplitAdjusted",
                      "active" } }
     events/PWA-PFL_<AAAAMMJJHHMMSS>_T<txId>_DEL.json
       { "version": 1, "eventType": "TRANSACTION_DELETED",
         "payload": { "txId" } }
========================= */

export const PORTFOLIO_FOLDER = "portfolio";
export const PORTFOLIO_FILE = "portfolio.json";
export const PORTFOLIO_TRANSACTIONS_FILE = "transactions.json";

const PORTFOLIO_VERSION = 1;

export const PORTFOLIO_EVENT_TRIGRAM = "PFL";
export const PORTFOLIO_EVENT_VERSION = 1;

/* Valeur = quantité × cours × facteur (§ 6.2). */
export const QUOTE_UNITS: { factor: number; label: string }[] = [
  { factor: 1, label: "Per unit" },
  { factor: 0.01, label: "% of nominal" },
  { factor: 0.001, label: "‰ of nominal" },
];

const STOCKS_GROUP = "Stocks";
const FX_GROUP = "FX";

export type PortfolioValueSource = "market" | "transaction";

export type PortfolioWarningCode =
  | "NEGATIVE_CASH"
  | "NO_MARKET_PRICE"
  | "NO_MARKET_FX";

export interface PortfolioTotals {
  valueChf: number;
  securitiesChf: number;
  cashChf: number;
  priceEffectChf: number;
  fxEffectChf: number;
  unrealizedChf: number;
  realizedChf: number;
  incomeChf: number;
  feesChf: number;
}

export interface PortfolioSecurity {
  securityId: number;
  label: string;
  isin: string | null;
  currency: string;
  priceIndicatorType: number | null;
  quoteFactor: number;
  seriesSplitAdjusted: boolean;
  active: boolean;
}

/* Montants communs à une position et à sa part chez un dépositaire. */
interface PortfolioHolding {
  quantity: number;
  avgPrice: number;
  avgFx: number;
  unrealizedCcy: number;
  valueChf: number;
  weight: number;
  priceEffectChf: number;
  fxEffectChf: number;
  unrealizedChf: number;
  realizedChf: number;
  incomeChf: number;
}

export interface PortfolioCustodianHolding extends PortfolioHolding {
  partyId: number;
  partyName: string;
}

export interface PortfolioPosition extends PortfolioHolding {
  securityId: number;
  price: number;
  priceDate: string;
  priceSource: PortfolioValueSource;
  fx: number;
  fxDate: string | null;
  fxSource: PortfolioValueSource | null;
  byCustodian: PortfolioCustodianHolding[];
}

export interface PortfolioClosedPosition {
  securityId: number;
  realizedChf: number;
  incomeChf: number;
}

export interface PortfolioCash {
  partyId: number;
  partyName: string;
  currency: string;
  amount: number;
  fx: number;
  fxDate: string | null;
  valueChf: number;
  weight: number;
}

export interface PortfolioWarning {
  code: PortfolioWarningCode | string;
  partyId: number | null;
  securityId: number | null;
  currency: string | null;
  date: string | null;
  amount: number | null;
}

export interface Portfolio {
  generatedAt: string;
  totals: PortfolioTotals;
  securities: PortfolioSecurity[];
  positions: PortfolioPosition[];
  closedPositions: PortfolioClosedPosition[];
  cash: PortfolioCash[];
  warnings: PortfolioWarning[];
}

export const TRANSACTION_TYPES = [
  { value: "OPENING", label: "Opening" },
  { value: "CASH_IN", label: "Cash in" },
  { value: "CASH_OUT", label: "Cash out" },
  { value: "FX_EXCHANGE", label: "FX exchange" },
  { value: "BUY", label: "Buy" },
  { value: "SELL", label: "Sell" },
  { value: "TRANSFER", label: "Transfer" },
  { value: "DIVIDEND", label: "Dividend" },
  { value: "SPLIT", label: "Split" },
  { value: "FEE", label: "Fee" },
  { value: "INTEREST", label: "Interest" },
] as const;

export type PortfolioTransactionType =
  typeof TRANSACTION_TYPES[number]["value"];

export interface PortfolioTransaction {
  txId: number;
  date: string;
  type: PortfolioTransactionType | string;
  partyId: number | null;
  toPartyId: number | null;
  securityId: number | null;
  quantity: number | null;
  price: number | null;
  adjustedPrice: number | null;
  grossAmount: number | null;
  fxRate: number | null;
  fees: number;
  taxes: number;
  cashCurrency: string | null;
  cashAmount: number | null;
  counterCurrency: string | null;
  counterAmount: number | null;
  splitFrom: number | null;
  splitTo: number | null;
  comment: string | null;
}

export function transactionTypeLabel(
  type: string
): string {
  return (
    TRANSACTION_TYPES.find(item => item.value === type)?.label ??
    type
  );
}

export function transactionEventSuffix(
  txId: number | null
): string {
  return `T${txId ?? "NEW"}`;
}

export function transactionDeleteSuffix(
  txId: number
): string {
  return `${transactionEventSuffix(txId)}_DEL`;
}

export type PortfolioSecuritySave =
  Omit<PortfolioSecurity, "securityId"> & { securityId: number | null };

export function securityEventSuffix(
  securityId: number | null
): string {
  return `S${securityId ?? "NEW"}`;
}

/* Séries de cours et devises proposées à la saisie d'un titre. */
export interface PortfolioPriceSeries {
  itemId: number;
  label: string;
  last: string;
  lastValue: number | null;
}

export interface PortfolioMarketChoices {
  series: PortfolioPriceSeries[];
  currencies: string[];
}

/* Lecture de market-history.json, sans garder ses points. */
export function readPortfolioMarketChoices(
  raw: unknown
): PortfolioMarketChoices {
  const history =
    readMarketHistory(raw);

  return {
    series: history
      .filter(series => series.group === STOCKS_GROUP)
      .map(({ itemId, label, last, lastValue }) => ({
        itemId,
        label,
        last,
        lastValue,
      })),
    currencies: [
      "CHF",
      ...history
        .filter(series => series.group === FX_GROUP)
        .map(series => series.label),
    ],
  };
}

function requiredId(
  row: JsonObject,
  field: string
): number {
  const id =
    asNullableNumber(row[field]);

  if (id === null) {
    throw new ContractError(PORTFOLIO_FILE, `missing ${field}`);
  }

  return id;
}

function asNullableString(
  value: unknown
): string | null {
  return asString(value) || null;
}

function readSource(
  value: unknown
): PortfolioValueSource | null {
  return value === "market" || value === "transaction"
    ? value
    : null;
}

function readTotals(
  value: unknown
): PortfolioTotals {
  const row =
    asObject(value) ?? {};

  return {
    valueChf: asNumber(row.valueChf),
    securitiesChf: asNumber(row.securitiesChf),
    cashChf: asNumber(row.cashChf),
    priceEffectChf: asNumber(row.priceEffectChf),
    fxEffectChf: asNumber(row.fxEffectChf),
    unrealizedChf: asNumber(row.unrealizedChf),
    realizedChf: asNumber(row.realizedChf),
    incomeChf: asNumber(row.incomeChf),
    feesChf: asNumber(row.feesChf),
  };
}

function readSecurity(
  value: unknown
): PortfolioSecurity {
  const row =
    asObject(value) ?? {};

  return {
    securityId: requiredId(row, "securityId"),
    label: asString(row.label),
    isin: asNullableString(row.isin),
    currency: asString(row.currency),
    priceIndicatorType: asNullableNumber(row.priceIndicatorType),
    quoteFactor: asNumber(row.quoteFactor, 1),
    seriesSplitAdjusted: asBoolean(row.seriesSplitAdjusted),
    active: asBoolean(row.active),
  };
}

function readHolding(
  row: JsonObject
): PortfolioHolding {
  return {
    quantity: asNumber(row.quantity),
    avgPrice: asNumber(row.avgPrice),
    avgFx: asNumber(row.avgFx),
    unrealizedCcy: asNumber(row.unrealizedCcy),
    valueChf: asNumber(row.valueChf),
    weight: asNumber(row.weight),
    priceEffectChf: asNumber(row.priceEffectChf),
    fxEffectChf: asNumber(row.fxEffectChf),
    unrealizedChf: asNumber(row.unrealizedChf),
    realizedChf: asNumber(row.realizedChf),
    incomeChf: asNumber(row.incomeChf),
  };
}

function readCustodianHolding(
  value: unknown
): PortfolioCustodianHolding {
  const row =
    asObject(value) ?? {};

  return {
    ...readHolding(row),
    partyId: requiredId(row, "partyId"),
    partyName: asString(row.partyName),
  };
}

function readPosition(
  value: unknown
): PortfolioPosition {
  const row =
    asObject(value) ?? {};

  return {
    ...readHolding(row),
    securityId: requiredId(row, "securityId"),
    price: asNumber(row.price),
    priceDate: asString(row.priceDate),
    priceSource: readSource(row.priceSource) ?? "transaction",
    fx: asNumber(row.fx, 1),
    fxDate: asNullableString(row.fxDate),
    fxSource: readSource(row.fxSource),
    byCustodian: asArray(row.byCustodian).map(readCustodianHolding),
  };
}

function readClosedPosition(
  value: unknown
): PortfolioClosedPosition {
  const row =
    asObject(value) ?? {};

  return {
    securityId: requiredId(row, "securityId"),
    realizedChf: asNumber(row.realizedChf),
    incomeChf: asNumber(row.incomeChf),
  };
}

function readCash(
  value: unknown
): PortfolioCash {
  const row =
    asObject(value) ?? {};

  return {
    partyId: requiredId(row, "partyId"),
    partyName: asString(row.partyName),
    currency: asString(row.currency),
    amount: asNumber(row.amount),
    fx: asNumber(row.fx, 1),
    fxDate: asNullableString(row.fxDate),
    valueChf: asNumber(row.valueChf),
    weight: asNumber(row.weight),
  };
}

function readWarning(
  value: unknown
): PortfolioWarning {
  const row =
    asObject(value) ?? {};

  return {
    code: asString(row.code),
    partyId: asNullableNumber(row.partyId),
    securityId: asNullableNumber(row.securityId),
    currency: asNullableString(row.currency),
    date: asNullableString(row.date),
    amount: asNullableNumber(row.amount),
  };
}

export function readPortfolio(
  raw: unknown
): Portfolio {
  const root =
    asObject(raw);

  if (!root || root.version !== PORTFOLIO_VERSION) {
    throw new ContractError(
      PORTFOLIO_FILE,
      `unsupported version (expected ${PORTFOLIO_VERSION})`
    );
  }

  return {
    generatedAt: asString(root.generatedAt),
    totals: readTotals(root.totals),
    securities: asArray(root.securities).map(readSecurity),
    positions: asArray(root.positions).map(readPosition),
    closedPositions: asArray(root.closedPositions).map(readClosedPosition),
    cash: asArray(root.cash).map(readCash),
    warnings: asArray(root.warnings).map(readWarning),
  };
}

function readTransaction(
  value: unknown
): PortfolioTransaction {
  const row =
    asObject(value) ?? {};

  const txId =
    asNullableNumber(row.txId);

  if (txId === null) {
    throw new ContractError(PORTFOLIO_TRANSACTIONS_FILE, "missing txId");
  }

  return {
    txId,
    date: asString(row.date),
    type: asString(row.type),
    partyId: asNullableNumber(row.partyId),
    toPartyId: asNullableNumber(row.toPartyId),
    securityId: asNullableNumber(row.securityId),
    quantity: asNullableNumber(row.quantity),
    price: asNullableNumber(row.price),
    adjustedPrice: asNullableNumber(row.adjustedPrice),
    grossAmount: asNullableNumber(row.grossAmount),
    fxRate: asNullableNumber(row.fxRate),
    fees: asNumber(row.fees),
    taxes: asNumber(row.taxes),
    cashCurrency: asNullableString(row.cashCurrency),
    cashAmount: asNullableNumber(row.cashAmount),
    counterCurrency: asNullableString(row.counterCurrency),
    counterAmount: asNullableNumber(row.counterAmount),
    splitFrom: asNullableNumber(row.splitFrom),
    splitTo: asNullableNumber(row.splitTo),
    comment: asNullableString(row.comment),
  };
}

export function readPortfolioTransactions(
  raw: unknown
): PortfolioTransaction[] {
  const root =
    asObject(raw);

  if (!root || root.version !== PORTFOLIO_VERSION) {
    throw new ContractError(
      PORTFOLIO_TRANSACTIONS_FILE,
      `unsupported version (expected ${PORTFOLIO_VERSION})`
    );
  }

  return asArray(root.transactions).map(readTransaction);
}
