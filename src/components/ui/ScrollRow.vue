<script setup lang="ts">
import {
  onBeforeUnmount,
  onMounted,
  ref,
} from "vue";

/* =========================
   Rangée défilante

   Les éléments restent sur une ligne. Quand ils dépassent
   la largeur disponible, « ‹ » et « › » apparaissent ; le
   défilement au doigt (iPad) reste possible.

   Slot « fixed » : éléments toujours visibles, à gauche
   (ex. « All » d’un ChipSelector).
========================= */

defineProps<{
  disabled?: boolean;
}>();

const scrollRef =
  ref<HTMLElement | null>(null);

const canScrollLeft =
  ref(false);

const canScrollRight =
  ref(false);

function updateScrollState() {
  const element =
    scrollRef.value;

  if (!element) {
    return;
  }

  const maxScrollLeft =
    element.scrollWidth -
    element.clientWidth;

  canScrollLeft.value =
    element.scrollLeft > 1;

  canScrollRight.value =
    element.scrollLeft <
    maxScrollLeft - 1;
}

function scroll(
  direction: number
) {
  const element =
    scrollRef.value;

  if (!element) {
    return;
  }

  element.scrollBy({
    left:
      direction *
      element.clientWidth *
      0.7,

    behavior:
      "smooth",
  });
}

/*
  Recalcul quand la largeur disponible change (rotation,
  fenêtre) ou quand le contenu change (éléments ajoutés,
  libellés modifiés).
*/
let resizeObserver:
  ResizeObserver | null = null;

let mutationObserver:
  MutationObserver | null = null;

onMounted(() => {
  const element =
    scrollRef.value;

  if (!element) {
    return;
  }

  resizeObserver =
    new ResizeObserver(
      updateScrollState
    );

  resizeObserver.observe(
    element
  );

  mutationObserver =
    new MutationObserver(
      updateScrollState
    );

  mutationObserver.observe(
    element,
    {
      childList: true,
      subtree: true,
      characterData: true,
    }
  );

  updateScrollState();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  mutationObserver?.disconnect();
});
</script>

<template>
  <div class="scroll-row">
    <slot name="fixed" />

    <button
      v-if="canScrollLeft"
      type="button"
      class="scroll-btn"
      aria-label="Scroll left"
      :disabled="disabled"
      @click="scroll(-1)"
    >
      ‹
    </button>

    <div
      ref="scrollRef"
      class="scroll-content"
      @scroll="updateScrollState"
    >
      <slot />
    </div>

    <button
      v-if="canScrollRight"
      type="button"
      class="scroll-btn"
      aria-label="Scroll right"
      :disabled="disabled"
      @click="scroll(1)"
    >
      ›
    </button>
  </div>
</template>

<style scoped>
.scroll-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.scroll-content {
  display: flex;
  align-items: center;
  gap: var(--scroll-row-gap, 6px);

  flex: 0 1 auto;
  min-width: 0;

  overflow-x: auto;
  scrollbar-width: none;
}

.scroll-content::-webkit-scrollbar {
  display: none;
}

.scroll-btn {
  flex: none;

  padding: 0 6px;

  border: none;
  border-radius: 999px;

  background: var(--surface);
  color: var(--text);

  font-size: 18px;
  font-weight: 700;

  opacity: 0.85;
  cursor: pointer;
}

.scroll-btn:hover:not(:disabled) {
  background: var(--primary-soft);
  color: var(--primary);
  opacity: 1;
}

.scroll-btn:disabled {
  cursor: default;
}
</style>
