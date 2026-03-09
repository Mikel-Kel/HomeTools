<script setup lang="ts">
import { computed, onMounted } from "vue";

/* =========================
   Device detection
========================= */
import { detectDevice } from "@/utils/deviceDetection";
const device = detectDevice();

import { useStorageBackend } from "@/composables/useStorageBackend";
const { backend } = useStorageBackend();

import { pickLocalDirectory, getLocalDirectory } from "@/services/local/localDirectory"

const uiDriveStatus = computed(() => {

  if (backend.value === "LOCAL_DRIVE") {

    if (getLocalDirectory()) return "connected"

    return "disconnected"

  }

  return driveStatus.value === "CONNECTED"
    ? "connected"
    : "disconnected"

})


/* =========================
   App parameters
========================= */
import { useAppParameters } from "@/composables/useAppParameters";
const { load } = useAppParameters();

onMounted(async () => {
  await load();
});

/* =========================
   Theme
========================= */
import { useTheme } from "@/composables/useTheme";
const { toggle, theme } = useTheme();

/* =========================
   Drive session (SINGLE SOURCE OF TRUTH)
========================= */
import { useDrive } from "@/composables/useDrive";

const { driveStatus } = useDrive();

/* =========================
   Components
========================= */
import AppTitle from "@/components/AppTitle.vue";
import AppIcon from "@/components/AppIcon.vue";

/* =========================
   Version app (injectée par Vite)
========================= */
const appVersion = __APP_VERSION__;
</script>

<template>
  <div class="homepage">
    <!-- Header -->
    <div class="home-header">
      <div class="title-block">
        <AppTitle
          text="Welcome"
          icon="home"
          :iconSize="64"
        />

        <!-- Drive status (aligné sous le TEXTE, pas l’icône) -->
        <div class="drive-status" :class="uiDriveStatus">
          <span class="dot"></span>
          <span class="status-text">

            <template v-if="backend === 'LOCAL_DRIVE' && !getLocalDirectory()">
              Select HomeTools folder (Mac)
            </template>
            <template v-else-if="uiDriveStatus === 'connected'">
              <template v-if="backend === 'LOCAL_DRIVE'">
                App ready (local)
              </template>
              <template v-else>
                App ready (remote)
              </template>
            </template>

            <template v-else>
              Home tools not available ({{ device }})
            </template>

          </span>
        </div>
      </div>

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
          <AppIcon name="locker" :size="32" />
          <span>Authentication</span>
        </router-link>
      </li>

      <li>
        <router-link to="/spending" class="menu-item">
          <AppIcon name="spending" :size="32" />
          <span>Spending</span>
        </router-link>
      </li>

      <li>
        <router-link to="/follow-up" class="menu-item">
          <AppIcon name="followup" :size="32" />
          <span>Follow-up</span>
        </router-link>
      </li>
      <li>
        <router-link to="/documentsArchive" class="menu-item">
          <AppIcon name="bookshelf" :size="32" />
          <span>Archives</span>
        </router-link>
      </li>

      <li>
        <router-link to="/events" class="menu-item dev">
          <AppIcon name="pages_warning" :size="32" />
          <span>Activity logs</span>
        </router-link>
      </li>
    </ul>
    <!-- Version app -->
    <div class="app-version">
      Version {{ appVersion }}
    </div>
  </div>
</template>

<style scoped>
.homepage {
  padding: 1rem;
  background: var(--bg);
  color: var(--text);
}

.home-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

/* =========================
   Title + status
========================= */
.title-block {
  display: flex;
  flex-direction: column;
}

/* 🔑 ALIGNEMENT CLÉ */
.drive-status {
  display: flex;
  align-items: center;
  gap: 8px;

  /* largeur icône (64px) + espacement interne AppTitle */
  margin-left: 80px;
  margin-top: -2.2rem;

  font-size: 0.9rem;
}

/* Pastille */
.drive-status .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

/* Couleurs */
.drive-status.connected .dot {
  background: var(--positive);
}

.drive-status.disconnected .dot {
  background: var(--negative);
}

.drive-status.connected {
  color: var(--positive);
}

.drive-status.disconnected {
  color: var(--negative);
}
/* 🔧 Corrige l’alignement vertical du texte Welcome */
:deep(.app-title h1),
:deep(.app-title h2) {
  line-height: 1.1;
margin-top: -1.1rem;   /* remonte le texte vers l’icône */
}

/* =========================
   Theme toggle
========================= */
.theme-toggle {
  background: none;
  color: var(--text); 
  border: none;
  padding: 6px;
  border-radius: 8px;
  cursor: pointer;
}

.theme-toggle:hover {
  background: var(--primary-soft);
}

/* =========================
   Menu
========================= */
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
  color: var(--text);
}

.menu-item:hover {
  background: var(--primary-soft);
  color: var(--primary);
}

.menu-item span {
  font-size: 1.5rem;
}

.menu-item.dev {
  opacity: 0.85;
}

/* =========================
   App version (footer)
========================= */
.app-version {
  margin-top: 2rem;
  text-align: center;

  font-size: 0.75rem;
  opacity: 0.45;
  letter-spacing: 0.03em;

  user-select: none;
}

</style>