<script setup lang="ts">
import AppTitle from "@/components/AppTitle.vue";
import NavigationButtons from "@/components/NavigationButtons.vue";

defineProps<{
  title: string;
  icon: string;
  disabled?: boolean; 
}>();
</script>

<template>
  <header class="page-header">
    <AppTitle
      :text="title"
      :icon="icon"
    />

    <NavigationButtons :disabled="disabled" />
  </header>
</template>

<style scoped>
.page-header {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;

  margin-bottom: 0rem;
  padding: 0.75rem 1rem;

  background: var(--bg);
  color: var(--text);

  border-bottom: 1px solid var(--border);
}

/* AppTitle hérite correctement */
.page-header :deep(.app-title) {
  margin: 0;
  color: var(--text);
}
</style>