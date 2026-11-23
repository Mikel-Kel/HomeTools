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
========================= */

export const PORTFOLIO_FOLDER = "portfolio";
export const PORTFOLIO_FILE = "portfolio.json";

const PORTFOLIO_VERSION = 1;

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
