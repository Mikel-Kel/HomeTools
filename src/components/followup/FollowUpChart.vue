<script setup lang="ts">
import { computed } from "vue";

/* =========================
   Types
========================= */

export interface FollowUpItem {
  id: string;
  label: string;
  amount: number;
  budget?: number;
}

const props = defineProps<{
  items: FollowUpItem[];
  scale: { min: number; max: number };
  mode: "category" | "subcategory";
}>();

/* =========================
   Geometry helpers
========================= */

const width = 100; // SVG width (viewBox units)

const zeroX = computed(() => {
  const { min, max } = props.scale;
  if (min >= 0) return 0;
  if (max <= 0) return width;
  return ((0 - min) / (max - min)) * width;
});

function valueToX(v: number): number {
  const { min, max } = props.scale;
  if (max === min) return zeroX.value;
  return ((v - min) / (max - min)) * width;
}

/* =========================
   Visual constants
========================= */

const barHeight =4;
const barGap = 3;
const budgetHeight = 2

/* =========================
   Rows
========================= */

const rows = computed(() =>
  props.items.map((item, index) => {
    const y =
      index * (barHeight + barGap) + barHeight / 2;

    const amountX = valueToX(item.amount);
    const startX = Math.min(zeroX.value, amountX);
    const amountW = Math.abs(amountX - zeroX.value);

    let budgetX: number | undefined ;
    let budgetW: number | undefined ;
    
    if (item.budget !== undefined) {
      const bx = valueToX(item.budget);
      budgetX = Math.min(zeroX.value, bx);
      budgetW = Math.abs(bx - zeroX.value);
    }

    return {
      ...item,
      y,
      startX,
      amountW,
      amountX,
      budgetX,
      budgetW,
    };
  })
);

const svgHeight = computed(
  () =>
    props.items.length *
      (barHeight + barGap) +
    barGap
);
</script>

<template>
  <div class="chart-root">
    <svg
      :viewBox="`0 0 ${width} ${svgHeight}`"
      preserveAspectRatio="none"
    >
      <!-- Zero axis -->
      <line
        :x1="zeroX"
        y1="0"
        :x2="zeroX"
        :y2="svgHeight"
        class="zero-line"
      />

      <!-- Rows -->
      <g v-for="r in rows" :key="r.id">
        <!-- Budget (thin bar) -->
        <rect
          v-if="r.budgetW !== null"
          :x="r.budgetX"
          :y="r.y - budgetHeight / 2"
          :width="r.budgetW"
          :height="budgetHeight"
          class="bar budget"
        />

        <!-- Actual amount -->
        <rect
          :x="r.startX"
          :y="r.y - barHeight / 2"
          :width="r.amountW"
          :height="barHeight"
          :class="[
            'bar',
            r.amount >= 0 ? 'positive' : 'negative',
          ]"
        />
      </g>
    </svg>

    <!-- Labels -->
    <div class="labels">
      <div
        v-for="r in rows"
        :key="r.id"
        class="label-row"
      >
        <span class="label-text">
          {{ r.label }}
        </span>
        <span
          class="label-value"
          :class="r.amount >= 0 ? 'positive' : 'negative'"
        >
          {{ r.amount.toLocaleString() }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chart-root {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.75rem;
}

/* =========================
   SVG
========================= */

svg {
  width: 100%;
  height: auto;
}

/* Zero axis */
.zero-line {
  stroke: var(--border);
  stroke-width: 0.3;
  stroke-width: 0.5;
}

/* Bars */
.bar {
  rx: 3;
}

.bar.positive {
  fill: var(--positive);
}

.bar.negative {
  fill: var(--negative);
}

.bar.budget {
  fill: var(--primary);
  opacity: 0.25;
}

/* =========================
   Labels
========================= */

.labels {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.label-row {
  height: 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
  white-space: nowrap;
}

.label-text {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.label-value {
  font-weight: 600;
  margin-left: 0.5rem;
}

.label-value.positive {
  color: var(--positive);
}

.label-value.negative {
  color: var(--negative);
}
</style>