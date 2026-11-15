<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
} from "vue";

import { useWinePhoto } from "@/composables/wineCellar/useWinePhoto";

/* =========================
   Photo de l'étiquette d'un vin

   Image (useWinePhoto) ou pictogramme neutre d'une bouteille
   quand le vin n'a pas de photo, pendant le chargement, ou
   si l'image ne se charge pas.
   - size « sheet » : zone de la fiche du vin ;
   Classes préfixées wine-photo- : une classe du parent
   (ex. .sheet de la fiche) s'appliquerait aussi à la racine
   de ce composant.
   - size « thumb » : vignette de la liste, chargée seulement
     quand elle approche de l'écran (IntersectionObserver),
     puis gardée.
========================= */

const props = defineProps<{
  photoKey: string | null;
  size: "sheet" | "thumb";
}>();

const root =
  ref<HTMLElement | null>(null);

/* Vignette : chargée une fois devenue visible. */
const visible =
  ref(props.size === "sheet");

let observer:
  IntersectionObserver | null = null;

onMounted(() => {
  if (visible.value || !root.value) {
    return;
  }

  observer =
    new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          visible.value = true;
          observer?.disconnect();
          observer = null;
        }
      },
      {
        rootMargin: "200px 0px",
      }
    );

  observer.observe(root.value);
});

onBeforeUnmount(() => {
  observer?.disconnect();
});

const photo =
  useWinePhoto(
    () => props.photoKey,
    () => visible.value
  );

const shown =
  computed(() =>
    !!photo.url.value && !photo.failed.value
  );

defineExpose({
  /* URL de l'image affichée, null sinon (agrandissement). */
  url: computed(() => (shown.value ? photo.url.value : null)),
});
</script>

<template>
  <span
    ref="root"
    class="wine-photo"
    :class="[`wine-photo-${size}`, { 'wine-photo-empty': !shown }]"
  >
    <img
      v-if="shown"
      :src="photo.url.value ?? undefined"
      alt="Label"
      draggable="false"
      @error="photo.failed.value = true"
    />

    <svg
      v-else
      viewBox="0 0 24 64"
      aria-hidden="true"
    >
      <path
        d="M9 2h6v14c0 3 6 6 6 13v31a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V29c0-7 6-10 6-13z"
      />
      <rect
        x="5"
        y="34"
        width="14"
        height="14"
        rx="1"
      />
    </svg>
  </span>
</template>

<style scoped>
.wine-photo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  box-sizing: border-box;

  background: var(--bg-soft);
}

.wine-photo img {
  width: 100%;
  height: 100%;

  object-fit: cover;
}

.wine-photo svg {
  fill: var(--text-muted);
  opacity: 0.5;
}

.wine-photo svg rect {
  fill: var(--bg-soft);
}

.wine-photo-sheet {
  width: 160px;
  height: 160px;

  border: 1px solid var(--border);
  border-radius: 10px;
}

.wine-photo-sheet img {
  object-fit: contain;
}

.wine-photo-sheet.wine-photo-empty {
  border-style: dashed;
}

.wine-photo-sheet svg {
  height: 100px;
}

.wine-photo-thumb {
  width: 32px;
  height: 32px;

  border-radius: 6px;

  vertical-align: middle;
}

.wine-photo-thumb svg {
  height: 22px;
}
</style>
