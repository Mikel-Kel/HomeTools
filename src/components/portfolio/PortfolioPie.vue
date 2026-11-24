<script setup lang="ts">
import {
  computed,
  ref,
} from "vue";

import type { Portfolio } from "@/contracts/portfolio";

import { formatInteger } from "@/utils/amountFormat";

/* =========================
   Répartition du portefeuille

   Anneau des valeurs en CHF publiées par le Mac : les
   liquidités d'abord, puis une tranche par position (les cinq
   plus grandes, le reste regroupé à la fin dans « Other
   securities »), dans l'ordre des types de titres (sortOrder
   publié), puis par valeur décroissante dans un même type. Couleurs dans
   l'ordre des séries du thème, attribuées par titre (ordre des
   identifiants), pour qu'une tranche garde sa couleur quand les
   valeurs changent. Liquidités et regroupement en gris.

   Liquidités négatives : pas de tranche, ligne de légende
   seule. La part affichée est le poids publié.

   Survol d'une tranche ou de la légende : part et montant
   au centre (sinon la valeur totale), en francs entiers. Clic sur un titre :
   son détail.
========================= */

const MAX_SLICES = 5;

const SERIES_COLORS = [
  "var(--chart-series-1)",
  "var(--chart-series-2)",
  "var(--chart-series-3)",
  "var(--chart-series-4)",
  "var(--chart-series-5)",
];

const NEUTRAL_COLOR = "var(--text-muted)";

const OTHER_COLOR = "var(--border-strong)";

const RADIUS = 70;
const INNER_RADIUS = 48;
const CENTER = 80;

interface PieItem {
  key: string;
  label: string;
  valueChf: number;
  weight: number;
  color: string;
  securityId: number | null;
}

interface PieSlice extends PieItem {
  path: string;
  full: boolean;
}

const props = defineProps<{
  portfolio: Portfolio;
}>();

const emit = defineEmits<{
  select: [securityId: number];
}>();

const hoveredKey =
  ref<string | null>(null);

const items =
  computed<PieItem[]>(() => {
    const portfolio =
      props.portfolio;

    const labels =
      new Map(
        portfolio.securities
          .map(security => [security.securityId, security.label])
      );

    /* Rang du type d'un titre : ordre publié, titres sans type à la fin. */
    const typeRanks =
      new Map(
        portfolio.securityTypes
          .map((type, index) => [type.securityTypeId, index])
      );

    const typeRank =
      new Map(
        portfolio.securities
          .map(security => [
            security.securityId,
            typeRanks.get(security.securityTypeId ?? -1) ?? typeRanks.size,
          ])
      );

    const byValue =
      [...portfolio.positions]
        .sort((a, b) => b.valueChf - a.valueChf);

    const shown =
      byValue
        .slice(0, MAX_SLICES)
        .sort(
          (a, b) =>
            (typeRank.get(a.securityId) ?? typeRanks.size) -
              (typeRank.get(b.securityId) ?? typeRanks.size) ||
            b.valueChf - a.valueChf
        );

    const colorOrder =
      shown
        .map(position => position.securityId)
        .sort((a, b) => a - b);

    const result: PieItem[] = [];

    if (portfolio.cash.length) {
      result.push({
        key: "CASH",
        label: "Cash",
        valueChf: portfolio.totals.cashChf,
        weight: portfolio.cash.reduce((sum, line) => sum + line.weight, 0),
        color: NEUTRAL_COLOR,
        securityId: null,
      });
    }

    result.push(
      ...shown.map(position => ({
        key: `S${position.securityId}`,
        label: labels.get(position.securityId) ?? `Security ${position.securityId}`,
        valueChf: position.valueChf,
        weight: position.weight,
        color: SERIES_COLORS[colorOrder.indexOf(position.securityId)],
        securityId: position.securityId,
      }))
    );

    const others =
      byValue.slice(MAX_SLICES);

    if (others.length) {
      result.push({
        key: "OTHER",
        label: `Other securities (${others.length})`,
        valueChf: others.reduce((sum, position) => sum + position.valueChf, 0),
        weight: others.reduce((sum, position) => sum + position.weight, 0),
        color: OTHER_COLOR,
        securityId: null,
      });
    }

    return result;
  });

function point(
  angle: number,
  radius: number
): string {
  const x =
    CENTER + radius * Math.sin(angle);

  const y =
    CENTER - radius * Math.cos(angle);

  return `${x.toFixed(2)} ${y.toFixed(2)}`;
}

const slices =
  computed<PieSlice[]>(() => {
    const positive =
      items.value.filter(item => item.valueChf > 0);

    const total =
      positive.reduce((sum, item) => sum + item.valueChf, 0);

    if (total <= 0) {
      return [];
    }

    let start = 0;

    return positive.map(item => {
      const end =
        start + (item.valueChf / total) * 2 * Math.PI;

      const large =
        end - start > Math.PI ? 1 : 0;

      const path = [
        `M ${point(start, RADIUS)}`,
        `A ${RADIUS} ${RADIUS} 0 ${large} 1 ${point(end, RADIUS)}`,
        `L ${point(end, INNER_RADIUS)}`,
        `A ${INNER_RADIUS} ${INNER_RADIUS} 0 ${large} 0 ${point(start, INNER_RADIUS)}`,
        "Z",
      ].join(" ");

      start = end;

      return {
        ...item,
        path,
        full: positive.length === 1,
      };
    });
  });

const hovered =
  computed(() =>
    items.value.find(item => item.key === hoveredKey.value) ?? null
  );

function formatWeight(
  weight: number
): string {
  return `${(weight * 100).toFixed(1)} %`;
}

function choose(
  item: PieItem
): void {
  if (item.securityId !== null) {
    emit("select", item.securityId);
  }
}
</script>

<template>
  <div class="portfolio-pie">
    <svg
      class="pie"
      viewBox="0 0 160 160"
      role="img"
      aria-label="Portfolio allocation"
    >
      <template
        v-for="slice in slices"
        :key="slice.key"
      >
        <circle
          v-if="slice.full"
          class="slice"
          :class="{ dimmed: hoveredKey && hoveredKey !== slice.key, clickable: slice.securityId !== null }"
          :cx="CENTER"
          :cy="CENTER"
          :r="(RADIUS + INNER_RADIUS) / 2"
          fill="none"
          :stroke="slice.color"
          :stroke-width="RADIUS - INNER_RADIUS"
          @mouseenter="hoveredKey = slice.key"
          @mouseleave="hoveredKey = null"
          @click="choose(slice)"
        />

        <path
          v-else
          class="slice"
          :class="{ dimmed: hoveredKey && hoveredKey !== slice.key, clickable: slice.securityId !== null }"
          :d="slice.path"
          :fill="slice.color"
          @mouseenter="hoveredKey = slice.key"
          @mouseleave="hoveredKey = null"
          @click="choose(slice)"
        />
      </template>

      <text
        class="center-label"
        :x="CENTER"
        :y="CENTER - 6"
      >
        {{ hovered ? formatWeight(hovered.weight) : "Total CHF" }}
      </text>

      <text
        class="center-value"
        :x="CENTER"
        :y="CENTER + 12"
      >
        {{ formatInteger(hovered ? hovered.valueChf : portfolio.totals.valueChf) }}
      </text>
    </svg>

    <ul class="legend">
      <li
        v-for="item in items"
        :key="item.key"
        :class="{ active: hoveredKey === item.key, clickable: item.securityId !== null }"
        @mouseenter="hoveredKey = item.key"
        @mouseleave="hoveredKey = null"
        @click="choose(item)"
      >
        <span
          class="swatch"
          :style="{ background: item.valueChf > 0 ? item.color : 'transparent' }"
        />
        <span class="legend-label">{{ item.label }}</span>
        <span
          class="legend-weight"
          :class="{ loss: item.valueChf < 0 }"
        >
          {{ formatWeight(item.weight) }}
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.portfolio-pie {
  display: flex;
  align-items: center;
  gap: 1rem;

  min-width: 0;
}

.pie {
  flex: 0 0 auto;

  width: 150px;
  height: 150px;
}

.slice {
  stroke: var(--surface);
  stroke-width: 2px;

  transition: opacity 0.15s;
}

circle.slice {
  stroke-width: 22px;
}

.slice.dimmed {
  opacity: 0.35;
}

.clickable {
  cursor: pointer;
}

.center-label,
.center-value {
  text-anchor: middle;
  font-variant-numeric: tabular-nums;
}

.center-label {
  fill: var(--text-soft);
  font-size: 10px;
}

.center-value {
  fill: var(--text);
  font-size: 14px;
  font-weight: 600;
}

.legend {
  display: flex;
  flex-direction: column;
  gap: 2px;

  min-width: 0;
  margin: 0;
  padding: 0;

  list-style: none;

  font-size: var(--font-size-sm);
}

.legend li {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;

  padding: 2px 6px;

  border-radius: 6px;
}

.legend li.active {
  background: var(--primary-soft);
}

.swatch {
  width: 10px;
  height: 10px;

  border: 1px solid var(--border);
  border-radius: 3px;
}

.legend-label {
  overflow: hidden;

  text-overflow: ellipsis;
  white-space: nowrap;
}

.legend-weight {
  color: var(--text-soft);
  font-variant-numeric: tabular-nums;
}

.legend-weight.loss {
  color: var(--negative);
}
</style>
