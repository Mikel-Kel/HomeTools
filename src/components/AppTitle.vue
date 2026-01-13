<script setup lang="ts">
import AppIcon from "@/components/AppIcon.vue";

withDefaults(
  defineProps<{
    text: string;
    icon?: string;
    iconSize?: 24 | 32 | 64 | 128;
  }>(),
  {
    iconSize: 24,
  }
);
</script>

<template>
  <header class="app-title">
    <AppIcon
      v-if="icon"
      :name="icon"
      :size="iconSize"
      class="icon"
    />
    <h1>{{ text }}</h1>
  </header>
</template>

<style scoped>
.app-title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 0;
}

h1 {
  font-size: 2rem;
  margin: 0;
  line-height: 1.2;
}
</style>