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

import PageHeader from "@/components/PageHeader.vue";
import ChipSelector from "@/components/ChipSelector.vue";
import SegmentedControl from "@/components/ui/SegmentedControl.vue";
import GroupedBarChart from "@/components/charts/GroupedBarChart.vue";

import { useRemoteJson } from "@/composables/useRemoteJson";

import {
  ENTRY_FAMILY_IDS,
  INDICATORS_FILE,
  INDICATORS_FOLDER,
  VEHICLES_FAMILY_ID,
  indicatorValuesFile,
  isMeasuredDuring,
  readIndicatorValues,
  readIndicators,
} from "@/contracts/indicators";

import {
  monthlyValuesByYear,
  quarterValues,
  yearAverage,
} from "@/utils/indicatorHistory";

import { formatMeasure } from "@/utils/amountFormat";

/* =========================
   Historique d'un indicateur

   Six années se terminant à l'année choisie (année en
   cours par défaut), la dernière en couleur d'accent : vue
   mensuelle avec la moyenne mensuelle, ou vue
   trimestrielle. Règles de calcul :
   src/utils/indicatorHistory.ts.

   Adresse : /indicators/history?family=2&item=1
========================= */

const YEAR_COUNT = 6;

type ChartView =
  | "monthly"
  | "quarterly";

const viewOptions: {
  value: ChartView;
  label: string;
}[] = [
  { value: "monthly", label: "By month" },
  { value: "quarterly", label: "By quarter" },
];

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const route =
  useRoute();

const router =
  useRouter();

const currentYear =
  new Date().getFullYear();

function queryNumber(
  value: unknown
): number | null {
  const number =
    Number(value);

  return typeof value === "string" &&
    Number.isInteger(number)
    ? number
    : null;
}

/* =========================
   Selection
========================= */

const familyId =
  ref<number>(
    queryNumber(route.query.family) ??
    VEHICLES_FAMILY_ID
  );

const itemId =
  ref<number | null>(
    queryNumber(route.query.item)
  );

const endYear =
  ref<number>(currentYear);

const view =
  ref<ChartView>("monthly");

watch(
  [familyId, itemId],

  ([family, item]) => {
    router.replace({
      query: {
        family: String(family),
        ...(item === null ? {} : { item: String(item) }),
      },
    });
  }
);

/* =========================
   Data
========================= */

const indicatorsFile =
  useRemoteJson({
    folder: INDICATORS_FOLDER,
    file: INDICATORS_FILE,
    read: readIndicators,
  });

const valuesFile =
  useRemoteJson({
    folder: INDICATORS_FOLDER,
    file: () => indicatorValuesFile(familyId.value),
    read: readIndicatorValues,
  });

const loadError =
  computed(() =>
    indicatorsFile.error.value ??
    valuesFile.error.value
  );

const familyOptions =
  computed(() =>
    (indicatorsFile.data.value?.families ?? [])
      .filter(
        family =>
          ENTRY_FAMILY_IDS.includes(family.familyId)
      )
      .sort((a, b) => a.seq - b.seq)
      .map(
        family => ({
          value: family.familyId,
          label: family.label,
        })
      )
  );

/*
  Indicateurs mesurés pendant au moins une partie des six
  années affichées.
*/
const familyItems =
  computed(() =>
    (indicatorsFile.data.value?.items ?? [])
      .filter(
        item =>
          item.familyId === familyId.value &&
          isMeasuredDuring(
            item,
            `${endYear.value - YEAR_COUNT + 1}-01-01`,
            `${endYear.value}-12-31`
          )
      )
      .sort((a, b) =>
        a.seq - b.seq ||
        a.label.localeCompare(b.label)
      )
  );

const itemOptions =
  computed(() =>
    familyItems.value.map(
      item => ({
        id: item.itemId,
        label: item.label,
      })
    )
  );

/*
  Indicateur absent de la famille (changement de famille,
  adresse ancienne) : le premier de la liste.
*/
watch(
  familyItems,

  items => {
    if (
      items.length &&
      !items.some(item => item.itemId === itemId.value)
    ) {
      itemId.value =
        items[0].itemId;
    }
  },

  {
    immediate: true,
  }
);

const item =
  computed(() =>
    familyItems.value.find(
      candidate => candidate.itemId === itemId.value
    ) ?? null
  );

const itemValues =
  computed(() =>
    (valuesFile.data.value ?? [])
      .filter(value => value.itemId === itemId.value)
      .sort((a, b) => a.date.localeCompare(b.date))
  );

/* =========================
   Period
========================= */

/*
  De l'année en cours à la première mesure de la famille :
  les indicateurs clôturés depuis longtemps restent
  consultables.
*/
const endYearOptions =
  computed(() => {
    const firstDate =
      (valuesFile.data.value ?? []).reduce(
        (min, value) =>
          !min || value.date < min ? value.date : min,
        ""
      );

    const first =
      Number(firstDate.slice(0, 4)) ||
      currentYear;

    const years: number[] = [];

    for (let year = currentYear; year >= first; year--) {
      years.push(year);
    }

    return years;
  });

const years =
  computed(() =>
    Array.from(
      { length: YEAR_COUNT },
      (_, index) => endYear.value - YEAR_COUNT + 1 + index
    )
  );

const series =
  computed(() =>
    years.value.map(
      (year, index) => ({
        label:
          year === currentYear
            ? `${year} (current)`
            : String(year),

        color:
          index === YEAR_COUNT - 1
            ? "var(--chart-year-latest)"
            : `var(--chart-year-${index + 1})`,
      })
    )
  );

/* =========================
   Charts
========================= */

const monthsByYear =
  computed(() =>
    item.value
      ? monthlyValuesByYear(
          item.value,
          itemValues.value,
          years.value
        )
      : new Map<number, (number | null)[]>()
  );

const monthlyGroups =
  computed(() => [
    ...MONTH_LABELS.map(
      (label, month) => ({
        label,
        values: years.value.map(
          year =>
            monthsByYear.value.get(year)?.[month] ?? null
        ),
      })
    ),
    {
      label: "AVG",
      values: years.value.map(
        year =>
          yearAverage(
            monthsByYear.value.get(year) ?? []
          )
      ),
    },
  ]);

/*
  Trimestres de chaque année, puis « AVG » : moyenne des
  trimestres renseignés.
*/
const quartersByYear =
  computed(() =>
    new Map(
      years.value.map(year => [
        year,
        item.value
          ? quarterValues(
              item.value,
              monthsByYear.value.get(year) ?? []
            )
          : [null, null, null, null],
      ])
    )
  );

const quarterGroups =
  computed(() => [
    ...["Q1", "Q2", "Q3", "Q4"].map(
      (label, quarter) => ({
        label,
        values: years.value.map(
          year =>
            quartersByYear.value.get(year)?.[quarter] ?? null
        ),
      })
    ),
    {
      label: "AVG",
      values: years.value.map(
        year =>
          yearAverage(
            quartersByYear.value.get(year) ?? []
          )
      ),
    },
  ]);

const measureLabel =
  computed(() =>
    item.value?.cumulative
      ? "Monthly consumption (difference between readings)"
      : "Monthly value"
  );

const quarterLabel =
  computed(() =>
    item.value?.cumulative
      ? "Quarter total"
      : "Quarter average"
  );

function formatValue(
  value: number
): string {
  return formatMeasure(
    Math.round(value * 10) / 10
  );
}

const vehicleNote =
  computed(() =>
    familyId.value === VEHICLES_FAMILY_ID
      ? "Kilometres driven per month."
      : ""
  );
</script>

<template>
  <PageHeader
    title="Indicator history"
    icon="indicators"
  />

  <div
    v-if="loadError"
    class="state-message error"
  >
    {{ loadError }}
  </div>

  <div
    v-else-if="!indicatorsFile.data.value"
    class="state-message"
  >
    Loading indicators…
  </div>

  <main
    v-else
    class="history-view"
  >
    <!-- Filters -->

    <section class="filters">
      <div class="filter-line">
        <SegmentedControl
          v-model="familyId"
          :options="familyOptions"
        />

        <SegmentedControl
          v-model="view"
          :options="viewOptions"
        />

        <label class="end-year">
          <span>Up to</span>

          <select v-model.number="endYear">
            <option
              v-for="year in endYearOptions"
              :key="year"
              :value="year"
            >
              {{ year === currentYear ? `Current year (${year})` : year }}
            </option>
          </select>
        </label>
      </div>

      <ChipSelector
        v-model="itemId"
        label="Indicator"
        :items="itemOptions"
        :show-all="false"
      />
    </section>

    <!-- Title -->

    <header
      v-if="item"
      class="history-title"
    >
      <h2>{{ item.label }}</h2>

      <p>
        {{ item.description }}
        <template v-if="vehicleNote"> · {{ vehicleNote }}</template>
      </p>
    </header>

    <!-- Charts -->

    <section
      v-if="item"
      class="charts"
    >
      <div
        v-if="view === 'monthly'"
        class="chart-card"
      >
        <h3>{{ measureLabel }}</h3>

        <GroupedBarChart
          :groups="monthlyGroups"
          :series="series"
          :format-value="formatValue"
          :summary="`${item.label}: ${measureLabel}, ${years[0]}–${years[years.length - 1]}`"
        />
      </div>

      <div
        v-else
        class="chart-card"
      >
        <h3>{{ quarterLabel }}</h3>

        <GroupedBarChart
          :groups="quarterGroups"
          :series="series"
          :format-value="formatValue"
          :summary="`${item.label}: ${quarterLabel}, ${years[0]}–${years[years.length - 1]}`"
        />
      </div>
    </section>
  </main>
</template>

<style scoped>
.history-view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;

  padding: 1rem 1.5rem 2rem;
}

.state-message {
  padding: 2rem 1.5rem;

  color: var(--text-soft);
}

.state-message.error {
  color: var(--negative);
}

/* =========================
   Filters
========================= */

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

.end-year {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

.end-year select {
  padding: 4px 8px;

  border: 1px solid var(--input-border);
  border-radius: 8px;

  font-size: var(--font-size-sm);
}

/* =========================
   Title
========================= */

.history-title h2 {
  margin: 0;

  font-size: var(--font-size-xl);
}

.history-title p {
  margin: 4px 0 0;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

/* =========================
   Chart
========================= */

.charts {
  min-width: 0;
}

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
