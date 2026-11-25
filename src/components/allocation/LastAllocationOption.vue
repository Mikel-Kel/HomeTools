<script setup lang="ts">
import { computed } from "vue";

import StatusPill from "@/components/ui/StatusPill.vue";

import { useAllocationLabels } from "@/composables/allocations/useAllocationLabels";

import type { LastAllocation } from "@/composables/allocations/useLastAllocation";

/* =========================
   « Same as last »

   Dernière allocation saisie (useLastAllocation), proposée
   sous les suggestions, même présentation : catégorie ›
   sous-catégorie, puis commentaire et tag ; un appui signale
   apply.
========================= */

const props =
  withDefaults(
    defineProps<{
      last: LastAllocation;
      disabled?: boolean;
    }>(),
    {
      disabled: false,
    }
  );

const emit = defineEmits<{
  apply: [last: LastAllocation];
}>();

const {
  categoryLabel,
  subCategoryLabel,
  tagLabel,
} = useAllocationLabels();

const category =
  computed(() =>
    [
      categoryLabel(props.last.categoryID),
      subCategoryLabel(props.last.categoryID, props.last.subCategoryID),
    ]
      .filter(Boolean)
      .join(" › ")
  );

const detail =
  computed(() =>
    [props.last.comment, tagLabel(props.last.allocatedTagID)]
      .filter(Boolean)
      .join(" · ")
  );
</script>

<template>
  <button
    type="button"
    class="last-option"
    :disabled="disabled"
    title="Category, sub-category, tag and comment of the last allocation entered"
    @click="emit('apply', last)"
  >
    <span class="option-text">
      <span class="option-category">{{ category }}</span>

      <span
        v-if="detail"
        class="option-detail"
      >
        {{ detail }}
      </span>
    </span>

    <StatusPill tone="neutral">
      Same as last
    </StatusPill>
  </button>
</template>

<style scoped>
.last-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;

  width: 100%;
  max-width: 640px;
  padding: 6px 10px;

  border: 1px dashed var(--border-strong);
  border-radius: 8px;

  background: var(--surface);
  color: var(--text);

  font: inherit;
  text-align: left;

  cursor: pointer;
}

.last-option:hover:not(:disabled) {
  background: var(--primary-soft);
}

.last-option:disabled {
  cursor: default;
  opacity: 0.6;
}

.option-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.option-category {
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.option-detail {
  color: var(--text-soft);
  font-size: var(--font-size-xs);
  overflow-wrap: anywhere;
}
</style>
