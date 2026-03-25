<script setup lang="ts">
import AppIcon from "@/components/AppIcon.vue";

withDefaults(
  defineProps<{
    text: string;
    icon?: string;
    iconSize?: 24 | 32 | 64 | 128;
  }>(),
  {
    iconSize: 64,
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

  color: var(--text); /* 🔥 FIX explicite */
}

h1 {
  font-size: var(--font-size-xl); /* 🔥 DS au lieu de 2rem */
  margin: 0;
  line-height: 1.2;
  font-weight: 700;

  color: var(--text); /* 🔥 important en dark */
}

/* 🔥 option subtile (Apple-like) */
.app-title span {
  opacity: 0.8;
}
</style>