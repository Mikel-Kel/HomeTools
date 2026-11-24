<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from "vue";

import PageHeader from "@/components/PageHeader.vue";
import PortfolioPie from "@/components/portfolio/PortfolioPie.vue";
import PositionDetail from "@/components/portfolio/PositionDetail.vue";
import SecuritiesPanel from "@/components/portfolio/SecuritiesPanel.vue";
import TransactionsPanel from "@/components/portfolio/TransactionsPanel.vue";
import SegmentedControl from "@/components/ui/SegmentedControl.vue";

import { usePersistentRef } from "@/composables/usePersistentRef";
import { useRemoteJson } from "@/composables/useRemoteJson";

import {
  INDICATORS_FOLDER,
  MARKET_HISTORY_FILE,
  readMarketHistory,
} from "@/contracts/indicators";

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

   En-tête : répartition (PortfolioPie, total au centre), P&L
   latent, puis réalisé, revenus et frais dans un tableau.
   Avertissements, positions consolidées (détail par
   dépositaire quand il y en a plusieurs), liquidités et
   positions soldées. La date du cours est affichée, car les
   titres n'ont pas tous la même dernière date. Un clic sur
   une position ouvre son détail (PositionDetail) ; les cours
   sont chargés à la première ouverture et gardés (fichier
   volumineux).

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

/* =========================
   Position sélectionnée
========================= */

const selectedId =
  usePersistentRef<number | null>("portfolio.selected", null);

/* Sélection retrouvée, mais titre sans position ni solde : liste. */
const detailId =
  computed(() => {
    const id =
      selectedId.value;

    const value =
      portfolio.value;

    return (
      id !== null &&
      value &&
      (
        value.positions.some(item => item.securityId === id) ||
        value.closedPositions.some(item => item.securityId === id)
      )
    )
      ? id
      : null;
  });

const marketNeeded =
  ref(false);

watch(
  detailId,
  id => {
    if (id !== null) {
      marketNeeded.value = true;
    }
  },
  { immediate: true }
);

const marketFile =
  useRemoteJson({
    folder: INDICATORS_FOLDER,
    file: () => marketNeeded.value ? MARKET_HISTORY_FILE : null,
    read: readMarketHistory,
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

/* Effet cours et effet change : barres horizontales de part et
   d'autre de zéro, à l'échelle du plus grand des deux. */
const effectBars =
  computed(() => {
    const totals =
      portfolio.value?.totals;

    const effects = [
      { label: "Price", amount: totals?.priceEffectChf ?? 0 },
      { label: "FX", amount: totals?.fxEffectChf ?? 0 },
    ];

    const scale =
      Math.max(...effects.map(effect => Math.abs(effect.amount)));

    return effects.map(effect => {
      const width =
        scale > 0 ? (Math.abs(effect.amount) / scale) * 50 : 0;

      return {
        ...effect,
        style: {
          width: `${width}%`,
          left: effect.amount < 0 ? `${50 - width}%` : "50%",
        },
      };
    });
  });

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

    <PositionDetail
      v-else-if="detailId !== null"
      :portfolio="portfolio"
      :security-id="detailId"
      :series="marketFile.data.value ?? []"
      :series-error="marketFile.error.value || null"
      @back="selectedId = null"
    />

    <div
      v-else-if="isEmpty"
      class="empty-message"
    >
      No transaction yet. Create the securities first, in the Securities tab.
    </div>

    <template v-else>
      <section class="totals">
        <div class="total allocation">
          <span class="total-label">Allocation</span>
          <PortfolioPie
            :portfolio="portfolio"
            @select="selectedId = $event"
          />
        </div>

        <div class="total">
          <span class="total-label">Unrealized P&amp;L</span>
          <strong :class="amountClass(portfolio.totals.unrealizedChf)">
            {{ formatAmount(portfolio.totals.unrealizedChf, { showPlus: true }) }}
          </strong>
          <div class="effects">
            <template
              v-for="effect in effectBars"
              :key="effect.label"
            >
              <span class="effect-label">{{ effect.label }}</span>
              <span class="effect-track">
                <span
                  class="effect-bar"
                  :class="effect.amount < 0 ? 'negative' : 'positive'"
                  :style="effect.style"
                />
              </span>
              <span
                class="effect-value"
                :class="amountClass(effect.amount)"
              >
                {{ formatAmount(effect.amount, { showPlus: true }) }}
              </span>
            </template>
          </div>
        </div>

        <div class="total">
          <span class="total-label">Since inception (CHF)</span>
          <table class="summary">
            <tbody>
              <tr>
                <th>Realized P&amp;L</th>
                <td
                  class="number"
                  :class="amountClass(portfolio.totals.realizedChf)"
                >
                  {{ formatAmount(portfolio.totals.realizedChf, { showPlus: true }) }}
                </td>
              </tr>
              <tr>
                <th>Income</th>
                <td class="number">{{ formatAmount(portfolio.totals.incomeChf) }}</td>
              </tr>
              <tr>
                <th title="Fee transactions only: fees on buys and sells are in the cost">
                  Other fees
                </th>
                <td class="number">{{ formatAmount(portfolio.totals.feesChf) }}</td>
              </tr>
            </tbody>
          </table>
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
              class="selectable"
              @click="selectedId = position.securityId"
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
                class="selectable"
                @click="selectedId = position.securityId"
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
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 0.6rem;
}

.totals .total {
  flex: 1 1 180px;
}

.totals .total.allocation {
  flex: 2 1 380px;
}

.effects {
  display: grid;
  grid-template-columns: auto minmax(60px, 1fr) auto;
  align-items: center;
  gap: 6px 8px;

  margin-top: 8px;

  font-size: var(--font-size-xs);
}

.effect-label {
  color: var(--text-soft);
}

.effect-track {
  position: relative;

  height: 12px;
}

.effect-track::before {
  content: "";

  position: absolute;
  top: -2px;
  bottom: -2px;
  left: 50%;

  border-left: 1px solid var(--text-muted);
}

.effect-bar {
  position: absolute;
  top: 0;
  bottom: 0;
}

.effect-bar.positive {
  border-radius: 0 4px 4px 0;

  background: var(--positive);
}

.effect-bar.negative {
  border-radius: 4px 0 0 4px;

  background: var(--negative);
}

.effect-value {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.summary {
  margin-top: 2px;
}

.summary th,
.summary td {
  padding: 3px 0;
}

.summary th {
  padding-right: 12px;

  font-weight: 400;
}

.summary tr:last-child th,
.summary tr:last-child td {
  border-bottom: none;
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

.total-label {
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

.selectable {
  cursor: pointer;
}

.selectable:hover {
  background: var(--primary-soft);
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
