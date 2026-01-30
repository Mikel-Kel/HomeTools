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
    <!-- LEFT -->
    <AppTitle
      :text="title"
      :icon="icon"
    />

    <!-- RIGHT -->
    <div class="header-right">
      <!-- 🔌 actions spécifiques à la vue -->
      <slot name="actions" />

      <!-- navigation globale -->
      <NavigationButtons :disabled="disabled" />
    </div>
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

  padding: 0.75rem 1rem;
  background: var(--bg);
  color: var(--text);
  border-bottom: 1px solid var(--border);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* AppTitle hérite correctement */
.page-header :deep(.app-title) {
  margin: 0;
  color: var(--text);
}
</style>