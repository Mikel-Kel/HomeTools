<script setup lang="ts">
import { computed } from "vue";

import { useRouter } from "vue-router";

import PillButton from "@/components/ui/PillButton.vue";

import { useRemoteJson } from "@/composables/useRemoteJson";

import {
  INDICATORS_FOLDER,
  MARKET_FAMILY_ID,
  MARKET_HISTORY_FILE,
  readMarketHistory,
  type MarketSeries,
} from "@/contracts/indicators";

import {
  formatPercent,
  formatQuote,
} from "@/utils/amountFormat";

import { formatDate } from "@/utils/dateFormat";

/* =========================
   Derniers cours (famille Market data)

   Consultation seule : les cours sont importés par le
   backend (indicators/market-history.json). Une ligne par
   série, groupée (Indices, FX, Funds) ; « Chart » ouvre sa
   courbe dans l'historique.
========================= */

const router =
  useRouter();

const marketFile =
  useRemoteJson({
    folder: INDICATORS_FOLDER,
    file: MARKET_HISTORY_FILE,
    read: readMarketHistory,
  });

const groups =
  computed(() => {
    const byGroup =
      new Map<string, MarketSeries[]>();

    const sorted =
      [...(marketFile.data.value ?? [])].sort((a, b) =>
        a.seq - b.seq ||
        a.label.localeCompare(b.label)
      );

    for (const series of sorted) {
      byGroup.set(
        series.group,
        [...(byGroup.get(series.group) ?? []), series]
      );
    }

    return [...byGroup.entries()].map(
      ([name, series]) => ({ name, series })
    );
  });

function dayChange(
  series: MarketSeries
): number | null {
  return series.lastValue !== null && series.previousValue
    ? (series.lastValue / series.previousValue - 1) * 100
    : null;
}

function deltaClass(
  value: number | null
): string {
  if (value === null || value === 0) {
    return "";
  }

  return value > 0
    ? "delta-up"
    : "delta-down";
}

function openChart(
  series: MarketSeries
) {
  router.push({
    name: "indicatorHistory",
    query: {
      family: String(MARKET_FAMILY_ID),
      group: series.group,
      series: String(series.itemId),
    },
  });
}
</script>

<template>
  <div
    v-if="marketFile.error.value"
    class="state-message error"
  >
    {{ marketFile.error.value }}
  </div>

  <div
    v-else-if="!marketFile.data.value"
    class="state-message"
  >
    Loading market data…
  </div>

  <section
    v-else
    class="table-wrapper"
  >
    <table class="quotes-table">
      <thead>
        <tr>
          <th class="label-cell">Series</th>
          <th>Last</th>
          <th>Date</th>
          <th>Day</th>
          <th></th>
        </tr>
      </thead>

      <tbody
        v-for="group in groups"
        :key="group.name"
      >
        <tr class="group-row">
          <th colspan="5">{{ group.name }}</th>
        </tr>

        <tr
          v-for="series in group.series"
          :key="series.itemId"
        >
          <th class="label-cell">
            {{ series.label }}

            <span class="description">
              {{ series.description }}
            </span>
          </th>

          <td>{{ formatQuote(series.lastValue) }}</td>

          <td>{{ formatDate(series.last, "short") }}</td>

          <td :class="deltaClass(dayChange(series))">
            {{ formatPercent(dayChange(series)) }}
          </td>

          <td class="action-cell">
            <PillButton @click="openChart(series)">
              Chart
            </PillButton>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.state-message {
  padding: 2rem 0;

  color: var(--text-soft);
}

.state-message.error {
  color: var(--negative);
}

.table-wrapper {
  overflow-x: auto;

  border: 1px solid var(--border);
  border-radius: 12px;

  background: var(--surface);
}

.quotes-table {
  width: 100%;
  border-collapse: collapse;

  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
}

.quotes-table th,
.quotes-table td {
  padding: 7px 12px;

  border-bottom: 1px solid var(--border);

  text-align: right;
  white-space: nowrap;
}

.quotes-table thead th {
  background: var(--surface-soft);
  color: var(--text-soft);

  font-size: var(--font-size-xs);
  font-weight: 700;
}

.label-cell {
  width: 100%;

  text-align: left !important;
  font-weight: 600;
}

.description {
  margin-left: 6px;

  color: var(--text-muted);
  font-size: var(--font-size-xs);
  font-weight: 400;
}

.group-row th {
  background: var(--bg-soft);
  color: var(--text);

  text-align: left;
  font-weight: 700;
}

.action-cell {
  padding-top: 4px;
  padding-bottom: 4px;
}

.delta-up {
  color: var(--positive);
}

.delta-down {
  color: var(--negative);
}
</style>
