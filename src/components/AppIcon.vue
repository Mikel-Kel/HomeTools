<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ name: string }>();

const icons = import.meta.glob("../assets/icons/*.svg", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

const svg = computed(() => {
  const key = `../assets/icons/${props.name}.svg`;
  console.log("ICON KEY:", key);
  console.log("SVG CONTENT:", icons[key]?.slice(0, 200));
  return icons[key] ?? "<!-- NO SVG -->";
});
</script>

<template>
  <span
    style="border:1px solid blue; width:48px; height:48px; display:inline-block"
    v-html="svg"
  />
</template>