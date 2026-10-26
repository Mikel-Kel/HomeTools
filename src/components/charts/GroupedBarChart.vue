<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
} from "vue";

import { niceScale } from "@/utils/chartScale";

/* =========================
   Barres groupées (SVG)

   Un groupe par catégorie (mois, trimestre), une barre par
   série (année). Barres fines (≤ 24 px), extrémité arrondie
   côté valeur, carrée sur la ligne de base ; 2 px d'air
   entre barres voisines. Survol ou focus d'un groupe : une
   bulle liste toutes les séries. Couleurs : variables CSS
   passées par série (--chart-year-*, theme.css).
========================= */

export interface ChartSeries {
  label: string;
  color: string;
}

export interface ChartGroup {
  label: string;
  values: (number | null)[];
}

const props = defineProps<{
  groups: ChartGroup[];
  series: ChartSeries[];
  formatValue: (value: number) => string;
  /* Description lue par les lecteurs d'écran. */
  summary: string;
  height?: number;
}>();

const HEIGHT_DEFAULT = 280;
const MARGIN = { top: 12, right: 8, bottom: 28, left: 48 };
const BAR_MAX = 24;
const BAR_GAP = 2;
const CORNER = 4;

/* =========================
   Taille

   Largeur suivie au pixel près : le texte garde sa taille,
   le graphique s'adapte à la place disponible.
========================= */

const containerRef =
  ref<HTMLElement | null>(null);

const width =
  ref(600);

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
            240,
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

const plotWidth =
  computed(() =>
    width.value - MARGIN.left - MARGIN.right
  );

const plotHeight =
  computed(() =>
    height.value - MARGIN.top - MARGIN.bottom
  );

/* =========================
   Échelle

   Graduations propres, zéro toujours inclus (valeurs
   négatives possibles : températures).
========================= */

const scale =
  computed(() =>
    niceScale(
      props.groups
        .flatMap(group => group.values)
        .filter(
          (value): value is number =>
            value !== null
        ),
      true
    )
  );

function y(
  value: number
): number {
  const { min, max } =
    scale.value;

  return (
    MARGIN.top +
    plotHeight.value *
      (1 - (value - min) / (max - min))
  );
}

/* =========================
   Barres
========================= */

const groupWidth =
  computed(() =>
    plotWidth.value /
    Math.max(1, props.groups.length)
  );

const barWidth =
  computed(() => {
    const available =
      groupWidth.value * 0.8 -
      BAR_GAP * (props.series.length - 1);

    return Math.max(
      2,
      Math.min(
        BAR_MAX,
        available / Math.max(1, props.series.length)
      )
    );
  });

/*
  Rectangle arrondi côté valeur seulement : en haut pour
  une valeur positive, en bas pour une valeur négative.
*/
function barPath(
  x: number,
  value: number
): string {
  const base =
    y(0);

  const end =
    y(value);

  const w =
    barWidth.value;

  const length =
    Math.abs(base - end);

  const r =
    Math.min(CORNER, w / 2, length);

  if (value >= 0) {
    return (
      `M${x},${base}` +
      `V${end + r}` +
      `Q${x},${end} ${x + r},${end}` +
      `H${x + w - r}` +
      `Q${x + w},${end} ${x + w},${end + r}` +
      `V${base}Z`
    );
  }

  return (
    `M${x},${base}` +
    `V${end - r}` +
    `Q${x},${end} ${x + r},${end}` +
    `H${x + w - r}` +
    `Q${x + w},${end} ${x + w},${end - r}` +
    `V${base}Z`
  );
}

const bars =
  computed(() => {
    const total =
      props.series.length * barWidth.value +
      (props.series.length - 1) * BAR_GAP;

    return props.groups.flatMap(
      (group, groupIndex) => {
        const start =
          MARGIN.left +
          groupIndex * groupWidth.value +
          (groupWidth.value - total) / 2;

        return group.values.flatMap(
          (value, seriesIndex) =>
            value === null || value === 0
              ? []
              : [{
                  key: `${groupIndex}-${seriesIndex}`,
                  groupIndex,
                  path: barPath(
                    start +
                      seriesIndex * (barWidth.value + BAR_GAP),
                    value
                  ),
                  color: props.series[seriesIndex].color,
                }]
        );
      }
    );
  });

function formatTick(
  value: number
): string {
  return Math.abs(value) >= 1000
    ? `${props.formatValue(value / 1000)}K`
    : props.formatValue(value);
}

/* =========================
   Survol / focus
========================= */

const activeGroup =
  ref<number | null>(null);

const tooltipStyle =
  computed(() => {
    if (activeGroup.value === null) {
      return {};
    }

    const center =
      MARGIN.left +
      (activeGroup.value + 0.5) * groupWidth.value;

    /* Bulle du côté où il reste de la place. */
    return center > width.value / 2
      ? { right: `${width.value - center + 12}px` }
      : { left: `${center + 12}px` };
  });

const showTable =
  ref(false);
</script>

<template>
  <figure
    ref="containerRef"
    class="grouped-bar-chart"
  >
    <!-- Legend -->

    <figcaption class="chart-legend">
      <span
        v-for="item in series"
        :key="item.label"
        class="legend-item"
      >
        <span
          class="legend-swatch"
          :style="{ background: item.color }"
        ></span>

        {{ item.label }}
      </span>

      <button
        type="button"
        class="table-toggle"
        @click="showTable = !showTable"
      >
        {{ showTable ? "Chart" : "Table" }}
      </button>
    </figcaption>

    <!-- Chart -->

    <div
      v-show="!showTable"
      class="chart-area"
    >
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
              :x1="MARGIN.left"
              :x2="width - MARGIN.right"
              :y1="y(tick)"
              :y2="y(tick)"
              :class="{ baseline: tick === 0 }"
            />

            <text
              :x="MARGIN.left - 6"
              :y="y(tick)"
              class="tick-label"
              text-anchor="end"
              dominant-baseline="middle"
            >
              {{ formatTick(tick) }}
            </text>
          </template>
        </g>

        <!-- Hover band -->

        <rect
          v-if="activeGroup !== null"
          class="hover-band"
          :x="MARGIN.left + activeGroup * groupWidth"
          :y="MARGIN.top"
          :width="groupWidth"
          :height="plotHeight"
        />

        <!-- Bars -->

        <path
          v-for="bar in bars"
          :key="bar.key"
          :d="bar.path"
          :fill="bar.color"
          class="bar"
          :class="{ dimmed: activeGroup !== null && activeGroup !== bar.groupIndex }"
        />

        <!-- Group labels and hit areas -->

        <g
          v-for="(group, index) in groups"
          :key="group.label"
        >
          <text
            :x="MARGIN.left + (index + 0.5) * groupWidth"
            :y="height - 8"
            class="group-label"
            text-anchor="middle"
          >
            {{ group.label }}
          </text>

          <rect
            class="hit-area"
            :x="MARGIN.left + index * groupWidth"
            :y="MARGIN.top"
            :width="groupWidth"
            :height="plotHeight + MARGIN.bottom"
            tabindex="0"
            :aria-label="group.label"
            @pointerenter="activeGroup = index"
            @pointerleave="activeGroup = null"
            @focus="activeGroup = index"
            @blur="activeGroup = null"
            @click="activeGroup = index"
          />
        </g>
      </svg>

      <!-- Tooltip -->

      <div
        v-if="activeGroup !== null"
        class="chart-tooltip"
        :style="tooltipStyle"
      >
        <div class="tooltip-title">
          {{ groups[activeGroup].label }}
        </div>

        <div
          v-for="(item, seriesIndex) in series"
          :key="item.label"
          class="tooltip-row"
        >
          <span
            class="tooltip-key"
            :style="{ background: item.color }"
          ></span>

          <strong>
            {{
              groups[activeGroup].values[seriesIndex] === null
                ? "—"
                : formatValue(groups[activeGroup].values[seriesIndex]!)
            }}
          </strong>

          <span class="tooltip-series">
            {{ item.label }}
          </span>
        </div>
      </div>
    </div>

    <!-- Table view -->

    <div
      v-if="showTable"
      class="table-area"
    >
      <table>
        <thead>
          <tr>
            <th></th>

            <th
              v-for="item in series"
              :key="item.label"
            >
              {{ item.label }}
            </th>
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="group in groups"
            :key="group.label"
          >
            <th>{{ group.label }}</th>

            <td
              v-for="(value, index) in group.values"
              :key="index"
            >
              {{ value === null ? "" : formatValue(value) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </figure>
</template>

<style scoped>
.grouped-bar-chart {
  position: relative;

  margin: 0;
  min-width: 0;
}

/* =========================
   Legend
========================= */

.chart-legend {
  display: flex;
  align-items: center;
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

.legend-swatch {
  width: 10px;
  height: 10px;

  border-radius: 2px;
}

.table-toggle {
  margin-left: auto;
  padding: 2px 8px;

  border: 1px solid var(--border);
  border-radius: 999px;

  background: transparent;
  color: var(--text-soft);

  font-size: var(--font-size-xs);
  cursor: pointer;
}

.table-toggle:hover {
  border-color: var(--primary);
  color: var(--primary);
}

/* =========================
   Chart
========================= */

.chart-area {
  position: relative;
}

svg {
  display: block;
  overflow: visible;
}

.grid line {
  stroke: var(--border);
  stroke-width: 1;
}

.grid line.baseline {
  stroke: var(--text-muted);
}

.tick-label,
.group-label {
  fill: var(--text-muted);

  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.hover-band {
  fill: var(--primary-soft);
  opacity: 0.6;
}

.bar {
  transition: opacity 0.15s ease;
}

.bar.dimmed {
  opacity: 0.35;
}

.hit-area {
  fill: transparent;
  cursor: default;
  outline: none;
}

.chart-tooltip {
  position: absolute;
  top: 8px;
  z-index: 2;

  min-width: 9rem;
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

/* =========================
   Table view
========================= */

.table-area {
  overflow-x: auto;
}

.table-area table {
  width: 100%;
  border-collapse: collapse;

  font-size: var(--font-size-xs);
  font-variant-numeric: tabular-nums;
}

.table-area th,
.table-area td {
  padding: 4px 8px;

  border-bottom: 1px solid var(--border);

  text-align: right;
  white-space: nowrap;
}

.table-area thead th {
  color: var(--text-soft);
}

.table-area tbody th {
  color: var(--text-soft);
  text-align: left;
}
</style>
