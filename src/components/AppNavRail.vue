<script setup lang="ts">
import { useRoute } from "vue-router";

import AppIcon from "@/components/AppIcon.vue";

import {
  NAVIGATION_ITEMS,
  isNavigationItemActive,
} from "@/config/navigation";

import { useHousekeepingHealth } from "@/composables/useHousekeepingHealth";
import { useTheme } from "@/composables/useTheme";

/* =========================
   Barre de navigation (toutes les pages sauf l'accueil)

   Icônes seules, libellé au survol ; la page en cours est
   mise en évidence. En bas : authentification et
   jour / nuit.
========================= */

const route =
  useRoute();

const {
  health,
  title: healthTitle,
} = useHousekeepingHealth();

const {
  theme,
  toggle,
} = useTheme();
</script>

<template>
  <nav
    class="nav-rail"
    aria-label="Pages"
  >
    <router-link
      to="/"
      class="rail-item"
      title="Home"
      aria-label="Home"
    >
      <AppIcon
        name="home"
        :size="32"
      />
    </router-link>

    <div class="rail-separator"></div>

    <router-link
      v-for="item in NAVIGATION_ITEMS"
      :key="item.path"
      :to="item.path"
      class="rail-item"
      :class="{ active: isNavigationItemActive(item, route.path) }"
      :title="item.label"
      :aria-label="item.label"
    >
      <AppIcon
        :name="item.icon"
        :size="32"
      />

      <span
        v-if="item.health && health"
        class="health-dot"
        :class="health"
        :title="healthTitle"
      ></span>
    </router-link>

    <div class="rail-spacer"></div>

    <router-link
      to="/authentication"
      class="rail-item small"
      :class="{ active: route.path === '/authentication' }"
      title="Authentication"
      aria-label="Authentication"
    >
      <AppIcon
        name="locker"
        :size="24"
      />
    </router-link>

    <button
      type="button"
      class="rail-item small"
      :title="theme === 'dark' ? 'Light mode' : 'Dark mode'"
      :aria-label="theme === 'dark' ? 'Light mode' : 'Dark mode'"
      @click="toggle"
    >
      <AppIcon
        :name="theme === 'dark' ? 'sun' : 'moon'"
        :size="24"
      />
    </button>
  </nav>
</template>

<style scoped>
.nav-rail {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  z-index: 200;

  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;

  width: var(--nav-rail-width);
  padding: 12px 0;
  box-sizing: border-box;

  border-right: 1px solid var(--border);

  background: var(--surface);
}

.rail-item {
  position: relative;

  display: inline-flex;
  align-items: center;
  justify-content: center;

  width: 44px;
  height: 44px;

  border: none;
  border-radius: 10px;

  background: transparent;
  color: var(--text);

  cursor: pointer;
  transition: background 0.15s ease;
}

.rail-item.small {
  width: 38px;
  height: 38px;
}

.rail-item:hover {
  background: var(--primary-soft);
}

.rail-item.active {
  background: var(--primary-soft);
  box-shadow: inset 3px 0 0 var(--primary);
}

.rail-separator {
  width: 28px;
  height: 1px;
  margin: 4px 0;

  background: var(--border);
}

.rail-spacer {
  flex: 1;
}

/*
  Pastille d'état du housekeeping, en coin de l'icône.
*/
.health-dot {
  position: absolute;
  top: 5px;
  right: 5px;

  width: 10px;
  height: 10px;

  border: 2px solid var(--surface);
  border-radius: 50%;
}

.health-dot.ok {
  background: var(--positive);
}

.health-dot.warning {
  background: var(--warning);
}

.health-dot.error {
  background: var(--negative);
}
</style>
