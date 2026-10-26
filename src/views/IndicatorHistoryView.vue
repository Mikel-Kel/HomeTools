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
  type IndicatorItem,
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
  sumMonthlyValues,
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

   Seuls les tags de regroupement (groupTag) sont présentés :
   un tag réunit un ou plusieurs indicateurs, additionnés
   (par exemple les compteurs électriques successifs). Un
   indicateur sans tag n'apparaît pas.

   Adresse : /indicators/history?family=2&group=Electricité
========================= */

const YEAR_COUNT = 6;

/*
  Groupe présenté : indicateurs de même groupTag.
*/
interface HistoryGroup {
  tag: string;
  description: string;
  cumulative: boolean;
  seq: number;
  members: IndicatorItem[];
}

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

const groupTag =
  ref<string | null>(
    typeof route.query.group === "string" &&
    route.query.group
      ? route.query.group
      : null
  );

const endYear =
  ref<number>(currentYear);

const view =
  ref<ChartView>("monthly");

watch(
  [familyId, groupTag],

  ([family, tag]) => {
    router.replace({
      query: {
        family: String(family),
        ...(tag === null ? {} : { group: tag }),
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

/*
  Un groupe par groupTag, dans l'ordre d'affichage du
  premier de ses indicateurs.
*/
const groups =
  computed<HistoryGroup[]>(() => {
    const byTag =
      new Map<string, HistoryGroup>();

    for (const item of familyItems.value) {
      if (!item.groupTag) {
        continue;
      }

      let group =
        byTag.get(item.groupTag);

      if (!group) {
        group = {
          tag: item.groupTag,
          description: "",
          cumulative: item.cumulative,
          seq: item.seq,
          members: [],
        };

        byTag.set(item.groupTag, group);
      }

      group.members.push(item);
      group.seq = Math.min(group.seq, item.seq);
    }

    for (const group of byTag.values()) {
      group.description =
        group.members.length === 1
          ? group.members[0].description
          : `Sum of ${group.members.map(member => member.label).join(", ")}`;
    }

    return [...byTag.values()].sort((a, b) =>
      a.seq - b.seq ||
      a.tag.localeCompare(b.tag)
    );
  });

const groupOptions =
  computed(() =>
    groups.value.map(
      group => ({
        id: group.tag,
        label: group.tag,
      })
    )
  );

/*
  Groupe absent de la famille ou de la période
  (changement de famille, adresse ancienne) : le premier
  de la liste.
*/
watch(
  groups,

  list => {
    if (
      list.length &&
      !list.some(group => group.tag === groupTag.value)
    ) {
      groupTag.value =
        list[0].tag;
    }
  },

  {
    immediate: true,
  }
);

const group =
  computed(() =>
    groups.value.find(
      candidate => candidate.tag === groupTag.value
    ) ?? null
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

/*
  Valeurs mensuelles de chaque indicateur de la sélection,
  additionnées (un seul indicateur hors groupe).
*/
const monthsByYear =
  computed(() => {
    const values =
      valuesFile.data.value ?? [];

    return sumMonthlyValues(
      (group.value?.members ?? []).map(
        member =>
          monthlyValuesByYear(
            member,
            values
              .filter(value => value.itemId === member.itemId)
              .sort((a, b) => a.date.localeCompare(b.date)),
            years.value
          )
      ),
      years.value
    );
  });

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
        group.value
          ? quarterValues(
              group.value,
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
    group.value?.cumulative
      ? "Monthly consumption (difference between readings)"
      : "Monthly value"
  );

const quarterLabel =
  computed(() =>
    group.value?.cumulative
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
        v-model="groupTag"
        label="Indicator"
        :items="groupOptions"
        :show-all="false"
      />
    </section>

    <p
      v-if="!groups.length"
      class="state-message"
    >
      No grouping tag in this family for these years.
    </p>

    <!-- Title -->

    <header
      v-if="group"
      class="history-title"
    >
      <h2>{{ group.tag }}</h2>

      <p>
        {{ group.description }}
        <template v-if="vehicleNote"> · {{ vehicleNote }}</template>
      </p>
    </header>

    <!-- Charts -->

    <section
      v-if="group"
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
          :summary="`${group.tag}: ${measureLabel}, ${years[0]}–${years[years.length - 1]}`"
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
          :summary="`${group.tag}: ${quarterLabel}, ${years[0]}–${years[years.length - 1]}`"
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
