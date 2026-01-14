<script setup lang="ts">
import PageHeader from "@/components/PageHeader.vue";
</script>

<template>
  <PageHeader title="Authentication" icon="lock" />
  <div class="authentication-view">
    <p>Please log in or sign up.</p>
  </div>
</template>

<style scoped>
.authentication-view {
  padding: 1rem;
}

p {
  margin-top: 0.5rem;
  color: #1e3a8a;
}
</style>