<script setup lang="ts">
import { computed } from "vue"

import PillButton from "@/components/ui/PillButton.vue"
import ScrollRow from "@/components/ui/ScrollRow.vue"

/* =========================
   Props
========================= */
const props = defineProps({
  label: String,

  items: {
    type: Array as () => { id: string | number; label: string }[],
    default: () => []
  },

  modelValue: {
    type: [String, Number, Array, null],
    default: null
  },

  showAll: {
    type: Boolean,
    default: true
  },

  alignWithContent: {
    type: Boolean,
    default: false
  },

  bottomSpacing: {
    type: Number,
    default: 0
  },

  multiple: {
    type: Boolean,
    default: false
  },

  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(["update:modelValue"])

/* =========================
   Selection helpers
========================= */
const selectedSet = computed(() => {
  if (!props.multiple) return new Set()
  return new Set((props.modelValue as (string | number)[] | null) ?? [])
})

function isActive(id: string | number) {
  if (props.multiple) {
    return selectedSet.value.has(id)
  }
  return props.modelValue === id
}

function selectAll() {
  if (props.disabled) return
  emit("update:modelValue", props.multiple ? [] : null)
}

function toggleItem(id: string | number) {
  if (props.disabled) return

  if (!props.multiple) {
    emit("update:modelValue", id)
    return
  }

  const next = new Set(selectedSet.value)

  if (next.has(id)) next.delete(id)
  else next.add(id)

  emit("update:modelValue", Array.from(next))
}

const isAllActive = computed(() => {
  if (props.multiple) {
    return selectedSet.value.size === 0
  }
  return props.modelValue === null
})
</script>

<template>
  <div
    class="chip-selector"
    :class="{
      aligned: alignWithContent,
      disabled: disabled
    }"
    :style="{ marginBottom: bottomSpacing + 'px' }"
  >
    <span class="label">{{ label }}</span>

    <ScrollRow :disabled="disabled">
      <template #fixed>
        <PillButton
          v-if="showAll && !items.some(i => i.id === '*')"
          :active="isAllActive"
          :disabled="disabled"
          @click="selectAll"
        >
          All
        </PillButton>
      </template>

      <PillButton
        v-for="item in items"
        :key="item.id"
        :active="isActive(item.id)"
        :disabled="disabled"
        @click="toggleItem(item.id)"
      >
        {{ item.label }}
      </PillButton>
    </ScrollRow>
  </div>
</template>

<style scoped>

/* =========================================================
   LAYOUT
========================================================= */

.chip-selector {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr);
  align-items: center;
}

.chip-selector.aligned {
  align-items: flex-start;
}

/*
  Le sélecteur entier est estompé : ses boutons ne le sont
  pas une seconde fois.
*/
.chip-selector.disabled {
  opacity: 0.45;
}

.chip-selector.disabled :deep(.pill-button:disabled) {
  opacity: 1;
}

/* =========================================================
   LABEL
========================================================= */

.label {
  font-size: 0.9rem;
  color: var(--text-soft);
}

</style>
