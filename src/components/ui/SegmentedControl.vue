<script
  setup
  lang="ts"
  generic="T extends string | number"
>
import ScrollRow from "@/components/ui/ScrollRow.vue";

/* =========================
   Choix segmenté

   Un seul choix actif parmi des options voisines (années,
   période, nature…). Les options défilent avec « ‹ › »
   quand elles dépassent la largeur disponible.
========================= */

interface SegmentOption<V> {
  value: V;
  label: string;
  disabled?: boolean;
}

defineProps<{
  options: SegmentOption<T>[];
}>();

const model =
  defineModel<T>({
    required: true,
  });
</script>

<template>
  <div class="segmented-control">
    <ScrollRow>
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        class="segment"
        :class="{ active: model === option.value }"
        :aria-pressed="model === option.value"
        :disabled="option.disabled"
        @click="model = option.value"
      >
        {{ option.label }}
      </button>
    </ScrollRow>
  </div>
</template>

<style scoped>
.segmented-control {
  display: inline-flex;
  max-width: 100%;
  min-width: 0;

  padding: 2px;

  border: 1px solid var(--border);
  border-radius: 999px;

  background: var(--bg-soft);

  --scroll-row-gap: 2px;
}

.segment {
  flex: none;

  padding: 6px 14px;

  border: 1px solid transparent;
  border-radius: 999px;

  background: transparent;
  color: var(--text-soft);

  font-size: var(--font-size-xs);
  font-weight: 600;
  white-space: nowrap;

  opacity: 0.6;
  cursor: pointer;
  user-select: none;
  transition: all 0.15s ease;
}

.segment:hover:not(:disabled):not(.active) {
  opacity: 0.9;
}

.segment.active {
  border-color: var(--primary);

  background: var(--primary-soft);
  color: var(--primary);

  opacity: 1;
  box-shadow: var(--shadow-sm);
}

.segment:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
</style>
