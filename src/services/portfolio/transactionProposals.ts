import {
  compareReplayOrder,
  type PortfolioPosition,
  type PortfolioTransaction,
  type PortfolioTransactionType,
} from "@/contracts/portfolio";

import {
  decimalText,
  transactionToForm,
  type TransactionForm,
} from "@/services/portfolio/transactionForm";

/* =========================
   Propositions d'une nouvelle transaction

   Valeurs tirées de la dernière transaction comparable du
   journal, selon le type, et des positions publiées par le
   Mac (quantité détenue chez un dépositaire). Aucun calcul de
   position : la quantité vient de portfolio.json.

   - Buy : dépositaire et devise réglée du dernier achat du
     titre ; ses frais en indication seulement.
   - Sell, Transfer : dépositaire qui détient le titre (celui
     choisi, le seul, ou celui du dernier achat ou de la
     dernière vente) et quantité détenue chez lui ; pour une
     vente, devise réglée du dernier achat ou vente.
   - Dividend : dernier dividende du titre (chez le
     dépositaire choisi) : brut, impôt et son taux, devise,
     commentaire.
   - Fee, Interest, Cash in / out, FX exchange : dernière
     transaction du type (chez le dépositaire choisi, sinon la
     dernière de toutes) : dépositaire, devise(s) ; montant,
     titre et commentaire pour Fee, commentaire pour Interest.
   - Opening, Split : rien.

   Le cours et le change ne sont jamais proposés : ils
   viennent de chaque avis d'opération.
========================= */

export type ProposedField =
  | "partyId"
  | "securityId"
  | "quantity"
  | "grossAmount"
  | "taxes"
  | "cashCurrency"
  | "cashAmount"
  | "counterCurrency"
  | "comment";

export type ProposedValues =
  Partial<Pick<TransactionForm, ProposedField>>;

export interface TransactionProposal {
  values: ProposedValues;

  /* Transaction d'où viennent les valeurs. */
  source: PortfolioTransaction | null;

  /* Dépositaire dont la quantité détenue est proposée. */
  heldAt: string | null;

  /* Frais du dernier achat, en indication. */
  feesHint: string | null;

  /* Impôt / brut du dernier dividende, pour suivre le brut saisi. */
  taxRate: number | null;
}

export interface ProposalContext {
  type: PortfolioTransactionType;
  partyId: number | null;
  securityId: number | null;
}

const EMPTY: TransactionProposal = {
  values: {},
  source: null,
  heldAt: null,
  feesHint: null,
  taxRate: null,
};

function lastOf(
  history: readonly PortfolioTransaction[],
  test: (transaction: PortfolioTransaction) => boolean
): PortfolioTransaction | null {
  let last: PortfolioTransaction | null = null;

  for (const transaction of history) {
    if (
      test(transaction) &&
      (!last || compareReplayOrder(transaction, last) > 0)
    ) {
      last = transaction;
    }
  }

  return last;
}

function pick(
  form: TransactionForm,
  fields: readonly ProposedField[]
): ProposedValues {
  const values: ProposedValues = {};

  for (const field of fields) {
    Object.assign(values, { [field]: form[field] });
  }

  return values;
}

/* Vente ou transfert : quantité détenue chez le dépositaire. */
function proposeHolding(
  context: ProposalContext,
  history: readonly PortfolioTransaction[],
  positions: readonly PortfolioPosition[]
): TransactionProposal {
  const securityId =
    context.securityId;

  if (securityId === null) {
    return EMPTY;
  }

  const holders =
    positions
      .find(position => position.securityId === securityId)
      ?.byCustodian
      .filter(holding => holding.quantity > 0) ?? [];

  const lastTrade =
    lastOf(
      history,
      transaction =>
        (transaction.type === "BUY" || transaction.type === "SELL") &&
        transaction.securityId === securityId
    );

  const holder =
    context.partyId !== null
      ? holders.find(holding => holding.partyId === context.partyId)
      : holders.length === 1
        ? holders[0]
        : holders.find(holding => holding.partyId === lastTrade?.partyId);

  const values: ProposedValues = {};

  if (holder) {
    values.partyId = holder.partyId;
    values.quantity = decimalText(holder.quantity);
  }

  const sell =
    context.type === "SELL" && lastTrade;

  if (sell && lastTrade.cashCurrency) {
    values.cashCurrency = lastTrade.cashCurrency;
  }

  return {
    ...EMPTY,
    values,
    source: sell ? lastTrade : null,
    heldAt: holder?.partyName ?? null,
  };
}

export function proposeTransaction(
  context: ProposalContext,
  history: readonly PortfolioTransaction[],
  positions: readonly PortfolioPosition[]
): TransactionProposal {
  const { type, partyId, securityId } =
    context;

  const atParty = (transaction: PortfolioTransaction) =>
    partyId === null || transaction.partyId === partyId;

  switch (type) {
    case "BUY": {
      const last =
        securityId === null
          ? null
          : lastOf(
              history,
              transaction =>
                transaction.type === "BUY" &&
                transaction.securityId === securityId
            );

      if (!last) {
        return EMPTY;
      }

      const form =
        transactionToForm(last);

      return {
        ...EMPTY,
        values: pick(form, ["partyId", "cashCurrency"]),
        source: last,
        feesHint: form.fees || null,
      };
    }

    case "SELL":
    case "TRANSFER":
      return proposeHolding(context, history, positions);

    case "DIVIDEND": {
      const last =
        securityId === null
          ? null
          : lastOf(
              history,
              transaction =>
                transaction.type === "DIVIDEND" &&
                transaction.securityId === securityId &&
                atParty(transaction)
            );

      if (!last) {
        return EMPTY;
      }

      const gross =
        last.grossAmount ?? 0;

      return {
        ...EMPTY,
        values: pick(
          transactionToForm(last),
          ["partyId", "grossAmount", "taxes", "cashCurrency", "comment"]
        ),
        source: last,
        taxRate: gross > 0 ? last.taxes / gross : null,
      };
    }

    case "FEE":
    case "INTEREST":
    case "CASH_IN":
    case "CASH_OUT":
    case "FX_EXCHANGE": {
      const last =
        lastOf(
          history,
          transaction =>
            transaction.type === type &&
            atParty(transaction)
        );

      if (!last) {
        return EMPTY;
      }

      const fields: ProposedField[] =
        type === "FEE"
          ? ["partyId", "cashCurrency", "cashAmount", "securityId", "comment"]
          : type === "INTEREST"
            ? ["partyId", "cashCurrency", "comment"]
            : type === "FX_EXCHANGE"
              ? ["partyId", "cashCurrency", "counterCurrency"]
              : ["partyId", "cashCurrency"];

      return {
        ...EMPTY,
        values: pick(transactionToForm(last), fields),
        source: last,
      };
    }

    default:
      return EMPTY;
  }
}
