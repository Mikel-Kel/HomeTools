<script setup lang="ts">
import {
  onBeforeUnmount,
  onMounted,
} from "vue";

/* =========================
   Étiquette en grand

   Image en plein écran, au-dessus de la fiche du vin.
   Fermeture : appui n'importe où, ✕ ou Échap ; l'Échap est
   arrêté ici et ne ferme pas la fiche dessous.
========================= */

defineProps<{
  url: string;
  title: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

/* Phase de capture : avant l'écoute de la fiche, qui fermerait aussi. */
function onKeydown(
  event: KeyboardEvent
) {
  if (event.key === "Escape") {
    event.stopImmediatePropagation();
    emit("close");
  }
}

onMounted(() => {
  window.addEventListener(
    "keydown",
    onKeydown,
    true
  );
});

onBeforeUnmount(() => {
  window.removeEventListener(
    "keydown",
    onKeydown,
    true
  );
});
</script>

<template>
  <div
    class="viewer"
    role="dialog"
    :aria-label="title"
    @click="emit('close')"
  >
    <button
      type="button"
      class="close-btn"
      aria-label="Close"
      @click.stop="emit('close')"
    >
      ✕
    </button>

    <img
      :src="url"
      :alt="title"
      draggable="false"
    />
  </div>
</template>

<style scoped>
.viewer {
  position: fixed;
  inset: 0;
  z-index: 1100;

  display: flex;
  align-items: center;
  justify-content: center;

  padding: 24px;
  box-sizing: border-box;

  background: var(--overlay);

  cursor: zoom-out;
}

.viewer img {
  max-width: 100%;
  max-height: 100%;

  border-radius: 8px;

  box-shadow: var(--shadow-lg);

  object-fit: contain;
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;

  padding: 4px 10px;

  border: none;
  border-radius: 8px;

  background: var(--surface);
  color: var(--text);

  font-size: 18px;
  line-height: 1;

  cursor: pointer;
}
</style>
