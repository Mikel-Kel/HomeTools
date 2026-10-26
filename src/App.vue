<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import AppNavRail from "@/components/AppNavRail.vue";
import { initGoogleAPI } from "@/services/google/googleInit";
import { useStorageBackend } from "@/composables/useStorageBackend";
import { log } from "./utils/logger";

const { backend } = useStorageBackend();

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

/* =========================
   Init
========================= */

onMounted(async () => {

  if (backend.value !== "GOOGLE_DRIVE") {
    log.info("LOCAL_DRIVE mode → Google API skipped");
    return;
  }

  try {
    await initGoogleAPI();
  } catch (e) {
    log.error("[Google API init failed]", e);
  }

});
</script>

<template>
  <AppNavRail v-if="showNavRail" />

  <div
    class="app-content"
    :class="{ 'with-nav-rail': showNavRail }"
  >
    <router-view />
  </div>
</template>

<style scoped>
.app-content.with-nav-rail {
  margin-left: var(--nav-rail-width);
}
</style>