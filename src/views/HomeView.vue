<script setup lang="ts">
import AppTitle from "@/components/AppTitle.vue";
import AppIcon from "@/components/AppIcon.vue";
</script>

<template>
  <div class="homepage">
    <AppTitle
      text="Welcome"
      icon="home"
      :iconSize="128"
    />

    <ul class="menu">
      <li>
        <router-link to="/authentication" class="menu-item">
          <AppIcon name="lock" :size="64" />
          <span>Authentication</span>
        </router-link>
      </li>

      <li>
        <router-link to="/spending" class="menu-item">
          <AppIcon name="shopping_cart" :size="64" />
          <span>Spending</span>
        </router-link>
      </li>

      <li>
        <router-link to="/contact" class="menu-item">
          <AppIcon name="users" :size="64" />
          <span>Contact</span>
        </router-link>
      </li>

      <li>
        <router-link to="/events" class="menu-item dev">
          <AppIcon name="rss" :size="64" />
          <span>Events (DevTools)</span>
        </router-link>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.homepage {
  padding: 1rem;
}

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
  color: #1e40af;
}

/* Effet "app" au survol / tap */
.menu-item:hover {
  background: #eef2ff;
}

/* Texte un peu plus lisible */
.menu-item span {
  font-size: 1.5rem;
}

/* DevTools légèrement en retrait visuel */
.menu-item.dev {
  opacity: 0.85;
}</style>