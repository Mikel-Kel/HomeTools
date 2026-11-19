<script setup lang="ts">
import { useTagTooltip } from "@/composables/archives/useTagTooltip";

/* =========================
   Info-bulle des tags de documents

   Affiche l'état partagé de useTagTooltip.
========================= */

const {
  tooltip,
} = useTagTooltip();
</script>

<template>
  <div
    v-if="tooltip"
    class="tag-tooltip"
    :style="{
      left: tooltip.x + 'px',
      top: tooltip.y + 'px',
    }"
  >
    {{ tooltip.text }}
  </div>
</template>

<style scoped>
.tag-tooltip {
  position: fixed;
  transform: translate(-50%, -100%);
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.75rem;
  white-space: nowrap;
  pointer-events: none;
  z-index: 3000;
  box-shadow: var(--shadow-sm);
}
</style>
