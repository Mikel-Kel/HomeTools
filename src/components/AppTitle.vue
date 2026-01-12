<script setup lang="ts">
import AppIcon from "@/components/AppIcon.vue";

defineProps<{
  text: string;
  icon?: string;
}>();
</script>

<template>
  <header class="app-title">
    <AppIcon
      v-if="icon"
      :name="icon"
      :size="28"
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
  font-size: 1.4rem;
  margin: 0;
  line-height: 1.2;
}
</style>