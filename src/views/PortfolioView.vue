<script setup lang="ts">
import { computed } from "vue";

import PageHeader from "@/components/PageHeader.vue";
import SecuritiesPanel from "@/components/portfolio/SecuritiesPanel.vue";
import TransactionsPanel from "@/components/portfolio/TransactionsPanel.vue";
import SegmentedControl from "@/components/ui/SegmentedControl.vue";

import { usePersistentRef } from "@/composables/usePersistentRef";
import { useRemoteJson } from "@/composables/useRemoteJson";

import {
  PORTFOLIO_FILE,
  PORTFOLIO_FOLDER,
  readPortfolio,
  type PortfolioPosition,
  type PortfolioWarning,
} from "@/contracts/portfolio";

import {
  formatAmount,
  formatQuantity,
  formatQuote,
} from "@/utils/amountFormat";

/* =========================
   Portefeuille (lecture)

   Contrat : ../Backend/docs/portfolio-contract.md. Tous les
   montants viennent de portfolio/portfolio.json, relu dès
   que le Mac le republie : aucun calcul de position ni de
   P&L ici.

   Totaux, avertissements, positions consolidées (détail par
   dépositaire quand il y en a plusieurs), liquidités et
   positions soldées. La date du cours est affichée, car les
   titres n'ont pas tous la même dernière date.

   Onglet Transactions : journal (TransactionsPanel).
   Onglet Securities : liste et saisie des titres
   (SecuritiesPanel), à créer avant la première transaction.
========================= */

type PortfolioTab = "positions" | "transactions" | "securities";

const tabOptions: { value: PortfolioTab; label: string }[] = [
  { value: "positions", label: "Positions" },
  { value: "transactions", label: "Transactions" },
  { value: "securities", label: "Securities" },
];

const tab =
  usePersistentRef<PortfolioTab>("portfolio.tab", "positions");

/* Valeur retrouvée de la session mais plus valide : défaut. */
if (!tabOptions.some(option => option.value === tab.value)) {
  tab.value = "positions";
}

const portfolioFile =
  useRemoteJson({
    folder: PORTFOLIO_FOLDER,
    file: PORTFOLIO_FILE,
    read: readPortfolio,
  });

const portfolio =
  computed(() =>
    portfolioFile.data.value
  );

const isEmpty =
  computed(() => {
    const value = portfolio.value;

    return (
      !!value &&
      !value.positions.length &&
      !value.closedPositions.length &&
      !value.cash.length
    );
  });

const securityById =
  computed(() =>
    new Map(
      (portfolio.value?.securities ?? [])
        .map(security => [security.securityId, security])
    )
  );

function securityLabel(
  securityId: number | null
): string {
  return securityId === null
    ? ""
    : securityById.value.get(securityId)?.label ?? `Security ${securityId}`;
}

function currencyOf(
  position: PortfolioPosition
): string {
  return securityById.value.get(position.securityId)?.currency ?? "";
}

function partyLabel(
  partyId: number | null
): string {
  if (partyId === null) {
    return "";
  }

  return (
    portfolio.value?.cash.find(line => line.partyId === partyId)?.partyName ||
    `Party ${partyId}`
  );
}

function formatWeight(
  weight: number
): string {
  return `${(weight * 100).toFixed(1)} %`;
}

function amountClass(
  amount: number
): string {
  if (amount > 0) {
    return "gain";
  }

  return amount < 0 ? "loss" : "";
}

function warningText(
  warning: PortfolioWarning
): string {
  switch (warning.code) {
    case "NEGATIVE_CASH":
      return `Negative cash at ${partyLabel(warning.partyId)}: ${warning.currency} ${formatAmount(warning.amount)} on ${warning.date}`;

    case "NO_MARKET_PRICE":
      return `No market price for ${securityLabel(warning.securityId)}: last transaction price used`;

    case "NO_MARKET_FX":
      return `No market rate for ${warning.currency}: last transaction rate used`;

    default:
      return warning.code;
  }
}
</script>

<template>
  <PageHeader
    title="Portfolio"
    icon="portfolio"
  />

  <div
    v-if="portfolioFile.error.value"
    class="state-message error"
  >
    {{ portfolioFile.error.value }}
  </div>

  <div
    v-else-if="!portfolio"
    class="state-message"
  >
    Loading the portfolio…
  </div>

  <main
    v-else
    class="portfolio-view"
  >
    <div class="tabs">
      <SegmentedControl
        v-model="tab"
        :options="tabOptions"
      />
    </div>

    <TransactionsPanel
      v-if="tab === 'transactions'"
      :securities="portfolio.securities"
    />

    <SecuritiesPanel
      v-else-if="tab === 'securities'"
      :portfolio="portfolio"
    />

    <div
      v-else-if="isEmpty"
      class="empty-message"
    >
      No transaction yet. Create the securities first, in the Securities tab.
    </div>

    <template v-else>
      <section class="totals">
        <div class="total main">
          <span class="total-label">Total value (CHF)</span>
          <strong>{{ formatAmount(portfolio.totals.valueChf) }}</strong>
        </div>

        <div class="total">
          <span class="total-label">Securities</span>
          <strong>{{ formatAmount(portfolio.totals.securitiesChf) }}</strong>
        </div>

        <div class="total">
          <span class="total-label">Cash</span>
          <strong>{{ formatAmount(portfolio.totals.cashChf) }}</strong>
        </div>

        <div class="total">
          <span class="total-label">Unrealized P&amp;L</span>
          <strong :class="amountClass(portfolio.totals.unrealizedChf)">
            {{ formatAmount(portfolio.totals.unrealizedChf, { showPlus: true }) }}
          </strong>
          <span class="total-detail">
            Price {{ formatAmount(portfolio.totals.priceEffectChf, { showPlus: true }) }}
            · FX {{ formatAmount(portfolio.totals.fxEffectChf, { showPlus: true }) }}
          </span>
        </div>

        <div class="total">
          <span class="total-label">Realized P&amp;L</span>
          <strong :class="amountClass(portfolio.totals.realizedChf)">
            {{ formatAmount(portfolio.totals.realizedChf, { showPlus: true }) }}
          </strong>
        </div>

        <div class="total">
          <span class="total-label">Income</span>
          <strong>{{ formatAmount(portfolio.totals.incomeChf) }}</strong>
        </div>

        <div class="total">
          <span class="total-label">Fees</span>
          <strong>{{ formatAmount(portfolio.totals.feesChf) }}</strong>
        </div>
      </section>

      <ul
        v-if="portfolio.warnings.length"
        class="warnings"
      >
        <li
          v-for="(warning, index) in portfolio.warnings"
          :key="index"
        >
          {{ warningText(warning) }}
        </li>
      </ul>

      <section
        v-if="portfolio.positions.length"
        class="panel"
      >
        <h2>Positions</h2>

        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Security</th>
                <th class="number">Quantity</th>
                <th class="number">Price</th>
                <th class="number">Unrealized P&amp;L</th>
                <th class="number">Value CHF</th>
                <th class="number">Weight</th>
              </tr>
            </thead>

            <tbody
              v-for="position in portfolio.positions"
              :key="position.securityId"
            >
              <tr>
                <td>
                  <span class="name">{{ securityLabel(position.securityId) }}</span>
                  <span
                    v-if="position.byCustodian.length === 1"
                    class="secondary"
                  >
                    {{ position.byCustodian[0].partyName }}
                  </span>
                </td>
                <td class="number">{{ formatQuantity(position.quantity) }}</td>
                <td class="number">
                  {{ currencyOf(position) }} {{ formatQuote(position.price) }}
                  <span
                    class="secondary"
                    :title="position.priceSource === 'transaction' ? 'Last transaction price' : 'Last market price'"
                  >
                    {{ position.priceDate }}{{ position.priceSource === "transaction" ? " · trade" : "" }}
                  </span>
                </td>
                <td
                  class="number"
                  :class="amountClass(position.unrealizedCcy)"
                >
                  {{ currencyOf(position) }}
                  {{ formatAmount(position.unrealizedCcy, { showPlus: true }) }}
                </td>
                <td class="number">{{ formatAmount(position.valueChf) }}</td>
                <td class="number">{{ formatWeight(position.weight) }}</td>
              </tr>

              <template v-if="position.byCustodian.length > 1">
                <tr
                  v-for="holding in position.byCustodian"
                  :key="holding.partyId"
                  class="custodian-row"
                >
                  <td>{{ holding.partyName }}</td>
                  <td class="number">{{ formatQuantity(holding.quantity) }}</td>
                  <td />
                  <td
                    class="number"
                    :class="amountClass(holding.unrealizedCcy)"
                  >
                    {{ currencyOf(position) }}
                    {{ formatAmount(holding.unrealizedCcy, { showPlus: true }) }}
                  </td>
                  <td class="number">{{ formatAmount(holding.valueChf) }}</td>
                  <td class="number">{{ formatWeight(holding.weight) }}</td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </section>

      <section
        v-if="portfolio.cash.length"
        class="panel"
      >
        <h2>Cash</h2>

        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Custodian</th>
                <th class="number">Amount</th>
                <th class="number">FX rate</th>
                <th class="number">Value CHF</th>
                <th class="number">Weight</th>
              </tr>
            </thead>

            <tbody>
              <tr
                v-for="line in portfolio.cash"
                :key="`${line.partyId}-${line.currency}`"
              >
                <td>{{ line.partyName }}</td>
                <td
                  class="number"
                  :class="{ loss: line.amount < 0 }"
                >
                  {{ line.currency }} {{ formatAmount(line.amount) }}
                </td>
                <td class="number">
                  {{ line.currency === "CHF" ? "" : formatQuote(line.fx) }}
                  <span
                    v-if="line.fxDate"
                    class="secondary"
                  >
                    {{ line.fxDate }}
                  </span>
                </td>
                <td class="number">{{ formatAmount(line.valueChf) }}</td>
                <td class="number">{{ formatWeight(line.weight) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section
        v-if="portfolio.closedPositions.length"
        class="panel"
      >
        <h2>Closed positions</h2>

        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Security</th>
                <th class="number">Realized P&amp;L (CHF)</th>
                <th class="number">Income (CHF)</th>
              </tr>
            </thead>

            <tbody>
              <tr
                v-for="position in portfolio.closedPositions"
                :key="position.securityId"
              >
                <td>{{ securityLabel(position.securityId) }}</td>
                <td
                  class="number"
                  :class="amountClass(position.realizedChf)"
                >
                  {{ formatAmount(position.realizedChf, { showPlus: true }) }}
                </td>
                <td class="number">{{ formatAmount(position.incomeChf) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.portfolio-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  padding: 1rem 1.5rem 2rem;
}

.state-message {
  padding: 2rem 1.5rem;

  color: var(--text-soft);
}

.state-message.error {
  color: var(--negative);
}

.tabs {
  display: flex;
}

.empty-message {
  padding: 1rem 0;

  color: var(--text-soft);
}

/* =========================
   Totals
========================= */

.totals {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.6rem;
}

.total {
  display: flex;
  flex-direction: column;
  gap: 2px;

  padding: 10px 12px;

  border: 1px solid var(--border);
  border-radius: 12px;

  background: var(--surface);

  font-variant-numeric: tabular-nums;
}

.total.main {
  border-color: var(--primary);
  background: var(--primary-soft);
}

.total-label,
.total-detail {
  color: var(--text-soft);
  font-size: var(--font-size-xs);
}

/* =========================
   Warnings
========================= */

.warnings {
  margin: 0;
  padding: 8px 12px 8px 28px;

  border: 1px solid var(--warning);
  border-radius: 8px;

  color: var(--warning);
  font-size: var(--font-size-sm);
}

/* =========================
   Tables
========================= */

.panel {
  min-width: 0;
  padding: 12px 14px;

  border: 1px solid var(--border);
  border-radius: 12px;

  background: var(--surface);
}

.panel h2 {
  margin: 0 0 8px;

  font-size: 1rem;
}

.table-scroll {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;

  font-size: var(--font-size-sm);
}

th,
td {
  padding: 6px 8px;

  border-bottom: 1px solid var(--border);

  text-align: left;
  vertical-align: top;
  white-space: nowrap;
}

th {
  color: var(--text-soft);
  font-weight: 600;
}

.number {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.name {
  font-weight: 600;
}

.secondary {
  display: block;

  color: var(--text-muted);
  font-size: var(--font-size-xs);
  font-weight: 400;
}

.custodian-row td {
  color: var(--text-soft);
  font-size: var(--font-size-xs);
}

.custodian-row td:first-child {
  padding-left: 20px;
}

.gain {
  color: var(--positive);
}

.loss {
  color: var(--negative);
}
</style>
