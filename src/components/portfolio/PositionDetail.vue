<script setup lang="ts">
import {
  computed,
  watch,
} from "vue";

import LineChart, { type LineMarker } from "@/components/charts/LineChart.vue";
import PillButton from "@/components/ui/PillButton.vue";
import SegmentedControl from "@/components/ui/SegmentedControl.vue";

import { useParties } from "@/composables/useParties";
import { usePersistentRef } from "@/composables/usePersistentRef";
import { useRemoteJson } from "@/composables/useRemoteJson";
import { useStorageAccess } from "@/composables/useStorageAccess";

import type { MarketSeries } from "@/contracts/indicators";

import {
  PORTFOLIO_FOLDER,
  PORTFOLIO_TRANSACTIONS_FILE,
  readPortfolioTransactions,
  transactionTypeLabel,
  type Portfolio,
  type PortfolioTransaction,
} from "@/contracts/portfolio";

import {
  formatAmount,
  formatQuantity,
  formatQuote,
  formatTradeValue,
} from "@/utils/amountFormat";

import { addMonths } from "@/utils/dateMath";

/* =========================
   Détail d'une position

   Chiffres publiés par le Mac (portfolio.json), sans aucun
   calcul : effet cours + effet change = P&L latent en CHF,
   P&L réalisé et revenus à part. Fonctionne aussi pour une
   position soldée, qui n'a plus que ces deux derniers.

   Courbe : série du titre dans market-history.json, avec les
   opérations du journal. Entrées et sorties placées à leur
   prix ajusté des splits (adjustedPrice), dividendes et
   splits sur la courbe, à leur date.
========================= */

type RangeKey = "entry" | "1Y" | "3Y" | "5Y" | "max";

const rangeOptions: { value: RangeKey; label: string }[] = [
  { value: "entry", label: "Since entry" },
  { value: "1Y", label: "1Y" },
  { value: "3Y", label: "3Y" },
  { value: "5Y", label: "5Y" },
  { value: "max", label: "Max" },
];

const RANGE_MONTHS: Partial<Record<RangeKey, number>> = {
  "1Y": 12,
  "3Y": 36,
  "5Y": 60,
};

/* Marge avant la première opération (« Since entry »). */
const ENTRY_MARGIN_MONTHS = 1;

const MARKER_KINDS: Partial<Record<string, LineMarker["kind"]>> = {
  OPENING: "entry",
  BUY: "entry",
  SELL: "exit",
  DIVIDEND: "income",
  SPLIT: "split",
};

const props = defineProps<{
  portfolio: Portfolio;
  securityId: number;
  series: MarketSeries[];
  seriesError: string | null;
}>();

const emit = defineEmits<{
  back: [];
}>();

const security =
  computed(() =>
    props.portfolio.securities.find(
      item => item.securityId === props.securityId
    )
  );

const position =
  computed(() =>
    props.portfolio.positions.find(
      item => item.securityId === props.securityId
    ) ?? null
  );

const closedPosition =
  computed(() =>
    props.portfolio.closedPositions.find(
      item => item.securityId === props.securityId
    ) ?? null
  );

const realizedChf =
  computed(() =>
    position.value?.realizedChf ?? closedPosition.value?.realizedChf ?? 0
  );

const incomeChf =
  computed(() =>
    position.value?.incomeChf ?? closedPosition.value?.incomeChf ?? 0
  );

const currency =
  computed(() =>
    security.value?.currency ?? ""
  );

/* =========================
   Opérations du titre
========================= */

const transactionsFile =
  useRemoteJson({
    folder: PORTFOLIO_FOLDER,
    file: PORTFOLIO_TRANSACTIONS_FILE,
    read: readPortfolioTransactions,
  });

const transactions =
  computed(() =>
    (transactionsFile.data.value ?? []).filter(
      transaction => transaction.securityId === props.securityId
    )
  );

const partiesStore =
  useParties();

const { storageReady } =
  useStorageAccess();

watch(
  storageReady,
  ready => {
    if (ready) {
      partiesStore.load().catch(
        err =>
          console.warn(
            "Unable to load parties",
            err
          )
      );
    }
  },
  { immediate: true }
);

function partyLabel(
  partyId: number | null
): string {
  return partyId === null
    ? ""
    : partiesStore.getParty(partyId)?.label ?? `Party ${partyId}`;
}

function custodianText(
  transaction: PortfolioTransaction
): string {
  return transaction.toPartyId === null
    ? partyLabel(transaction.partyId)
    : `${partyLabel(transaction.partyId)} → ${partyLabel(transaction.toPartyId)}`;
}

function quantityText(
  transaction: PortfolioTransaction
): string {
  return transaction.type === "SPLIT"
    ? `${transaction.splitFrom} → ${transaction.splitTo}`
    : formatQuantity(transaction.quantity);
}

/* =========================
   Courbe
========================= */

const range =
  usePersistentRef<RangeKey>("portfolio.detail.range", "entry");

if (!rangeOptions.some(option => option.value === range.value)) {
  range.value = "entry";
}

const priceSeries =
  computed(() =>
    props.series.find(
      series => series.itemId === security.value?.priceIndicatorType
    ) ?? null
  );

const startDate =
  computed(() => {
    const series =
      priceSeries.value;

    if (!series?.dates.length || range.value === "max") {
      return series?.dates[0] ?? "";
    }

    const months =
      RANGE_MONTHS[range.value];

    if (months) {
      return addMonths(series.dates[series.dates.length - 1], -months);
    }

    const first =
      transactions.value.at(-1)?.date;

    return first
      ? addMonths(first, -ENTRY_MARGIN_MONTHS)
      : series.dates[0];
  });

const visiblePoints =
  computed(() => {
    const series =
      priceSeries.value;

    if (!series) {
      return { dates: [] as string[], values: [] as number[] };
    }

    const from =
      series.dates.findIndex(date => date >= startDate.value);

    return from < 0
      ? { dates: [], values: [] }
      : {
          dates: series.dates.slice(from),
          values: series.values.slice(from),
        };
  });

const chartSeries =
  computed(() => [
    {
      label: security.value?.label ?? "",
      color: "var(--chart-series-1)",
      dates: visiblePoints.value.dates,
      values: visiblePoints.value.values,
    },
  ]);

/* Dernier cours connu à une date (dividende, split). */
function priceAt(
  date: string
): number | null {
  const { dates, values } =
    visiblePoints.value;

  let found: number | null = null;

  for (let index = 0; index < dates.length && dates[index] <= date; index++) {
    found = values[index];
  }

  return found ?? values[0] ?? null;
}

const markers =
  computed<LineMarker[]>(() => {
    const result: LineMarker[] = [];

    for (const transaction of transactions.value) {
      const kind =
        MARKER_KINDS[transaction.type];

      if (!kind || transaction.date < startDate.value) {
        continue;
      }

      const value =
        kind === "entry" || kind === "exit"
          ? transaction.adjustedPrice
          : priceAt(transaction.date);

      if (value === null) {
        continue;
      }

      result.push({
        date: transaction.date,
        value,
        kind,
        label:
          `${transactionTypeLabel(transaction.type)} ${quantityText(transaction)}`.trim(),
      });
    }

    return result;
  });

const chartSummary =
  computed(() =>
    `${security.value?.label ?? ""}: closing prices in ${currency.value}, ` +
    `${markers.value.length} operations marked`
  );

function amountClass(
  amount: number
): string {
  if (amount > 0) {
    return "gain";
  }

  return amount < 0 ? "loss" : "";
}

function formatWeight(
  weight: number
): string {
  return `${(weight * 100).toFixed(1)} %`;
}
</script>

<template>
  <section class="position-detail">
    <header class="detail-header">
      <PillButton @click="emit('back')">
        ‹ Positions
      </PillButton>

      <h2>{{ security?.label }}</h2>

      <span class="identity">
        {{ currency }}<template v-if="security?.isin"> · {{ security.isin }}</template>
      </span>
    </header>

    <div class="figures">
      <template v-if="position">
        <div class="figure pnl">
          <span class="figure-label">Price effect (CHF)</span>
          <strong :class="amountClass(position.priceEffectChf)">
            {{ formatAmount(position.priceEffectChf, { showPlus: true }) }}
          </strong>
        </div>

        <div class="figure pnl">
          <span class="figure-label">FX effect (CHF)</span>
          <strong :class="amountClass(position.fxEffectChf)">
            {{ formatAmount(position.fxEffectChf, { showPlus: true }) }}
          </strong>
        </div>

        <div class="figure pnl total">
          <span class="figure-label">Unrealized P&amp;L (CHF)</span>
          <strong :class="amountClass(position.unrealizedChf)">
            {{ formatAmount(position.unrealizedChf, { showPlus: true }) }}
          </strong>
          <span class="figure-detail">
            {{ currency }} {{ formatAmount(position.unrealizedCcy, { showPlus: true }) }}
          </span>
        </div>
      </template>

      <div class="figure">
        <span class="figure-label">Realized P&amp;L (CHF)</span>
        <strong :class="amountClass(realizedChf)">
          {{ formatAmount(realizedChf, { showPlus: true }) }}
        </strong>
      </div>

      <div class="figure">
        <span class="figure-label">Income (CHF)</span>
        <strong>{{ formatAmount(incomeChf) }}</strong>
      </div>

      <template v-if="position">
        <div class="figure">
          <span class="figure-label">Quantity</span>
          <strong>{{ formatQuantity(position.quantity) }}</strong>
        </div>

        <div class="figure">
          <span class="figure-label">Average cost</span>
          <strong>{{ currency }} {{ formatQuote(position.avgPrice) }}</strong>
          <span class="figure-detail">FX {{ formatTradeValue(position.avgFx) }}</span>
        </div>

        <div class="figure">
          <span class="figure-label">Last price</span>
          <strong>{{ currency }} {{ formatQuote(position.price) }}</strong>
          <span class="figure-detail">
            {{ position.priceDate }}{{ position.priceSource === "transaction" ? " · trade" : "" }}
          </span>
        </div>

        <div class="figure">
          <span class="figure-label">Last FX</span>
          <strong>{{ formatTradeValue(position.fx) }}</strong>
          <span
            v-if="position.fxDate"
            class="figure-detail"
          >
            {{ position.fxDate }}{{ position.fxSource === "transaction" ? " · trade" : "" }}
          </span>
        </div>

        <div class="figure">
          <span class="figure-label">Value (CHF)</span>
          <strong>{{ formatAmount(position.valueChf) }}</strong>
          <span class="figure-detail">{{ formatWeight(position.weight) }} of the portfolio</span>
        </div>
      </template>
    </div>

    <section
      v-if="position && position.byCustodian.length > 1"
      class="panel"
    >
      <h3>By custodian</h3>

      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Custodian</th>
              <th class="number">Quantity</th>
              <th class="number">Avg cost</th>
              <th class="number">Avg FX</th>
              <th class="number">Price effect</th>
              <th class="number">FX effect</th>
              <th class="number">Unrealized</th>
              <th class="number">Value CHF</th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="holding in position.byCustodian"
              :key="holding.partyId"
            >
              <td>{{ holding.partyName }}</td>
              <td class="number">{{ formatQuantity(holding.quantity) }}</td>
              <td class="number">{{ formatQuote(holding.avgPrice) }}</td>
              <td class="number">{{ formatTradeValue(holding.avgFx) }}</td>
              <td
                class="number"
                :class="amountClass(holding.priceEffectChf)"
              >
                {{ formatAmount(holding.priceEffectChf, { showPlus: true }) }}
              </td>
              <td
                class="number"
                :class="amountClass(holding.fxEffectChf)"
              >
                {{ formatAmount(holding.fxEffectChf, { showPlus: true }) }}
              </td>
              <td
                class="number"
                :class="amountClass(holding.unrealizedChf)"
              >
                {{ formatAmount(holding.unrealizedChf, { showPlus: true }) }}
              </td>
              <td class="number">{{ formatAmount(holding.valueChf) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <h3>Price history ({{ currency }})</h3>

        <SegmentedControl
          v-if="priceSeries"
          v-model="range"
          :options="rangeOptions"
        />
      </div>

      <p
        v-if="seriesError"
        class="message error"
      >
        {{ seriesError }}
      </p>

      <p
        v-else-if="security?.priceIndicatorType === null"
        class="message"
      >
        No price series for this security.
      </p>

      <p
        v-else-if="!priceSeries"
        class="message"
      >
        Loading the prices…
      </p>

      <p
        v-else-if="!visiblePoints.dates.length"
        class="message"
      >
        No price for this period.
      </p>

      <template v-else>
        <LineChart
          :series="chartSeries"
          :markers="markers"
          :format-value="formatQuote"
          :summary="chartSummary"
        />

        <div class="legend">
          <span><span class="key entry">▲</span> Entry</span>
          <span><span class="key exit">▼</span> Exit</span>
          <span><span class="key income">●</span> Dividend</span>
          <span><span class="key split">◆</span> Split</span>
        </div>
      </template>
    </section>

    <section class="panel">
      <h3>Transactions</h3>

      <p
        v-if="transactionsFile.error.value"
        class="message error"
      >
        {{ transactionsFile.error.value }}
      </p>

      <p
        v-else-if="!transactions.length"
        class="message"
      >
        {{ transactionsFile.data.value ? "No transaction." : "Loading the transactions…" }}
      </p>

      <div
        v-else
        class="table-scroll"
      >
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Custodian</th>
              <th class="number">Quantity</th>
              <th class="number">Price / gross</th>
              <th class="number">FX rate</th>
              <th class="number">Cash</th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="transaction in transactions"
              :key="transaction.txId"
            >
              <td>{{ transaction.date }}</td>
              <td>{{ transactionTypeLabel(transaction.type) }}</td>
              <td>{{ custodianText(transaction) }}</td>
              <td class="number">{{ quantityText(transaction) }}</td>
              <td class="number">
                {{ formatTradeValue(transaction.price ?? transaction.grossAmount) }}
              </td>
              <td class="number">{{ formatTradeValue(transaction.fxRate) }}</td>
              <td
                class="number"
                :class="amountClass(transaction.cashAmount ?? 0)"
              >
                <template v-if="transaction.cashAmount !== null">
                  {{ transaction.cashCurrency }}
                  {{ formatAmount(transaction.cashAmount, { showPlus: true }) }}
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>

<style scoped>
.position-detail {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.detail-header {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
}

.detail-header h2 {
  margin: 0;

  font-size: var(--font-size-lg);
}

.identity {
  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

.figures {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.6rem;
}

.figure {
  display: flex;
  flex-direction: column;
  gap: 2px;

  padding: 10px 12px;

  border: 1px solid var(--border);
  border-radius: 12px;

  background: var(--surface);

  font-variant-numeric: tabular-nums;
}

.figure.total {
  border-color: var(--primary);
  background: var(--primary-soft);
}

.figure-label,
.figure-detail {
  color: var(--text-soft);
  font-size: var(--font-size-xs);
}

.panel {
  min-width: 0;
  padding: 12px 14px;

  border: 1px solid var(--border);
  border-radius: 12px;

  background: var(--surface);
}

.panel h3 {
  margin: 0 0 8px;

  font-size: 1rem;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;

  margin-bottom: 8px;
}

.panel-header h3 {
  margin: 0;
}

.message {
  margin: 0;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

.message.error {
  color: var(--negative);
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1rem;

  margin-top: 6px;

  color: var(--text-soft);
  font-size: var(--font-size-xs);
}

.key.entry {
  color: var(--positive);
}

.key.exit {
  color: var(--negative);
}

.key.income {
  color: var(--warning);
}

.key.split {
  color: var(--primary);
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

.gain {
  color: var(--positive);
}

.loss {
  color: var(--negative);
}
</style>
