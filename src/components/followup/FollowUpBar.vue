<script setup lang="ts">
import { computed } from "vue";

/* =========================
   Props
========================= */
const props = defineProps<{
  amount: number;
  budget?: number;
  scale: { min: number; max: number };
  spreadLimit?: number; // %
}>();

/* =========================
   Delta (business)
========================= */
const delta = computed(() => {
  if (props.budget === undefined) return 0;
  return props.budget - props.amount;
});

const showLabel = computed(() => {
  if (props.budget === undefined) return false;
  if (props.spreadLimit === undefined) return true;

  return (
    Math.abs(delta.value) / props.budget >
    props.spreadLimit / 100
  );
});

/* =========================
   Geometry (SVG space)
========================= */
const ZERO_X = 50; // % (center)

/* =========================
   Ratio (0..1)
========================= */
const ratio = computed(() => {
  if (!props.scale.max) return 0;
  return Math.min(Math.abs(delta.value) / props.scale.max, 1);
});

/* =========================
   Bar geometry
========================= */
const barSize = computed(() => ratio.value * ZERO_X);

const barX = computed(() =>
  delta.value >= 0
    ? ZERO_X
    : ZERO_X - barSize.value
);

/* =========================
   Neutral zone (relative)
========================= */
const isNeutral = computed(() => {
  if (
    props.budget === undefined ||
    props.budget === 0 ||
    props.spreadLimit === undefined
  ) {
    return false;
  }

  return (
    Math.abs(delta.value) / props.budget <=
    props.spreadLimit / 100
  );
});

/* =========================
   Gradients (CSS-driven)
========================= */
const posStart = computed(() => "var(--delta-pos-soft)");
const posEnd   = computed(() => "var(--delta-pos-strong)");

const negStart = computed(() => "var(--delta-neg-soft)");
const negEnd   = computed(() => "var(--delta-neg-strong)");

/* =========================
   Label (HTML overlay)
========================= */
const label = computed(() => {
  const v = Math.round(delta.value);
  if (v === 0) return "0";

  const abs = Math.abs(v).toLocaleString();
  return v < 0 ? `-${abs}` : abs;
});

/* =========================
   Label positioning
========================= */
const MIN_BAR_FOR_LABEL = 6; // % SVG space

const labelX = computed(() => {
  // barre trop courte → forcer l’autre côté de l’axe
  if (barSize.value < MIN_BAR_FOR_LABEL) {
    return delta.value >= 0
      ? ZERO_X - 2
      : ZERO_X + 2;
  }

  // cas normal : extrémité de la barre
  return delta.value >= 0
    ? ZERO_X + barSize.value
    : ZERO_X - barSize.value;
});

const labelTransform = computed(() => {
  if (barSize.value < MIN_BAR_FOR_LABEL) {
    return delta.value >= 0
      ? "translate(calc(-100% - 6px), -50%)"
      : "translate(6px, -50%)";
  }

  return delta.value >= 0
    ? "translate(6px, -50%)"
    : "translate(calc(-100% - 6px), -50%)";
});
</script>

<template>
  <div class="bar-wrapper">
    <!-- SVG layer -->
    <svg
      class="bar-svg"
      viewBox="0 0 100 20"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="posGradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" :stop-color="posStart" />
          <stop offset="100%" :stop-color="posEnd" />
        </linearGradient>

        <linearGradient id="negGradient" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" :stop-color="negStart" />
          <stop offset="100%" :stop-color="negEnd" />
        </linearGradient>
      </defs>

      <!-- Zero axis -->
      <line
        x1="50"
        y1="0"
        x2="50"
        y2="20"
        class="zero-line"
      />

      <!-- Delta bar -->
      <rect
        v-if="barSize > 0"
        :x="barX"
        y="4"
        :width="barSize"
        height="12"
        :fill="
          isNeutral
            ? 'var(--delta-neutral)'
            : delta >= 0
            ? 'url(#posGradient)'
            : 'url(#negGradient)'
        "
      />
    </svg>

    <!-- HTML overlay label -->
    <div
      v-if="barSize > 0 && showLabel"
      class="delta-label"
      :style="{
        left: labelX + '%',
        transform: labelTransform
      }"
    >
      {{ label }}
    </div>
  </div>
</template>

<style scoped>
.bar-wrapper {
  position: relative;
  width: 100%;
  height: 20px;
}

.bar-svg {
  width: 100%;
  height: 100%;
  display: block;
}

/* zero axis */
.zero-line {
  stroke: var(--border);
  stroke-width: 0.5;
}

/* label */
.delta-label {
  position: absolute;
  top: 50%;

  font-family: inherit;
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--text);

  white-space: nowrap;
  pointer-events: none;
}
</style>