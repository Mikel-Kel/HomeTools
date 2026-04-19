<script setup lang="ts">
import { computed, watch, ref, onMounted } from "vue";

/* =========================
   Device detection
========================= */
import { detectDevice } from "@/utils/deviceDetection";
const device = detectDevice();

import { useStorageBackend } from "@/composables/useStorageBackend";
const { backend } = useStorageBackend();

import { useAppBootstrap } from "@/composables/useAppBootstrap"
const { loadSettings } = useAppBootstrap()

import { getLocalDirectory } from "@/services/local/localDirectory"

const uiDriveStatus = computed(() => {

  if (backend.value === "LOCAL_DRIVE") {

    if (getLocalDirectory()) return "connected"

    return "disconnected"

  }

  return driveStatus.value === "CONNECTED"
    ? "connected"
    : "disconnected"

})

import { loadJSONFromFolder } from "@/services/driveAdapter"
import { formatDate } from "@/utils/dateFormat"

onMounted(async () => {
  await loadSettings();
  await loadMarkets();
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


/* ===============
   Markets indices
================== */
interface MarketIndex {
  id: number
  code: string
  value: number
  change: number
  ytd: number
  y1: number
}

const markets = ref<MarketIndex[]>([])

const asOf = computed(() => {
  if (!markets.value.length) return null
  return (markets.value[0] as any).asOf || null
})

async function loadMarkets() {
  try {
    const data = await loadJSONFromFolder("settings", "homeSummary.json")

    if (!data?.markets?.indices) {
      console.warn("No markets data found")
      markets.value = []
      return
    }

    markets.value = data.markets.indices.map((m: any) => ({
      id: m.id,
      code: m.code,
      value: Number(m.close),
      change: Number(m.delta),
      ytd: Number(m.ytd),
      y1: Number(m.y1),
      asOf: m.asOf
    }))

  } catch (err) {
    console.error("Failed to load markets:", err)
    markets.value = []
  }
}

</script>

<template>
  <div class="homepage">
    
    <!-- Header -->
    <div class="home-header">
      <div class="title-block">
        <AppTitle text="Welcome" icon="home" :iconSize="64" />

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

      <button class="theme-toggle" @click="toggle">
        <AppIcon :name="theme === 'dark' ? 'sun' : 'moon'" :size="24" />
      </button>
    </div>

    <!-- =========================
         CONTENT 2 COLONNES
    ========================= -->
    <div class="home-content">

      <!-- LEFT -->
      <div class="home-left">
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
      </div>

      <!-- RIGHT -->
      <div class="home-right">
        <div class="markets">

          <div class="markets-header-grid">
            <span class="col-title-left">Markets</span>
            <span>Closing</span>
            <span>Δ D</span>
            <span>YTD</span>
            <span>1 Y</span>
          </div>

          <div class="markets-list">
            <div v-for="m in markets" :key="m.code" class="market-item">

              <span class="market-code">{{ m.code }}</span>

              <span class="market-value">
                {{ m.value.toLocaleString() }}
              </span>

              <span
                class="market-change"
                :class="{ positive: m.change >= 0, negative: m.change < 0 }"
              >
                {{ m.change >= 0 ? "+" : "" }}{{ m.change.toFixed(2) }}%
              </span>

              <span
                class="market-ytd"
                :class="{ positive: m.ytd >= 0, negative: m.ytd < 0 }"
              >
                {{ m.ytd >= 0 ? "+" : "" }}{{ m.ytd.toFixed(1) }}%
              </span>

              <span
                class="market-y1"
                :class="{ positive: m.y1 >= 0, negative: m.y1 < 0 }"
              >
                {{ m.y1 >= 0 ? "+" : "" }}{{ m.y1.toFixed(1) }}%
              </span>

            </div>
            
          </div>
        </div>
        <div v-if="asOf" class="markets-asof">
          As of {{ formatDate(asOf,"text") }}
        </div>        
      </div>
    </div>

    <!-- Version -->
    <div class="app-version">
      Version {{ appVersion }}
    </div>

  </div>
</template>

<style scoped>

/* =========================
   BASE
========================= */

.homepage {
  padding: 1rem;
  background: var(--bg);
  color: var(--text);
}

/* =========================
   HEADER
========================= */

.home-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.title-block {
  display: flex;
  flex-direction: column;
}

.drive-status {
  display: flex;
  align-items: center;
  gap: 8px;

  margin-left: 76px;
  margin-top: -40px;

  font-size: 0.85rem;
  color: var(--text-soft);
}

.drive-status .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

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

:deep(.app-title h1),
:deep(.app-title h2) {
  line-height: 1.1;
  margin-top: -0.6rem;
}

/* =========================
   THEME BUTTON
========================= */

.theme-toggle {
  background: transparent;
  border: 1px solid transparent;
  padding: 6px;
  border-radius: 8px;
  cursor: pointer;
}

.theme-toggle:hover {
  background: var(--primary-soft);
}

/* =========================
   LAYOUT 2 COLONNES
========================= */

.home-content {
  display: grid;
  grid-template-columns: 1fr 520px;
  gap: 16px;
  margin-top: 1rem;
  align-items: start;
}

.home-right {
  position: sticky;
  top: 1rem;
  margin-right: 60px; /* 🔥 espace à droite */
}


/* =========================
   MENU
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
  transition: all 0.15s ease;
}

.menu-item:hover {
  background: var(--primary-soft);
  color: var(--primary);
}

.menu-item span {
  font-size: 1.5rem;
  opacity: 0.9;
}

.menu-item.dev {
  opacity: 0.6;
}

/* =========================
   MARKETS
========================= */
.markets {
  max-width: 420px;
}

/* GRID COMMUNE */
/* GRID STRICT */
.markets-header-grid,
.market-item {
  display: grid;
  grid-template-columns: 70px 1fr 70px 70px 70px;
  align-items: center;
  gap: 12px;
}

/* =========================
   HEADER
========================= */

.markets-header-grid {
  margin-bottom: 6px;
  font-size: 0.75rem;
  color: var(--text-soft);
}

/* Markets (colonne 1) */
.col-title-left {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text);
}

/* 👉 Titres centrés sauf Markets */
.markets-header-grid span:not(:first-child) {
  text-align: right;
  padding-right: 10px;
}

/* =========================
   LIGNES
========================= */

.market-item {
  padding: 5px 0;              /* 🔥 plus compact */
  font-size: 0.85rem;          /* 🔥 plus petit */
  border-bottom: 1px solid var(--border);
}

.market-item:last-child {
  border-bottom: none;
}

/* =========================
   ALIGNEMENTS
========================= */

/* 👉 toutes les valeurs à droite */
.market-item span:not(:first-child) {
  text-align: right;
}

/* chiffres alignés proprement */
.market-value,
.market-change,
.market-ytd,
.market-y1 {
  font-variant-numeric: tabular-nums;
}

/* =========================
   COULEURS
========================= */

.market-change.positive,
.market-ytd.positive,
.market-y1.positive {
  color: var(--positive);
}

.market-change.negative,
.market-ytd.negative,
.market-y1.negative {
  color: var(--negative);
}

.markets-asof {
  margin-top: 6px;
  text-align: center;
  font-size: 0.7rem;
  color: var(--text-muted);
}

/* =========================
   FOOTER
========================= */

.app-version {
  margin-top: 2rem;
  text-align: center;
  font-size: 0.75rem;
  color: var(--text-muted);
}

/* =========================
   RESPONSIVE
========================= */

@media (max-width: 900px) {
  .home-content {
    grid-template-columns: 1fr;
  }
}

</style>