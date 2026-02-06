<script setup lang="ts">
import { computed } from "vue";

/* =========================
   Types
========================= */
export interface FollowUpBarItem {
  amount: number;
  budget?: number;
}

const props = defineProps<{
  item: FollowUpBarItem;
  scale: { min: number; max: number };
}>();

/* =========================
   Geometry
========================= */

const width = 100; // SVG viewBox width

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
   Bar metrics
========================= */

const bar = computed(() => {
  const amountX = valueToX(props.item.amount);
  const startX = Math.min(zeroX.value, amountX);
  const amountW = Math.abs(amountX - zeroX.value);

  let budgetX: number | null = null;
  let budgetW: number | null = null;

  if (props.item.budget !== undefined) {
    const bx = valueToX(props.item.budget);
    budgetX = Math.min(zeroX.value, bx);
    budgetW = Math.abs(bx - zeroX.value);
  }

  return {
    startX,
    amountW,
    budgetX,
    budgetW,
  };
});
</script>

<template>
  <svg
    class="bar-svg"
    viewBox="0 0 100 20"
    preserveAspectRatio="none"
  >
    <!-- Zero axis -->
    <line
      :x1="zeroX"
      y1="0"
      :x2="zeroX"
      y2="20"
      class="zero-line"
    />

    <!-- Budget -->
    <rect
      v-if="bar.budgetW !== null"
      :x="bar.budgetX!"
      y="8"
      :width="bar.budgetW!"
      height="4"
      class="budget-bar"
    />

    <!-- Actual -->
    <rect
      :x="bar.startX"
      y="3"
      :width="bar.amountW"
      height="14"
      :class="[
        'amount-bar',
        props.item.amount >= 0 ? 'positive' : 'negative',
      ]"
    />
  </svg>
</template>

<style scoped>
.bar-svg {
  width: 100%;
  height: 20px;
}

.zero-line {
  stroke: var(--border);
  stroke-width: 0.5;
}

.amount-bar {
  rx: 4;
}

.amount-bar.positive {
  fill: var(--positive);
}

.amount-bar.negative {
  fill: var(--negative);
}

.budget-bar {
  fill: var(--primary);
  opacity: 0.35;
  rx: 2;
}
</style>