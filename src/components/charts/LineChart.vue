<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
} from "vue";

import { niceScale } from "@/utils/chartScale";

/* =========================
   Courbes dans le temps (SVG)

   Une courbe de 2 px par série, sur un seul axe. Survol ou
   doigt : une ligne verticale suit la date la plus proche,
   une bulle liste toutes les séries à cette date. Plusieurs
   séries : étiquette au bout de chaque courbe, reliée par
   un trait si les courbes se resserrent. Couleurs : variables
   CSS passées par série (--chart-series-*, theme.css).
========================= */

export interface LineSeries {
  label: string;
  color: string;

  /* Dates ISO croissantes et valeurs, en listes parallèles. */
  dates: string[];
  values: number[];
}

const props = defineProps<{
  series: LineSeries[];
  formatValue: (value: number) => string;

  /* Description lue par les lecteurs d'écran. */
  summary: string;

  /* Ligne de référence (0 % en variation). */
  baseline?: number;

  height?: number;
}>();

const HEIGHT_DEFAULT = 320;
const MARGIN = { top: 12, bottom: 28, left: 64 };
const LABEL_GUTTER = 110;
const LABEL_GAP = 14;

/* =========================
   Taille
========================= */

const containerRef =
  ref<HTMLElement | null>(null);

const width =
  ref(700);

let resizeObserver:
  ResizeObserver | null = null;

onMounted(() => {
  if (!containerRef.value) {
    return;
  }

  resizeObserver =
    new ResizeObserver(
      entries => {
        width.value =
          Math.max(
            320,
            entries[0].contentRect.width
          );
      }
    );

  resizeObserver.observe(
    containerRef.value
  );
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
});

const height =
  computed(() =>
    props.height ?? HEIGHT_DEFAULT
  );

const marginRight =
  computed(() =>
    props.series.length > 1
      ? LABEL_GUTTER
      : 16
  );

const plotLeft = MARGIN.left;

const plotRight =
  computed(() =>
    width.value - marginRight.value
  );

const plotTop = MARGIN.top;

const plotBottom =
  computed(() =>
    height.value - MARGIN.bottom
  );

/* =========================
   Échelles
========================= */

function toTime(
  date: string
): number {
  return Date.parse(`${date}T12:00:00`);
}

const timeDomain =
  computed(() => {
    const times =
      props.series.flatMap(series =>
        series.dates.length
          ? [
              toTime(series.dates[0]),
              toTime(series.dates[series.dates.length - 1]),
            ]
          : []
      );

    const min =
      times.length ? Math.min(...times) : 0;

    const max =
      times.length ? Math.max(...times) : 1;

    return {
      min,
      max: max === min ? min + 1 : max,
    };
  });

const scale =
  computed(() =>
    niceScale(
      [
        ...props.series.flatMap(series => series.values),
        ...(props.baseline === undefined ? [] : [props.baseline]),
      ],
      false
    )
  );

function x(
  time: number
): number {
  const { min, max } =
    timeDomain.value;

  return (
    plotLeft +
    (plotRight.value - plotLeft) *
      (time - min) / (max - min)
  );
}

function y(
  value: number
): number {
  const { min, max } =
    scale.value;

  return (
    plotTop +
    (plotBottom.value - plotTop) *
      (1 - (value - min) / (max - min))
  );
}

/* =========================
   Courbes
========================= */

const paths =
  computed(() =>
    props.series.map(
      series => ({
        label: series.label,
        color: series.color,

        d: series.dates
          .map(
            (date, index) =>
              `${index ? "L" : "M"}${x(toTime(date)).toFixed(1)},` +
              `${y(series.values[index]).toFixed(1)}`
          )
          .join(""),
      })
    )
  );

/*
  Étiquettes au bout des courbes, espacées d'au moins
  LABEL_GAP pixels, dans l'ordre vertical des courbes.
*/
const endLabels =
  computed(() => {
    if (props.series.length < 2) {
      return [];
    }

    const labels =
      props.series
        .filter(series => series.dates.length)
        .map(series => {
          const last =
            series.dates.length - 1;

          const endY =
            y(series.values[last]);

          return {
            label: series.label,
            color: series.color,
            endX: x(toTime(series.dates[last])),
            endY,
            labelY: endY,
          };
        })
        .sort((a, b) => a.endY - b.endY);

    for (let index = 1; index < labels.length; index++) {
      labels[index].labelY =
        Math.max(
          labels[index].labelY,
          labels[index - 1].labelY + LABEL_GAP
        );
    }

    const overflow =
      (labels.at(-1)?.labelY ?? 0) - plotBottom.value;

    if (overflow > 0) {
      for (const label of labels) {
        label.labelY -= overflow;
      }
    }

    return labels;
  });

/* =========================
   Axe du temps

   Pas de graduation en mois choisi pour garder au plus
   huit étiquettes.
========================= */

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const timeTicks =
  computed(() => {
    const { min, max } =
      timeDomain.value;

    const start =
      new Date(min);

    const end =
      new Date(max);

    const months =
      (end.getFullYear() - start.getFullYear()) * 12 +
      end.getMonth() - start.getMonth();

    const step =
      [1, 2, 3, 6, 12, 24, 36].find(
        candidate => months / candidate <= 8
      ) ?? 60;

    const ticks: { time: number; label: string }[] = [];

    const cursor =
      new Date(start.getFullYear(), start.getMonth() + 1, 1);

    while (cursor.getTime() <= max) {
      const monthIndex =
        cursor.getFullYear() * 12 + cursor.getMonth();

      if (monthIndex % step === 0) {
        ticks.push({
          time: cursor.getTime(),

          label:
            step >= 12
              ? String(cursor.getFullYear())
              : `${MONTH_LABELS[cursor.getMonth()]} ${String(cursor.getFullYear()).slice(2)}`,
        });
      }

      cursor.setMonth(cursor.getMonth() + 1);
    }

    return ticks;
  });

/* =========================
   Survol

   La date retenue est celle de la première série la plus
   proche du pointeur ; chaque série donne sa valeur à la
   date la plus proche de celle-ci.
========================= */

const hoverTime =
  ref<number | null>(null);

function nearestIndex(
  dates: string[],
  time: number
): number {
  let low = 0;
  let high = dates.length - 1;

  while (high - low > 1) {
    const middle =
      (low + high) >> 1;

    if (toTime(dates[middle]) < time) {
      low = middle;
    } else {
      high = middle;
    }
  }

  return Math.abs(toTime(dates[low]) - time) <=
    Math.abs(toTime(dates[high]) - time)
    ? low
    : high;
}

function onPointerMove(
  event: PointerEvent
) {
  const svg =
    (event.currentTarget as SVGElement).ownerSVGElement;

  const rect =
    svg?.getBoundingClientRect();

  const reference =
    props.series.find(series => series.dates.length);

  if (!rect || !reference) {
    return;
  }

  const { min, max } =
    timeDomain.value;

  const pointer =
    min +
    (max - min) *
      (event.clientX - rect.left - plotLeft) /
      (plotRight.value - plotLeft);

  hoverTime.value =
    toTime(
      reference.dates[
        nearestIndex(reference.dates, pointer)
      ]
    );
}

const hover =
  computed(() => {
    const time =
      hoverTime.value;

    if (time === null) {
      return null;
    }

    return {
      x: x(time),

      date:
        new Date(time).toLocaleDateString(
          "en-GB",
          { day: "2-digit", month: "short", year: "numeric" }
        ),

      rows:
        props.series
          .filter(series => series.dates.length)
          .map(series => {
            const index =
              nearestIndex(series.dates, time);

            return {
              label: series.label,
              color: series.color,
              value: series.values[index],
              y: y(series.values[index]),
              x: x(toTime(series.dates[index])),
            };
          }),
    };
  });

const tooltipStyle =
  computed(() => {
    if (!hover.value) {
      return {};
    }

    return hover.value.x > width.value / 2
      ? { right: `${width.value - hover.value.x + 12}px` }
      : { left: `${hover.value.x + 12}px` };
  });
</script>

<template>
  <figure
    ref="containerRef"
    class="line-chart"
  >
    <figcaption
      v-if="series.length > 1"
      class="chart-legend"
    >
      <span
        v-for="item in series"
        :key="item.label"
        class="legend-item"
      >
        <span
          class="legend-key"
          :style="{ background: item.color }"
        ></span>

        {{ item.label }}
      </span>
    </figcaption>

    <div class="chart-area">
      <svg
        :width="width"
        :height="height"
        :viewBox="`0 0 ${width} ${height}`"
        role="img"
        :aria-label="summary"
      >
        <!-- Grid -->

        <g class="grid">
          <template
            v-for="tick in scale.ticks"
            :key="tick"
          >
            <line
              :x1="plotLeft"
              :x2="plotRight"
              :y1="y(tick)"
              :y2="y(tick)"
            />

            <text
              :x="plotLeft - 8"
              :y="y(tick)"
              class="tick-label"
              text-anchor="end"
              dominant-baseline="middle"
            >
              {{ formatValue(tick) }}
            </text>
          </template>

          <line
            v-if="baseline !== undefined"
            class="baseline"
            :x1="plotLeft"
            :x2="plotRight"
            :y1="y(baseline)"
            :y2="y(baseline)"
          />

          <text
            v-for="tick in timeTicks"
            :key="tick.time"
            :x="x(tick.time)"
            :y="height - 8"
            class="tick-label"
            text-anchor="middle"
          >
            {{ tick.label }}
          </text>
        </g>

        <!-- Lines -->

        <path
          v-for="path in paths"
          :key="path.label"
          :d="path.d"
          :stroke="path.color"
          class="series-line"
        />

        <!-- End labels -->

        <g
          v-for="label in endLabels"
          :key="label.label"
          class="end-label"
        >
          <line
            :x1="label.endX + 2"
            :y1="label.endY"
            :x2="plotRight + 10"
            :y2="label.labelY"
            class="leader"
          />

          <line
            :x1="plotRight + 12"
            :x2="plotRight + 22"
            :y1="label.labelY"
            :y2="label.labelY"
            :stroke="label.color"
            class="label-key"
          />

          <text
            :x="plotRight + 26"
            :y="label.labelY"
            dominant-baseline="middle"
          >
            {{ label.label }}
          </text>
        </g>

        <!-- Hover -->

        <template v-if="hover">
          <line
            class="crosshair"
            :x1="hover.x"
            :x2="hover.x"
            :y1="plotTop"
            :y2="plotBottom"
          />

          <circle
            v-for="row in hover.rows"
            :key="row.label"
            :cx="row.x"
            :cy="row.y"
            r="4"
            :fill="row.color"
            class="hover-dot"
          />
        </template>

        <rect
          class="hit-area"
          :x="plotLeft"
          :y="plotTop"
          :width="plotRight - plotLeft"
          :height="plotBottom - plotTop"
          @pointermove="onPointerMove"
          @pointerdown="onPointerMove"
          @pointerleave="hoverTime = null"
        />
      </svg>

      <!-- Tooltip -->

      <div
        v-if="hover"
        class="chart-tooltip"
        :style="tooltipStyle"
      >
        <div class="tooltip-title">
          {{ hover.date }}
        </div>

        <div
          v-for="row in hover.rows"
          :key="row.label"
          class="tooltip-row"
        >
          <span
            class="tooltip-key"
            :style="{ background: row.color }"
          ></span>

          <strong>{{ formatValue(row.value) }}</strong>

          <span class="tooltip-series">
            {{ row.label }}
          </span>
        </div>
      </div>
    </div>
  </figure>
</template>

<style scoped>
.line-chart {
  position: relative;

  margin: 0;
  min-width: 0;
}

.chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1rem;

  margin-bottom: 0.5rem;

  color: var(--text-soft);
  font-size: var(--font-size-xs);
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.legend-key {
  width: 14px;
  height: 2px;

  border-radius: 1px;
}

.chart-area {
  position: relative;
}

svg {
  display: block;
  overflow: visible;

  touch-action: pan-y;
}

.grid line {
  stroke: var(--border);
  stroke-width: 1;
}

.grid line.baseline {
  stroke: var(--text-muted);
}

.tick-label {
  fill: var(--text-muted);

  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.series-line {
  fill: none;
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.end-label text {
  fill: var(--text-soft);

  font-size: 11px;
}

.leader {
  stroke: var(--border);
  stroke-width: 1;
}

.label-key {
  stroke-width: 2;
  stroke-linecap: round;
}

.crosshair {
  stroke: var(--text-muted);
  stroke-width: 1;
}

.hover-dot {
  stroke: var(--surface);
  stroke-width: 2;
}

.hit-area {
  fill: transparent;
  cursor: crosshair;
}

.chart-tooltip {
  position: absolute;
  top: 8px;
  z-index: 2;

  min-width: 10rem;
  padding: 8px 10px;

  border: 1px solid var(--border);
  border-radius: 10px;

  background: var(--surface-2);
  box-shadow: var(--shadow-lg);

  font-size: var(--font-size-xs);
  font-variant-numeric: tabular-nums;

  pointer-events: none;
}

.tooltip-title {
  margin-bottom: 4px;

  color: var(--text-soft);
  font-weight: 700;
}

.tooltip-row {
  display: grid;
  grid-template-columns: 12px auto 1fr;
  align-items: center;
  gap: 6px;

  line-height: 1.6;
}

.tooltip-key {
  width: 12px;
  height: 2px;

  border-radius: 1px;
}

.tooltip-row strong {
  color: var(--text);
  text-align: right;
}

.tooltip-series {
  color: var(--text-muted);
}
</style>
