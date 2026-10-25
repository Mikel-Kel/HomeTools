<script setup lang="ts">
import {
  nextTick,
  ref,
  watch,
} from "vue";

import type { MemoTooltipState } from "@/composables/useMemoTooltip";

/* =========================
   Bulle de mémo (voir useMemoTooltip)

   Placée sous l'élément survolé, ramenée dans la fenêtre
   si elle déborde à droite ou en bas.
========================= */

const props = defineProps<{
  tooltip: MemoTooltipState | null;
}>();

const bubbleRef =
  ref<HTMLElement | null>(null);

const position =
  ref({ top: 0, left: 0 });

watch(
  () => props.tooltip,

  async tooltip => {
    if (!tooltip) {
      return;
    }

    position.value = {
      top: tooltip.top,
      left: tooltip.left,
    };

    await nextTick();

    const bubble =
      bubbleRef.value;

    if (!bubble) {
      return;
    }

    const margin = 8;

    const rect =
      bubble.getBoundingClientRect();

    position.value = {
      top:
        rect.bottom > window.innerHeight - margin
          ? Math.max(
              margin,
              tooltip.top - rect.height - 40
            )
          : tooltip.top,

      left:
        Math.max(
          margin,
          Math.min(
            tooltip.left,
            window.innerWidth - rect.width - margin
          )
        ),
    };
  }
);
</script>

<template>
  <Teleport to="body">
    <div
      v-if="tooltip"
      ref="bubbleRef"
      class="memo-tooltip"
      :style="{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }"
    >{{ tooltip.memo }}</div>
  </Teleport>
</template>

<style scoped>
.memo-tooltip {
  position: fixed;
  z-index: 1100;

  max-width: 420px;
  max-height: 60vh;
  overflow: hidden;

  padding: 10px 12px;

  border: 1px solid var(--border);
  border-radius: 10px;

  background: var(--surface-2);
  color: var(--text);
  box-shadow: var(--shadow-lg);

  font-family: ui-monospace, Menlo, monospace;
  font-size: var(--font-size-xs);
  line-height: 1.4;
  white-space: pre-wrap;

  pointer-events: none;
}
</style>
