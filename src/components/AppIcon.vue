<script setup lang="ts">
import { ref, watchEffect } from "vue";

const props = withDefaults(
  defineProps<{
    name: string;
    size?: 24 | 32 | 64 | 128;
  }>(),
  {
    size: 32,
  }
);

const src = ref<string>("");

// 🔑 tailles de secours globales
const FALLBACK_SIZES = [props.size, 32, 24, 64, 128];

// ⚠️ Vite doit connaître les fichiers à l’avance
const icons = import.meta.glob(
  "@/assets/icons/png/*/*.png",
  { eager: true, import: "default" }
) as Record<string, string>;

watchEffect(() => {
  src.value = "";

  for (const size of FALLBACK_SIZES) {
    const key = `/src/assets/icons/png/${size}/${props.name}.png`;
    if (icons[key]) {
      src.value = icons[key];
      return;
    }
  }

  console.warn(
    `[AppIcon] icon not found: ${props.name} (tried ${FALLBACK_SIZES.join(", ")})`
  );
});
</script>

<template>
  <img
    v-if="src"
    :src="src"
    :width="size"
    :height="size"
    class="png-icon"
    draggable="false"
    alt=""
  />
</template>

<style scoped>
.png-icon {
  display: block;
  user-select: none;
}
</style>