<script setup lang="ts">
import { useTheme } from "@/composables/useTheme";

import AppTitle from "@/components/AppTitle.vue";
import AppIcon from "@/components/AppIcon.vue";

const { toggle, theme} = useTheme();
 
</script>

<template>
  <div class="homepage">
    <!-- Header Home -->
    <div class="home-header">
      <AppTitle
        text="Welcome"
        icon="home"
        :iconSize="64"
      />

      <!-- Theme toggle -->
      <button class="theme-toggle" @click="toggle" title="Toggle theme">
        <AppIcon
          :name="theme === 'dark' ? 'sun' : 'moon'"
          :size="24"
        />
      </button>
    </div>

    <!-- Menu -->
    <ul class="menu">
      <li>
        <router-link to="/authentication" class="menu-item">
          <AppIcon name="lock" :size="32" />
          <span>Authentication</span>
        </router-link>
      </li>

      <li>
        <router-link to="/spending" class="menu-item">
          <AppIcon name="shopping_cart" :size="32" />
          <span>Spending</span>
        </router-link>
      </li>

      <li>
        <router-link to="/contact" class="menu-item">
          <AppIcon name="users" :size="32" />
          <span>Contact</span>
        </router-link>
      </li>

      <li>
        <router-link to="/events" class="menu-item dev">
          <AppIcon name="rss" :size="32" />
          <span>Events (DevTools)</span>
        </router-link>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.homepage {
  padding: 1rem;
  background: var(--bg);
  color: var(--text);
}

/* Header */
.home-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Theme toggle */
.theme-toggle {
  background: none;
  border: none;
  padding: 6px;
  border-radius: 8px;
  cursor: pointer;
}

.theme-toggle:hover {
  background: var(--primary-soft);
}

/* Menu */
.menu {
  list-style: none;
  padding: 0;
  margin-top: 1.5rem;
}

.menu li {
  margin-bottom: 1.2rem;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 16px;

  padding: 18px 20px;
  border-radius: 12px;

  text-decoration: none;
  color: var(--primary);
}

/* Effet "app" */
.menu-item:hover {
  background: var(--primary-soft);
}

/* Texte */
.menu-item span {
  font-size: 1.5rem;
}

/* DevTools */
.menu-item.dev {
  opacity: 0.85;
}
</style>
