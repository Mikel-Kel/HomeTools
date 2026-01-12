<template>
  <div class="homepage">
    <AppTitle text="Welcome to HomeTools" icon="loop" />

    <ul class="menu">
      <li>
        <router-link to="/authentication">Authentication</router-link>
      </li>
      <li>
        <router-link to="/spending">Spending</router-link>
      </li>
      <li>
        <router-link to="/contact">Contact</router-link>
      </li>
      <li>
        <router-link to="/events">Events (DevTools)</router-link>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import AppTitle from "@/components/AppTitle.vue";
</script>

<style scoped>
.homepage {
  padding: 1rem;
}

.menu {
  list-style: none;
  padding: 0;
  margin-top: 1rem;
}

.menu li {
  margin-bottom: 0.5rem;
}

.menu a {
  text-decoration: none;
  color: #1e40af;
}

.menu a:hover {
  text-decoration: underline;
}
</style>