import type {
  PortfolioSecurity,
  PortfolioTransaction,
  PortfolioTransactionType,
} from "@/contracts/portfolio";

/* =========================
   Formulaire d'une transaction du portefeuille

   Champs par type, contrôles et charge utile de
   TRANSACTION_SAVED (../Backend/docs/portfolio-contract.md,
   § 3 et § 7). Les contrôles évitent un aller-retour avec le
   Mac, qui reste juge (quantité détenue, cohérence du
   journal).

   - Les valeurs sont saisies en texte : virgule et
     apostrophes admises, nombre de décimales du contrat.
   - Montant réglé saisi sans signe, sauf pour les intérêts
     (un taux négatif est admis) : le signe suit le type.
   - Un champ que le type n'admet pas part à null.
   - Change : celui de la devise du titre, ou de la devise
     réglée pour FEE et INTEREST ; 1 en CHF.
========================= */

const BASE_CURRENCY = "CHF";

const QUANTITY_DECIMALS = 6;
const PRICE_DECIMALS = 6;
const AMOUNT_DECIMALS = 2;
const FX_DECIMALS = 8;

export const COMMENT_MAX_LENGTH = 255;

type CashRule = "debit" | "credit" | "signed";

export interface TransactionFormRule {
  party: boolean;
  toParty: boolean;
  security: "required" | "optional" | null;
  quantity: boolean;
  price: boolean;
  gross: boolean;
  fees: boolean;
  taxes: boolean;
  fx: "security" | "cash" | null;
  cash: CashRule | null;
  counter: boolean;
  split: boolean;
}

const NONE: TransactionFormRule = {
  party: true,
  toParty: false,
  security: null,
  quantity: false,
  price: false,
  gross: false,
  fees: false,
  taxes: false,
  fx: null,
  cash: null,
  counter: false,
  split: false,
};

const TRADE: TransactionFormRule = {
  ...NONE,
  security: "required",
  quantity: true,
  price: true,
  fees: true,
  taxes: true,
  fx: "security",
};

export const TRANSACTION_FORM_RULES:
  Record<PortfolioTransactionType, TransactionFormRule> = {
    OPENING: { ...TRADE, fees: false, taxes: false },
    CASH_IN: { ...NONE, cash: "credit" },
    CASH_OUT: { ...NONE, cash: "debit" },
    FX_EXCHANGE: { ...NONE, cash: "debit", counter: true },
    BUY: { ...TRADE, cash: "debit" },
    SELL: { ...TRADE, cash: "credit" },
    TRANSFER: { ...NONE, toParty: true, security: "required", quantity: true },
    DIVIDEND: {
      ...NONE,
      security: "required",
      gross: true,
      taxes: true,
      fx: "security",
      cash: "credit",
    },
    SPLIT: { ...NONE, party: false, security: "required", split: true },
    FEE: { ...NONE, security: "optional", fx: "cash", cash: "debit" },
    INTEREST: { ...NONE, taxes: true, fx: "cash", cash: "signed" },
  };

export interface TransactionForm {
  txId: number | null;
  date: string | null;
  type: PortfolioTransactionType;
  partyId: number | null;
  toPartyId: number | null;
  securityId: number | null;
  quantity: string;
  price: string;
  grossAmount: string;
  fxRate: string;
  fees: string;
  taxes: string;
  cashCurrency: string;
  cashAmount: string;
  counterCurrency: string;
  counterAmount: string;
  splitFrom: string;
  splitTo: string;
  comment: string;
}

export interface TransactionPayload {
  txId: number | null;
  date: string;
  type: PortfolioTransactionType;
  partyId: number | null;
  toPartyId: number | null;
  securityId: number | null;
  quantity: number | null;
  price: number | null;
  grossAmount: number | null;
  fxRate: number | null;
  fees: number | null;
  taxes: number | null;
  cashCurrency: string | null;
  cashAmount: number | null;
  counterCurrency: string | null;
  counterAmount: number | null;
  splitFrom: number | null;
  splitTo: number | null;
  comment: string | null;
}

export type TransactionCheck =
  | { error: string; payload: null }
  | { error: ""; payload: TransactionPayload };

/* Nombre saisi ; null si vide, NaN s'il est invalide. */
export function parseDecimal(
  text: string,
  decimals: number
): number | null {
  const clean =
    text.replace(/[\s'’]/g, "").replace(",", ".");

  if (!clean) {
    return null;
  }

  const match =
    /^-?\d+(?:\.(\d+))?$/.exec(clean);

  return match && (match[1]?.length ?? 0) <= decimals
    ? Number(clean)
    : Number.NaN;
}

/* Nombre en texte de saisie : point décimal, sans zéros inutiles. */
export function decimalText(
  value: number | null
): string {
  if (value === null) {
    return "";
  }

  const fixed =
    value.toFixed(FX_DECIMALS);

  return fixed.replace(/\.?0+$/, "");
}

function roundAmount(
  value: number
): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function emptyTransactionForm(
  date: string
): TransactionForm {
  return {
    txId: null,
    date,
    type: "BUY",
    partyId: null,
    toPartyId: null,
    securityId: null,
    quantity: "",
    price: "",
    grossAmount: "",
    fxRate: "",
    fees: "",
    taxes: "",
    cashCurrency: BASE_CURRENCY,
    cashAmount: "",
    counterCurrency: BASE_CURRENCY,
    counterAmount: "",
    splitFrom: "",
    splitTo: "",
    comment: "",
  };
}

export function transactionToForm(
  transaction: PortfolioTransaction
): TransactionForm {
  const type =
    transaction.type as PortfolioTransactionType;

  const signed =
    TRANSACTION_FORM_RULES[type]?.cash === "signed";

  const cash =
    transaction.cashAmount === null || signed
      ? transaction.cashAmount
      : Math.abs(transaction.cashAmount);

  return {
    txId: transaction.txId,
    date: transaction.date,
    type,
    partyId: transaction.partyId,
    toPartyId: transaction.toPartyId,
    securityId: transaction.securityId,
    quantity: decimalText(transaction.quantity),
    price: decimalText(transaction.price),
    grossAmount: decimalText(transaction.grossAmount),
    fxRate: decimalText(transaction.fxRate),
    fees: transaction.fees ? decimalText(transaction.fees) : "",
    taxes: transaction.taxes ? decimalText(transaction.taxes) : "",
    cashCurrency: transaction.cashCurrency ?? BASE_CURRENCY,
    cashAmount: decimalText(cash),
    counterCurrency: transaction.counterCurrency ?? BASE_CURRENCY,
    counterAmount: decimalText(transaction.counterAmount),
    splitFrom: transaction.splitFrom === null ? "" : String(transaction.splitFrom),
    splitTo: transaction.splitTo === null ? "" : String(transaction.splitTo),
    comment: transaction.comment ?? "",
  };
}

/* Devise dont le change est demandé ; null si le type n'en a pas. */
export function fxCurrencyOf(
  form: TransactionForm,
  security: PortfolioSecurity | undefined
): string | null {
  switch (TRANSACTION_FORM_RULES[form.type].fx) {
    case "security":
      return security?.currency ?? null;

    case "cash":
      return form.cashCurrency;

    default:
      return null;
  }
}

/*
  Net de l'avis, sans signe, en devise du titre : BUY, SELL
  et DIVIDEND ; null tant que les montants sont incomplets.
*/
export function netAmountOf(
  form: TransactionForm,
  security: PortfolioSecurity | undefined
): number | null {
  if (!security) {
    return null;
  }

  const fees =
    parseDecimal(form.fees, AMOUNT_DECIMALS) ?? 0;

  const taxes =
    parseDecimal(form.taxes, AMOUNT_DECIMALS) ?? 0;

  let net: number;

  if (form.type === "DIVIDEND") {
    const gross =
      parseDecimal(form.grossAmount, AMOUNT_DECIMALS);

    if (gross === null) {
      return null;
    }

    net = gross - taxes;
  } else if (form.type === "BUY" || form.type === "SELL") {
    const quantity =
      parseDecimal(form.quantity, QUANTITY_DECIMALS);

    const price =
      parseDecimal(form.price, PRICE_DECIMALS);

    if (quantity === null || price === null) {
      return null;
    }

    const gross =
      quantity * price * security.quoteFactor;

    net = form.type === "BUY"
      ? gross + fees + taxes
      : gross - fees - taxes;
  } else {
    return null;
  }

  return Number.isFinite(net) && net >= 0
    ? roundAmount(net)
    : null;
}

export function checkTransactionForm(
  form: TransactionForm,
  securities: readonly PortfolioSecurity[]
): TransactionCheck {
  const rule =
    TRANSACTION_FORM_RULES[form.type];

  const fail = (error: string): TransactionCheck =>
    ({ error, payload: null });

  const security =
    securities.find(item => item.securityId === form.securityId);

  if (!form.date) {
    return fail("The date is required.");
  }

  if (rule.party && form.partyId === null) {
    return fail("Choose a custodian from the list.");
  }

  if (rule.toParty) {
    if (form.toPartyId === null) {
      return fail("Choose the receiving custodian from the list.");
    }

    if (form.toPartyId === form.partyId) {
      return fail("The two custodians must differ.");
    }
  }

  if (rule.security === "required" && !security) {
    return fail("Choose a security.");
  }

  const number = (
    text: string,
    decimals: number,
    label: string,
    required: boolean,
    allowZero = false
  ): number | null | string => {
    const value =
      parseDecimal(text, decimals);

    if (value === null) {
      return required ? `${label} is required.` : null;
    }

    if (Number.isNaN(value)) {
      return `${label}: invalid number (at most ${decimals} decimals).`;
    }

    if (value < 0 || (value === 0 && !allowZero)) {
      return `${label} must be positive.`;
    }

    return value;
  };

  const quantity =
    rule.quantity
      ? number(form.quantity, QUANTITY_DECIMALS, "The quantity", true)
      : null;

  if (typeof quantity === "string") {
    return fail(quantity);
  }

  const price =
    rule.price
      ? number(form.price, PRICE_DECIMALS, "The price", true, form.type === "SELL")
      : null;

  if (typeof price === "string") {
    return fail(price);
  }

  const grossAmount =
    rule.gross
      ? number(form.grossAmount, AMOUNT_DECIMALS, "The gross amount", true)
      : null;

  if (typeof grossAmount === "string") {
    return fail(grossAmount);
  }

  const fees =
    rule.fees
      ? number(form.fees, AMOUNT_DECIMALS, "The fees", false, true)
      : null;

  if (typeof fees === "string") {
    return fail(fees);
  }

  const taxes =
    rule.taxes
      ? number(form.taxes, AMOUNT_DECIMALS, "The taxes", false, true)
      : null;

  if (typeof taxes === "string") {
    return fail(taxes);
  }

  let cashAmount: number | null = null;

  if (rule.cash === "signed") {
    cashAmount =
      parseDecimal(form.cashAmount, AMOUNT_DECIMALS);

    if (cashAmount === null || Number.isNaN(cashAmount) || cashAmount === 0) {
      return fail("The cash amount is required (not zero, at most 2 decimals).");
    }
  } else if (rule.cash) {
    const amount =
      number(form.cashAmount, AMOUNT_DECIMALS, "The cash amount", true, form.type === "SELL");

    if (typeof amount === "string") {
      return fail(amount);
    }

    cashAmount =
      rule.cash === "debit"
        ? -(amount as number)
        : amount;
  }

  let counterAmount: number | null = null;

  if (rule.counter) {
    if (form.counterCurrency === form.cashCurrency) {
      return fail("The two currencies must differ.");
    }

    const amount =
      number(form.counterAmount, AMOUNT_DECIMALS, "The amount received", true);

    if (typeof amount === "string") {
      return fail(amount);
    }

    counterAmount = amount;
  }

  let splitFrom: number | null = null;
  let splitTo: number | null = null;

  if (rule.split) {
    splitFrom = Number(form.splitFrom);
    splitTo = Number(form.splitTo);

    if (
      !Number.isInteger(splitFrom) || splitFrom <= 0 ||
      !Number.isInteger(splitTo) || splitTo <= 0
    ) {
      return fail("The split ratio is two whole numbers (1 → 10).");
    }
  }

  let fxRate: number | null = null;

  const fxCurrency =
    fxCurrencyOf(form, security);

  if (fxCurrency === BASE_CURRENCY) {
    fxRate = 1;
  } else if (fxCurrency) {
    const rate =
      number(form.fxRate, FX_DECIMALS, `The ${fxCurrency}/CHF rate`, true);

    if (typeof rate === "string") {
      return fail(rate);
    }

    fxRate = rate;
  }

  if (
    rule.cash &&
    security &&
    (form.type === "BUY" || form.type === "SELL" || form.type === "DIVIDEND") &&
    form.cashCurrency === security.currency
  ) {
    const net =
      netAmountOf(form, security);

    if (net === null) {
      return fail("The fees and taxes exceed the amount.");
    }

    if (Math.abs(Math.abs(cashAmount ?? 0) - net) > 0.05) {
      return fail(`The cash amount differs from the net (${net.toFixed(2)}).`);
    }
  }

  return {
    error: "",
    payload: {
      txId: form.txId,
      date: form.date,
      type: form.type,
      partyId: rule.party ? form.partyId : null,
      toPartyId: rule.toParty ? form.toPartyId : null,
      securityId: rule.security ? form.securityId : null,
      quantity,
      price,
      grossAmount,
      fxRate,
      fees: fees || null,
      taxes: taxes || null,
      cashCurrency: rule.cash ? form.cashCurrency : null,
      cashAmount,
      counterCurrency: rule.counter ? form.counterCurrency : null,
      counterAmount,
      splitFrom,
      splitTo,
      comment: form.comment.trim() || null,
    },
  };
}
