<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    name: string;
    size?: 24 | 32 | 64 | 128;
  }>(),
  {
    size: 32,
  }
);
</script>

<template>
  <img
    :src="`/src/assets/icons/png/${size}/${name}.png`"
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