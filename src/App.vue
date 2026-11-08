<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import AppNavRail from "@/components/AppNavRail.vue";
import AppDialog from "@/components/ui/AppDialog.vue";
import AppUnavailable from "@/components/AppUnavailable.vue";
import { environmentBlock, environmentReady } from "@/services/environment/environmentState";

const route = useRoute();

/*
  Les pages ne sont montées qu'une fois l'environnement
  connu (/api/whoami) et le stockage du navigateur
  préparé (main.ts) : aucune ne lit le stockage avant.
*/
const environmentKnown = computed(() =>
  environmentReady.value
);

/*
  Barre de navigation sur toutes les pages, sauf l'accueil
  (qui a son menu) et le choix du dossier local.
*/
const showNavRail = computed(() =>
  environmentKnown.value &&
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
    <router-view v-if="environmentKnown" />

    <p
      v-else-if="!environmentBlock"
      class="connecting"
    >
      Connecting…
    </p>
  </div>

  <AppUnavailable />

  <AppDialog />
</template>

<style scoped>
.app-content.with-nav-rail {
  margin-left: var(--nav-rail-width);
}

.connecting {
  margin: 0;
  padding: 2rem 16px;

  color: var(--text-soft);
  text-align: center;
}
</style>
