<script setup lang="ts">
import { computed } from "vue";

/* =========================
   Props
========================= */
const props = defineProps<{
  amount: number;
  budget?: number;
  scale: { min: number; max: number };
}>();

/* =========================
   Delta (CORE BUSINESS)
========================= */
const delta = computed(() => {
  if (props.budget === undefined) return 0;
  return props.budget - props.amount;
});

/* =========================
   Geometry
========================= */
// SVG width = 100 → zero always centered
const ZERO_X = 50;

/* =========================
   Bar size (normalized on max |delta|)
========================= */
const barSize = computed(() => {
  if (!props.scale.max) return 0;

  return (
    Math.min(Math.abs(delta.value) / props.scale.max, 1) *
    ZERO_X
  );
});

/* =========================
   Bar position
========================= */
const barX = computed(() => {
  return delta.value >= 0
    ? ZERO_X
    : ZERO_X - barSize.value;
});
</script>

<template>
  <svg
    class="bar-svg"
    viewBox="0 0 100 20"
    preserveAspectRatio="none"
  >
    <!-- Zero reference axis -->
    <line
      x1="50"
      y1="0"
      x2="50"
      y2="20"
      class="zero-line"
    />

    <!-- Delta bar -->
    <rect
      :x="barX"
      y="5"
      :width="barSize"
      height="10"
      :class="[
        'delta-bar',
        delta >= 0 ? 'positive' : 'negative',
      ]"
    />
  </svg>
</template>

<style scoped>
.bar-svg {
  width: 100%;
  height: 20px;
}

/* Zero axis */
.zero-line {
  stroke: var(--border);
  stroke-width: 0.5;
}

/* Delta bar */
.delta-bar {
  rx: 4;
}

/* Positive = budget remaining */
.delta-bar.positive {
  fill: var(--positive);
}

/* Negative = overspend */
.delta-bar.negative {
  fill: var(--negative);
}
</style>