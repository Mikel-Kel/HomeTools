<template>
  <header class="app-title">
    <img
      v-if="icon"
      :src="`/icons/${icon}`"
      class="icon"
      alt=""
    />
    <h1>{{ text }}</h1>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  text: string
  icon?: string
}>()
</script>

<style scoped>
.app-title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 0;
}

.icon {
  width: 32px;
  height: 32px;
}

h1 {
  font-size: 1.4rem;
  margin: 0;
}
</style>