<template>
  <div class="authentication-view">
    <AppTitle text="Authentication" icon="loop" />
    <p>Please log in or sign up.</p>
  </div>
</template>

<script setup lang="ts">
import AppTitle from "@/components/AppTitle.vue";
</script>

<style scoped>
.authentication-view {
  padding: 1rem;
}

p {
  margin-top: 0.5rem;
  color: #1e3a8a;
}
</style>