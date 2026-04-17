<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue"

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

/* =========================
   Scroll logic
========================= */
const scrollRef = ref<HTMLElement | null>(null)

const canScrollLeft = ref(false)
const canScrollRight = ref(false)

function updateScrollState() {
  const el = scrollRef.value
  if (!el) return

  canScrollLeft.value = el.scrollLeft > 0
  canScrollRight.value =
    el.scrollLeft + el.clientWidth < el.scrollWidth - 1
}

function scroll(direction: number) {
  if (props.disabled) return

  const el = scrollRef.value
  if (!el) return

  const amount = el.clientWidth * 0.7

  el.scrollBy({
    left: direction * amount,
    behavior: "smooth"
  })

  setTimeout(updateScrollState, 250)
}

/* =========================
   Lifecycle
========================= */
onMounted(() => {
  setTimeout(updateScrollState, 0)
})

watch(() => props.items, () => {
  setTimeout(updateScrollState, 0)
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

    <div class="chip-layout">
      <div class="chip-fixed">
        <button
          v-if="showAll && !items.some(i => i.id === '*')"  
          class="chip"
          :class="{ active: isAllActive }"
          :disabled="disabled"
          @click="selectAll"
        >
          All
        </button>

        <button
          v-if="canScrollLeft"
          class="scroll-btn inside"
          :disabled="disabled"
          @click="scroll(-1)"
        >
          ‹
        </button>
      </div>

      <div
        class="chip-scroll"
        ref="scrollRef"
        @scroll="updateScrollState"
      >
        <button
          v-for="item in items"
          :key="item.id"
          class="chip"
          :class="{ active: isActive(item.id) }"
          :disabled="disabled"
          @click="toggleItem(item.id)"
        >
          {{ item.label }}
        </button>
      </div>

      <button
        v-if="canScrollRight"
        class="scroll-btn right"
        :disabled="disabled"
        @click="scroll(1)"
      >
        ›
      </button>
    </div>
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

.chip-selector.disabled {
  opacity: 0.45;
}

/* =========================================================
   LABEL
========================================================= */

.label {
  font-size: 0.9rem;
  color: var(--text-soft);
}

/* =========================================================
   CHIP STRUCTURE
========================================================= */

.chip-layout {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.chip-fixed {
  display: flex;
  align-items: center;
  gap: 6px;
}

.chip-scroll {
  display: flex;
  gap: 6px;
  overflow-x: hidden;
  scroll-behavior: smooth;
  min-width: 0;
}

/* =========================================================
   CHIPS
========================================================= */

.chip {
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 0.75rem;
  font-weight: 600;
  opacity: 0.7;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.chip:hover:not(:disabled) {
  opacity: 0.9;
}

.chip.active {
  opacity: 1;
  background: var(--primary-soft);
  border-color: var(--primary);
  color: var(--primary);
}

.chip:disabled {
  cursor: default;
}

/* =========================================================
   SCROLL BUTTONS
========================================================= */

.scroll-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 18px;
  opacity: 0.5;
  padding: 0 4px;
}

.scroll-btn:hover:not(:disabled) {
  opacity: 1;
}

.scroll-btn:disabled {
  cursor: default;
}

.scroll-btn.inside {
  margin-left: 2px;
}

</style>