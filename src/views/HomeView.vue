<script setup lang="ts">
import { computed, watch, ref, onMounted } from "vue";

/* =========================
   Device detection
========================= */
import { detectDevice } from "@/utils/deviceDetection";
const device = detectDevice();

import { useStorageBackend } from "@/composables/useStorageBackend";
const { backend } = useStorageBackend();

import { useAppBootstrap } from "@/composables/useAppBootstrap";
const { loadSettings } = useAppBootstrap();

import { getLocalDirectory } from "@/services/local/localDirectory";

import { loadJSONFromFolder } from "@/services/driveAdapter";
import { formatDate } from "@/utils/dateFormat";

import { useTheme } from "@/composables/useTheme";
const { toggle, theme } = useTheme();

import { useDrive } from "@/composables/useDrive";
const { driveStatus } = useDrive();

import AppTitle from "@/components/AppTitle.vue";
import AppIcon from "@/components/AppIcon.vue";

const appVersion = __APP_VERSION__;

const uiDriveStatus = computed(() => {
  if (backend.value === "LOCAL_DRIVE") {
    if (getLocalDirectory()) return "connected";
    return "disconnected";
  }

  return driveStatus.value === "CONNECTED"
    ? "connected"
    : "disconnected";
});

/* ===============
   Markets indices
================== */
interface MarketIndex {
  id: number;
  code: string;
  value: number;
  change: number;
  ytd: number;
  y1: number | null;
  asOf: string | null;
}

const markets = ref<MarketIndex[]>([]);

/* ===============
   FX Rates
================== */
interface FXRate {
  id: number;
  code: string;
  rate: number;
  change: number;
  ytd: number;
  y1: number | null;
  asOf: string | null;
}

const fxRates = ref<FXRate[]>([]);

const asOf = computed(() => {
  if (markets.value.length) return markets.value[0].asOf;
  if (fxRates.value.length) return fxRates.value[0].asOf;
  return null;
});

onMounted(async () => {
  await loadSettings();
  await loadHomeSummary();
});

async function loadHomeSummary() {
  try {
    const data = await loadJSONFromFolder("settings", "homeSummary.json");

    if (!data?.markets) {
      console.warn("No home summary markets data found");
      markets.value = [];
      fxRates.value = [];
      return;
    }

    markets.value = (data.markets.indices ?? []).map((m: any) => ({
      id: Number(m.id),
      code: String(m.code),
      value: Number(m.close),
      change: Number(m.delta),
      ytd: Number(m.ytd),
      y1: m.y1 === null || m.y1 === undefined ? null : Number(m.y1),
      asOf: m.asOf ?? null,
    }));

    fxRates.value = (data.markets.fx ?? [])
      .filter((f: any) => f.tag === "S")
      .map((f: any) => ({
        id: Number(f.id),
        code: String(f.code),
        rate: Number(f.rate),
        change: Number(f.delta),
        ytd: Number(f.ytd),
        y1: f.y1 === null || f.y1 === undefined ? null : Number(f.y1),
        asOf: f.asOf ?? null,
      }));
  } catch (err) {
    console.error("Failed to load home summary:", err);
    markets.value = [];
    fxRates.value = [];
  }
}

function formatPercent(value: number | null, decimals = 1) {
  if (value === null || Number.isNaN(value)) return "–";
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`;
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

        <!-- MARKETS -->
        <div class="markets">

          <div class="summary-header-grid">
            <span class="col-title-left">Markets</span>
            <span>Closing</span>
            <span>Δ D</span>
            <span>YTD</span>
            <span>1 Y</span>
          </div>

          <div class="summary-list">
            <div v-for="m in markets" :key="m.code" class="summary-item">

              <span class="summary-code">{{ m.code }}</span>

              <span class="summary-value">
                {{ Math.round(m.value).toLocaleString() }}
              </span>

              <span
                class="summary-change"
                :class="{ positive: m.change >= 0, negative: m.change < 0 }"
              >
                {{ formatPercent(m.change, 2) }}
              </span>

              <span
                class="summary-ytd"
                :class="{ positive: m.ytd >= 0, negative: m.ytd < 0 }"
              >
                {{ formatPercent(m.ytd, 1) }}
              </span>

              <span
                class="summary-y1"
                :class="{ positive: (m.y1 ?? 0) >= 0, negative: (m.y1 ?? 0) < 0 }"
              >
                {{ formatPercent(m.y1, 1) }}
              </span>

            </div>
          </div>
        </div>

        <!-- FX -->
        <div v-if="fxRates.length" class="fx">

          <div class="summary-header-grid">
            <span class="col-title-left">FX Rates</span>
            <span>Rate</span>
            <span>Δ D</span>
            <span>YTD</span>
            <span>1 Y</span>
          </div>

          <div class="summary-list">
            <div v-for="f in fxRates" :key="f.code" class="summary-item">

              <span class="summary-code">{{ f.code }}</span>

              <span class="summary-value">
                {{ f.rate.toFixed(4) }}
              </span>

              <span
                class="summary-change"
                :class="{ positive: f.change >= 0, negative: f.change < 0 }"
              >
                {{ formatPercent(f.change, 2) }}
              </span>

              <span
                class="summary-ytd"
                :class="{ positive: f.ytd >= 0, negative: f.ytd < 0 }"
              >
                {{ formatPercent(f.ytd, 1) }}
              </span>

              <span
                class="summary-y1"
                :class="{ positive: (f.y1 ?? 0) >= 0, negative: (f.y1 ?? 0) < 0 }"
              >
                {{ formatPercent(f.y1, 1) }}
              </span>

            </div>
          </div>
        </div>

        <div v-if="asOf" class="markets-asof">
          As of {{ formatDate(asOf, "text") }}
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
  margin-right: 60px;
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
   MARKETS + FX
========================= */

.markets,
.fx {
  max-width: 420px;
}

.fx {
  margin-top: 18px;
}

.summary-header-grid,
.summary-item {
  display: grid;
  grid-template-columns: 70px 1fr 70px 70px 70px;
  align-items: center;
  gap: 12px;
}

.summary-header-grid {
  margin-bottom: 6px;
  font-size: 0.75rem;
  color: var(--text-soft);
}

.col-title-left {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text);
}

.summary-header-grid span:not(:first-child) {
  text-align: right;
  padding-right: 10px;
}

.summary-item {
  padding: 5px 0;
  font-size: 0.85rem;
  border-bottom: 1px solid var(--border);
}

.summary-item:last-child {
  border-bottom: none;
}

.summary-item span:not(:first-child) {
  text-align: right;
}

.summary-code {
  font-weight: 500;
}

.summary-value,
.summary-change,
.summary-ytd,
.summary-y1 {
  font-variant-numeric: tabular-nums;
}

.summary-change.positive,
.summary-ytd.positive,
.summary-y1.positive {
  color: var(--positive);
}

.summary-change.negative,
.summary-ytd.negative,
.summary-y1.negative {
  color: var(--negative);
}

.markets-asof {
  margin-top: 8px;
  text-align: center;
  font-size: 0.7rem;
  color: var(--text-muted);
}

.app-version {
  margin-top: 2rem;
  text-align: center;
  font-size: 0.75rem;
  color: var(--text-muted);
}

@media (max-width: 900px) {
  .home-content {
    grid-template-columns: 1fr;
  }

  .home-right {
    position: static;
    margin-right: 0;
  }
}
</style>