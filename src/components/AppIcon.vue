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

watchEffect(async () => {
  try {
    const mod = await import(
      `@/assets/icons/png/${props.size}/${props.name}.png`
    );
    src.value = mod.default;
  } catch (e) {
    console.warn(
      `[AppIcon] icon not found: ${props.name} (${props.size}px)`
    );
    src.value = "";
  }
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
  image-rendering: auto;
}
</style>