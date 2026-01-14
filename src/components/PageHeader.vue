<script setup lang="ts">
import AppTitle from "@/components/AppTitle.vue";
import NavigationButtons from "@/components/NavigationButtons.vue";

defineProps<{
  title: string;
  icon: string;
}>();
</script>

<template>
  <header class="page-header">
    <AppTitle
      :text="title"
      :icon="icon"
    />

    <NavigationButtons />
  </header>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.page-header :deep(.app-title) {
  margin: 0;
}
</style>