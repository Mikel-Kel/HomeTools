<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import AppNavRail from "@/components/AppNavRail.vue";
import AppDialog from "@/components/ui/AppDialog.vue";
import AppUnavailable from "@/components/AppUnavailable.vue";

const route = useRoute();

/*
  Barre de navigation sur toutes les pages, sauf l'accueil
  (qui a son menu) et le choix du dossier local.
*/
const showNavRail = computed(() =>
  route.name !== undefined &&
  route.name !== "home" &&
  route.name !== "selectFolder"
);
</script>

<template>
  <AppNavRail v-if="showNavRail" />

  <div
    class="app-content"
    :class="{ 'with-nav-rail': showNavRail }"
  >
    <router-view />
  </div>

  <!-- Le choix du stockage reste accessible : passer à un autre backend débloque l'app. -->
  <AppUnavailable v-if="route.name !== 'authentication'" />

  <AppDialog />
</template>

<style scoped>
.app-content.with-nav-rail {
  margin-left: var(--nav-rail-width);
}
</style>