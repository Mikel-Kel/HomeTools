<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from "vue";

import {
  useRoute,
  useRouter,
} from "vue-router";

import ChipSelector from "@/components/ChipSelector.vue";
import SegmentedControl from "@/components/ui/SegmentedControl.vue";
import LineChart from "@/components/charts/LineChart.vue";

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

import { addMonths } from "@/utils/dateMath";
import { formatDate } from "@/utils/dateFormat";

/* =========================
   Historique des cours (famille Market data)

   Courbes quotidiennes de indicators/market-history.json,
   par groupe (Indices, FX, Funds). Une série : en valeur
   ou en variation ; plusieurs : toujours en variation (%)
   depuis le début de la période, pour les comparer sur un
   seul axe. Une vignette par série : dernier cours,
   variation du jour et de la période, plus haut et plus
   bas de la période.

   Adresse : /indicators/history?family=5&group=Indices&series=1,2
========================= */

type RangeKey =
  | "1M" | "3M" | "6M" | "YTD"
  | "1Y" | "3Y" | "5Y" | "MAX";

type DisplayMode =
  | "value"
  | "change";

const RANGE_MONTHS: Partial<Record<RangeKey, number>> = {
  "1M": 1,
  "3M": 3,
  "6M": 6,
  "1Y": 12,
  "3Y": 36,
  "5Y": 60,
};

const rangeOptions: {
  value: RangeKey;
  label: string;
}[] = (
  ["1M", "3M", "6M", "YTD", "1Y", "3Y", "5Y", "MAX"] as RangeKey[]
).map(
  value => ({
    value,
    label: value === "MAX" ? "Max" : value,
  })
);

const route =
  useRoute();

const router =
  useRouter();

/* =========================
   Data
========================= */

const marketFile =
  useRemoteJson({
    folder: INDICATORS_FOLDER,
    file: MARKET_HISTORY_FILE,
    read: readMarketHistory,
  });

const allSeries =
  computed(() =>
    [...(marketFile.data.value ?? [])].sort((a, b) =>
      a.seq - b.seq ||
      a.label.localeCompare(b.label)
    )
  );

/* =========================
   Selection
========================= */

const group =
  ref<string | null>(
    typeof route.query.group === "string"
      ? route.query.group
      : null
  );

const selectedIds =
  ref<number[]>(
    typeof route.query.series === "string"
      ? route.query.series
          .split(",")
          .map(Number)
          .filter(Number.isInteger)
      : []
  );

const range =
  ref<RangeKey>("1Y");

const mode =
  ref<DisplayMode>("value");

watch(
  [group, selectedIds],

  ([currentGroup, ids]) => {
    router.replace({
      query: {
        family: String(MARKET_FAMILY_ID),
        ...(currentGroup ? { group: currentGroup } : {}),
        ...(ids.length ? { series: ids.join(",") } : {}),
      },
    });
  }
);

const groups =
  computed(() =>
    [...new Set(allSeries.value.map(series => series.group))]
  );

const groupOptions =
  computed(() =>
    groups.value.map(
      name => ({
        id: name,
        label: name,
      })
    )
  );

const groupSeries =
  computed(() =>
    allSeries.value.filter(
      series => series.group === group.value
    )
  );

const seriesOptions =
  computed(() =>
    groupSeries.value.map(
      series => ({
        id: series.itemId,
        label: series.label,
      })
    )
  );

/*
  Groupe absent (premier affichage, adresse ancienne) : le
  premier ; séries hors du groupe retirées ; aucune série :
  la première du groupe.
*/
watch(
  [groups, group],

  () => {
    if (
      groups.value.length &&
      !groups.value.includes(group.value ?? "")
    ) {
      group.value =
        groups.value[0];
    }
  },

  {
    immediate: true,
  }
);

watch(
  [groupSeries, selectedIds],

  () => {
    const ids =
      selectedIds.value.filter(id =>
        groupSeries.value.some(series => series.itemId === id)
      );

    if (!ids.length && groupSeries.value.length) {
      ids.push(groupSeries.value[0].itemId);
    }

    if (ids.join(",") !== selectedIds.value.join(",")) {
      selectedIds.value = ids;
    }
  },

  {
    immediate: true,
  }
);

const selectedSeries =
  computed(() =>
    groupSeries.value.filter(series =>
      selectedIds.value.includes(series.itemId)
    )
  );

/*
  Plusieurs séries : toujours en variation (un seul axe).
*/
const effectiveMode =
  computed<DisplayMode>(() =>
    selectedSeries.value.length > 1
      ? "change"
      : mode.value
  );

const modeOptions =
  computed(() => [
    {
      value: "value" as DisplayMode,
      label: "Value",
      disabled: selectedSeries.value.length > 1,
    },
    {
      value: "change" as DisplayMode,
      label: "% change",
    },
  ]);

/* =========================
   Period
========================= */

const endDate =
  computed(() =>
    selectedSeries.value.reduce(
      (max, series) =>
        series.last > max ? series.last : max,
      ""
    )
  );

const startDate =
  computed(() => {
    if (!endDate.value) {
      return "";
    }

    if (range.value === "YTD") {
      return `${endDate.value.slice(0, 4)}-01-01`;
    }

    const months =
      RANGE_MONTHS[range.value];

    if (months === undefined) {
      return selectedSeries.value.reduce(
        (min, series) =>
          !min || series.first < min ? series.first : min,
        ""
      );
    }

    return addMonths(endDate.value, -months);
  });

interface PeriodSeries {
  series: MarketSeries;
  dates: string[];
  values: number[];
}

const periodSeries =
  computed<PeriodSeries[]>(() =>
    selectedSeries.value.map(series => {
      const start =
        series.dates.findIndex(
          date => date >= startDate.value
        );

      const from =
        start < 0 ? series.dates.length : start;

      return {
        series,
        dates: series.dates.slice(from),
        values: series.values.slice(from),
      };
    })
  );

/* =========================
   Chart
========================= */

/*
  La couleur suit la série (sa place dans le groupe), pas
  son rang dans la sélection.
*/
function colorOf(
  series: MarketSeries
): string {
  const position =
    groupSeries.value.indexOf(series);

  return `var(--chart-series-${(position % 6) + 1})`;
}

const chartSeries =
  computed(() =>
    periodSeries.value.map(
      ({ series, dates, values }) => {
        const base =
          values[0];

        return {
          label: series.label,
          color: colorOf(series),
          dates,

          values:
            effectiveMode.value === "change" && base
              ? values.map(value => (value / base - 1) * 100)
              : values,
        };
      }
    )
  );

function formatChartValue(
  value: number
): string {
  return effectiveMode.value === "change"
    ? formatPercent(value)
    : formatQuote(value);
}

const chartSummary =
  computed(() =>
    `${selectedSeries.value.map(series => series.label).join(", ")}: ` +
    `${effectiveMode.value === "change" ? "% change" : "closing values"}, ` +
    `${formatDate(startDate.value, "short")} – ${formatDate(endDate.value, "short")}`
  );

/* =========================
   Tiles
========================= */

const tiles =
  computed(() =>
    periodSeries.value.map(
      ({ series, values }) => {
        const first =
          values[0];

        const last =
          series.lastValue;

        const dayChange =
          last !== null && series.previousValue
            ? (last / series.previousValue - 1) * 100
            : null;

        return {
          series,
          color: colorOf(series),
          last,
          dayChange,

          periodChange:
            last !== null && first
              ? (last / first - 1) * 100
              : null,

          high: values.length ? Math.max(...values) : null,
          low: values.length ? Math.min(...values) : null,
        };
      }
    )
  );

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

  <div
    v-else
    class="market-history"
  >
    <!-- Filters -->

    <section class="filters">
      <div class="filter-line">
        <SegmentedControl
          v-model="range"
          :options="rangeOptions"
        />

        <SegmentedControl
          :model-value="effectiveMode"
          :options="modeOptions"
          @update:model-value="mode = $event"
        />
      </div>

      <ChipSelector
        v-model="group"
        label="Group"
        :items="groupOptions"
        :show-all="false"
      />

      <ChipSelector
        v-model="selectedIds"
        label="Series"
        :items="seriesOptions"
        :multiple="true"
        :show-all="false"
      />
    </section>

    <!-- Tiles -->

    <section class="tiles">
      <article
        v-for="tile in tiles"
        :key="tile.series.itemId"
        class="tile"
      >
        <header class="tile-header">
          <span
            class="tile-key"
            :style="{ background: tile.color }"
          ></span>

          <span class="tile-label">{{ tile.series.label }}</span>

          <span class="tile-date">
            {{ formatDate(tile.series.last, "short") }}
          </span>
        </header>

        <div class="tile-value">
          {{ formatQuote(tile.last) }}
        </div>

        <dl class="tile-stats">
          <div>
            <dt>Day</dt>
            <dd :class="deltaClass(tile.dayChange)">
              {{ formatPercent(tile.dayChange) }}
            </dd>
          </div>

          <div>
            <dt>{{ range === "MAX" ? "Max" : range }}</dt>
            <dd :class="deltaClass(tile.periodChange)">
              {{ formatPercent(tile.periodChange) }}
            </dd>
          </div>

          <div>
            <dt>High</dt>
            <dd>{{ formatQuote(tile.high) }}</dd>
          </div>

          <div>
            <dt>Low</dt>
            <dd>{{ formatQuote(tile.low) }}</dd>
          </div>
        </dl>
      </article>
    </section>

    <!-- Chart -->

    <section class="chart-card">
      <h3>
        {{
          effectiveMode === "change"
            ? `% change since ${formatDate(startDate, "short")}`
            : `Closing values since ${formatDate(startDate, "short")}`
        }}
      </h3>

      <LineChart
        :series="chartSeries"
        :format-value="formatChartValue"
        :summary="chartSummary"
        :baseline="effectiveMode === 'change' ? 0 : undefined"
      />
    </section>
  </div>
</template>

<style scoped>
.market-history {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.state-message {
  padding: 2rem 0;

  color: var(--text-soft);
}

.state-message.error {
  color: var(--negative);
}

.filters {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.filter-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem 1.5rem;
}

/* =========================
   Tiles
========================= */

.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 0.75rem;
}

.tile {
  padding: 12px 14px;

  border: 1px solid var(--border);
  border-radius: 12px;

  background: var(--surface);
}

.tile-header {
  display: flex;
  align-items: center;
  gap: 8px;

  font-size: var(--font-size-sm);
}

.tile-key {
  width: 14px;
  height: 2px;

  border-radius: 1px;
}

.tile-label {
  font-weight: 700;
}

.tile-date {
  margin-left: auto;

  color: var(--text-muted);
  font-size: var(--font-size-xs);
}

.tile-value {
  margin: 6px 0 8px;

  font-size: var(--font-size-xl);
  font-weight: 600;
}

.tile-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 12px;

  margin: 0;

  font-size: var(--font-size-xs);
  font-variant-numeric: tabular-nums;
}

.tile-stats div {
  display: flex;
  justify-content: space-between;
  gap: 6px;
}

.tile-stats dt {
  color: var(--text-muted);
}

.tile-stats dd {
  margin: 0;

  color: var(--text);
  font-weight: 600;
}

.delta-up {
  color: var(--positive) !important;
}

.delta-down {
  color: var(--negative) !important;
}

/* =========================
   Chart
========================= */

.chart-card {
  min-width: 0;
  padding: 14px 16px;

  border: 1px solid var(--border);
  border-radius: 12px;

  background: var(--surface);
}

.chart-card h3 {
  margin: 0 0 0.5rem;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
  font-weight: 700;
}
</style>
