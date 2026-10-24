<script setup lang="ts">
/* =========================
   Pastille de statut

   Texte court non cliquable (statut, compteur, mention).
   Le ton reprend les tokens du thème (clair / sombre) ;
   dashed : mention secondaire, contour en pointillés.
========================= */

export type StatusTone =
  | "neutral"
  | "primary"
  | "positive"
  | "warning"
  | "negative";

withDefaults(
  defineProps<{
    tone?: StatusTone;
    dashed?: boolean;
  }>(),
  {
    tone: "neutral",
    dashed: false,
  }
);
</script>

<template>
  <span
    class="status-pill"
    :class="[
      tone,
      { dashed }
    ]"
  >
    <slot />
  </span>
</template>

<style scoped>
.status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;

  padding: 2px 10px;

  border-radius: 999px;
  border: 1px solid var(--border);

  background: var(--bg-soft);
  color: var(--text-soft);

  font-size: var(--font-size-xs);
  font-weight: 600;
  white-space: nowrap;
}

.status-pill.dashed {
  border-style: dashed;
}

.status-pill.primary {
  border-color: var(--primary);
  background: var(--primary-soft);
  color: var(--primary);
}

.status-pill.positive {
  border-color: var(--positive);
  background: color-mix(in srgb, var(--positive) 15%, transparent);
  color: var(--positive);
}

.status-pill.warning {
  border-color: var(--warning);
  background: color-mix(in srgb, var(--warning) 15%, transparent);
  color: var(--warning);
}

.status-pill.negative {
  border-color: var(--negative);
  background: color-mix(in srgb, var(--negative) 15%, transparent);
  color: var(--negative);
}
</style>
