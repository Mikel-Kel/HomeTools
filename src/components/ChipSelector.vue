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

  modelValue: [String, Number, null],

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
  }
})

const emit = defineEmits(["update:modelValue"])

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
    :class="{ aligned: alignWithContent }"
    :style="{ marginBottom: bottomSpacing + 'px' }"
  >
    <!-- LABEL -->
    <span class="label">{{ label }}</span>

    <!-- CHIPS -->
    <div class="chip-layout">

      <!-- LEFT (All + arrow) -->
      <div class="chip-fixed">
        <button
          v-if="showAll"
          class="chip"
          :class="{ active: modelValue === null }"
          @click="emit('update:modelValue', null)"
        >
          All
        </button>

        <button
          v-if="canScrollLeft"
          class="scroll-btn inside"
          @click="scroll(-1)"
        >
          ‹
        </button>
      </div>

      <!-- SCROLLABLE -->
      <div
        class="chip-scroll"
        ref="scrollRef"
        @scroll="updateScrollState"
      >
        <button
          v-for="item in items"
          :key="item.id"
          class="chip"
          :class="{ active: modelValue === item.id }"
          @click="emit('update:modelValue', item.id)"
        >
          {{ item.label }}
        </button>
      </div>

      <!-- RIGHT -->
      <button
        v-if="canScrollRight"
        class="scroll-btn right"
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

/* alignement type sheet */
.chip-selector.aligned {
  align-items: flex-start;
}

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

/* FIXED (All + left arrow) */
.chip-fixed {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* SCROLL */
.chip-scroll {
  display: flex;
  gap: 6px;
  overflow-x: hidden;
  scroll-behavior: smooth;
  min-width: 0;
}

/* =========================================================
   CHIPS STYLE (UNIFIED)
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

.chip:hover {
  opacity: 0.9;
}

.chip.active {
  opacity: 1;
  background: var(--primary-soft);
  border-color: var(--primary);
  color: var(--primary);
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

.scroll-btn:hover {
  opacity: 1;
}

.scroll-btn.inside {
  margin-left: 2px;
}

</style>