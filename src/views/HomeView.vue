<script setup lang="ts">
import {
  computed,
  onMounted,
  ref,
} from "vue";

/* =========================
   Device detection
========================= */

import {
  detectDevice,
} from "@/utils/deviceDetection";

const device =
  detectDevice();

/* =========================
   Number formatting
========================= */

import {
  formatAmount,
  formatInteger,
} from "@/utils/amountFormat";

/* =========================
   Storage access
========================= */

import {
  useStorageAccess,
} from "@/composables/useStorageAccess";

const {
  backend,
  storageReady,
  storageUnavailableMessage,
  ensureStorageReady,
} = useStorageAccess();

const uiStorageStatus =
  computed(() =>
    storageReady.value
      ? "connected"
      : "disconnected"
  );

const storageStatusLabel =
  computed(() => {
    if (!storageReady.value) {
      return (
        storageUnavailableMessage.value ||
        `HomeTools not available (${device})`
      );
    }

    switch (backend.value) {
      case "LOCAL_DRIVE":
        return "App ready (local)";

      case "GOOGLE_DRIVE":
        return "App ready (Google Drive)";

      case "OBJECT_STORAGE":
        return "App ready (Object Storage)";

      default:
        return "App ready";
    }
  });

/* =========================
   Bootstrap
========================= */

import {
  useAppBootstrap,
} from "@/composables/useAppBootstrap";

const {
  loadSettings,
} = useAppBootstrap();

/* =========================
   Data access
========================= */

import {
  useRemoteJson,
} from "@/composables/useRemoteJson";

import {
  APP_PARAMETERS_FILE,
  APP_PARAMETERS_FOLDER,
  HOME_MESSAGES_FILE,
  HOME_MESSAGES_FOLDER,
  HOME_SUMMARY_FILE,
  HOME_SUMMARY_FOLDER,
  readHomeMessages,
  readHomeSummary,
  readSecurityParameters,
  type SecurityQuote,
} from "@/contracts/home";

import {
  formatDate,
} from "@/utils/dateFormat";

/* =========================
   Theme
========================= */

import {
  useTheme,
} from "@/composables/useTheme";

const {
  toggle,
  theme,
} = useTheme();

/* =========================
   Components
========================= */

import AppTitle from "@/components/AppTitle.vue";
import AppIcon from "@/components/AppIcon.vue";

/* =========================
   App version
========================= */

const appVersion =
  __APP_VERSION__;

/* =========================
   Data

   Contrat des fichiers : src/contracts/home.ts. Les trois
   fichiers sont relus dès qu’ils changent sur le stockage.
========================= */

const summary =
  useRemoteJson({
    folder:
      HOME_SUMMARY_FOLDER,

    file:
      HOME_SUMMARY_FILE,

    read:
      readHomeSummary,

    optional:
      true,
  });

const securityParameters =
  useRemoteJson({
    folder:
      APP_PARAMETERS_FOLDER,

    file:
      APP_PARAMETERS_FILE,

    read:
      readSecurityParameters,
  });

/*
  Messages du jour : réinitialisés par le housekeeping de la
  nuit, puis complétés par chaque avertissement ou erreur de
  la journée (événements, exécutions manuelles). Ils ne sont
  plus affichés, mais donnent l’état de la pastille du menu
  Housekeeping. Un problème de lecture est sans effet sur le
  reste de la page.
*/
const messages =
  useRemoteJson({
    folder:
      HOME_MESSAGES_FOLDER,

    file:
      HOME_MESSAGES_FILE,

    read:
      readHomeMessages,

    optional:
      true,
  });

const markets =
  computed(() =>
    summary.data.value?.indices ?? []
  );

const fxRates =
  computed(() =>
    summary.data.value?.fx ?? []
  );

interface SecuritySummary
  extends SecurityQuote {
  description: string;
  isin: string | null;
  currency: string | null;
  value: number;
}

/*
  Les titres suivent l’ordre de securities.list
  (AppParameters.json) ; un titre désactivé, ou sans cours
  dans homeSummary.json, n’est pas affiché.
*/
const securities =
  computed<SecuritySummary[]>(() => {
    const quotes =
      new Map(
        (summary.data.value?.securities ?? []).map(
          quote => [
            quote.code,
            quote,
          ]
        )
      );

    return (securityParameters.data.value ?? [])
      .map(
        (parameter): SecuritySummary | null => {
          const quote =
            quotes.get(
              parameter.code
            );

          if (
            !quote ||
            quote.value === null
          ) {
            return null;
          }

          return {
            ...quote,
            value: quote.value,
            description: parameter.description,
            isin: parameter.isin,
            currency: parameter.currency,
          };
        }
      )
      .filter(
        (security): security is SecuritySummary =>
          security !== null
      );
  });

const homeMessages =
  computed(() =>
    messages.data.value ?? []
  );

/*
  État général de la journée : le niveau le plus grave des
  messages. Aucun message = pas de pastille.
*/
const housekeepingHealth =
  computed(() => {
    const levels =
      homeMessages.value.map(
        message => message.level
      );

    if (!levels.length) {
      return null;
    }

    if (levels.includes("error")) {
      return "error";
    }

    return levels.includes("warning")
      ? "warning"
      : "ok";
  });

const housekeepingHealthTitle =
  computed(() => {
    const errors =
      homeMessages.value.filter(
        message =>
          message.level === "error"
      ).length;

    const warnings =
      homeMessages.value.filter(
        message =>
          message.level === "warning"
      ).length;

    if (!errors && !warnings) {
      return "No problem since the nightly run";
    }

    return [
      errors
        ? `${errors} error${errors > 1 ? "s" : ""}`
        : "",

      warnings
        ? `${warnings} warning${warnings > 1 ? "s" : ""}`
        : "",
    ]
      .filter(Boolean)
      .join(", ") +
      " since the nightly run";
  });

const asOf =
  computed(() => {
    const dates = [
      ...markets.value.map(
        (item) => item.asOf
      ),

      ...fxRates.value.map(
        (item) => item.asOf
      ),

      ...securities.value.map(
        (item) => item.asOf
      ),
    ].filter(
      (value): value is string =>
        Boolean(value)
    );

    if (!dates.length) {
      return null;
    }

    /*
      Les dates ISO se trient naturellement ; la plus
      récente toutes sections confondues est affichée.
    */
    return dates.sort().at(-1) ?? null;
  });

/* =========================
   Status
========================= */

const bootstrapping =
  ref(false);

const bootstrapError =
  ref<string | null>(null);

const loading =
  computed(() =>
    bootstrapping.value ||
    summary.loading.value
  );

const loadError =
  computed(() =>
    bootstrapError.value ??
    summary.error.value ??
    securityParameters.error.value
  );

/* =========================
   Initialization
========================= */

/*
  Connexion au stockage et référentiels communs ; les
  fichiers de la page se chargent dès que le stockage est
  prêt.
*/
async function initializeHome() {
  if (bootstrapping.value) {
    return;
  }

  bootstrapping.value = true;
  bootstrapError.value = null;

  try {
    const ready =
      await ensureStorageReady();

    if (!ready) {
      return;
    }

    await loadSettings();

  } catch (err) {
    bootstrapError.value =
      err instanceof Error
        ? err.message
        : String(err);

  } finally {
    bootstrapping.value = false;
  }
}

onMounted(async () => {
  await initializeHome();
});

/* =========================
   Formatting
========================= */

function formatPercent(
  value: number | null,
  decimals = 1
): string {
  if (
    value === null ||
    Number.isNaN(value)
  ) {
    return "–";
  }

  return (
    `${value >= 0 ? "+" : ""}` +
    `${value.toFixed(decimals)}%`
  );
}

function performanceClass(
  value: number | null
): {
  positive: boolean;
  negative: boolean;
} {
  return {
    positive:
      value !== null &&
      value >= 0,

    negative:
      value !== null &&
      value < 0,
  };
}
</script>

<template>
  <div class="homepage">
    <!-- =========================
         Header
    ========================== -->

    <div class="home-header">
      <div class="title-block">
        <AppTitle
          text="Welcome"
          icon="home"
          :icon-size="64"
        />

        <div
          class="storage-status"
          :class="uiStorageStatus"
        >
          <span class="dot"></span>

          <span class="status-text">
            {{ storageStatusLabel }}
          </span>
        </div>
      </div>

      <button
        type="button"
        class="theme-toggle"
        @click="toggle"
      >
        <AppIcon
          :name="
            theme === 'dark'
              ? 'sun'
              : 'moon'
          "
          :size="24"
        />
      </button>
    </div>

    <!-- =========================
         Storage status
    ========================== -->

    <div
      v-if="loading"
      class="home-message"
    >
      Loading HomeTools…
    </div>

    <div
      v-else-if="loadError"
      class="home-message error"
    >
      {{ loadError }}
    </div>

    <!-- =========================
         Content
    ========================== -->

    <div class="home-content">
      <!-- LEFT -->

      <div class="home-left">
        <ul class="menu">
          <li>
            <router-link
              to="/authentication"
              class="menu-item"
            >
              <AppIcon
                name="locker"
                :size="32"
              />

              <span>
                Authentication
              </span>
            </router-link>
          </li>

          <li>
            <router-link
              to="/spending"
              class="menu-item"
            >
              <AppIcon
                name="spending"
                :size="32"
              />

              <span>
                Spending
              </span>
            </router-link>
          </li>

          <li>
            <router-link
              to="/follow-up"
              class="menu-item"
            >
              <AppIcon
                name="followup"
                :size="32"
              />

              <span>
                Follow-up
              </span>
            </router-link>
          </li>

          <li>
            <router-link
              to="/budget"
              class="menu-item"
            >
              <AppIcon
                name="budget"
                :size="32"
              />

              <span>
                Budget
              </span>
            </router-link>
          </li>

          <li>
            <router-link
              to="/indicators"
              class="menu-item"
            >
              <AppIcon
                name="indicators"
                :size="32"
              />

              <span>
                Indicators
              </span>
            </router-link>
          </li>

          <li>
            <router-link
              to="/documentsArchive"
              class="menu-item"
            >
              <AppIcon
                name="bookshelf"
                :size="32"
              />

              <span>
                Archives
              </span>
            </router-link>
          </li>

          <li>
            <router-link
              to="/housekeeping"
              class="menu-item"
            >
              <AppIcon
                name="pages_warning"
                :size="32"
              />

              <span>
                Housekeeping
              </span>

              <span
                v-if="housekeepingHealth"
                class="status-dot menu-status-dot"
                :class="housekeepingHealth"
                :title="housekeepingHealthTitle"
                :aria-label="housekeepingHealthTitle"
              ></span>
            </router-link>
          </li>
        </ul>
      </div>

      <!-- RIGHT -->

      <div class="home-right">
        <!-- MARKETS -->

        <div
          v-if="markets.length"
          class="summary-section markets"
        >
          <div class="summary-header-grid">
            <span class="col-title-left">
              Markets
            </span>

            <span>Closing</span>
            <span>Δ D</span>
            <span>YTD</span>
            <span>1 Y</span>
          </div>

          <div class="summary-list">
            <div
              v-for="market in markets"
              :key="market.code"
              class="summary-item"
            >
              <span class="summary-code">
                {{ market.code }}
              </span>

              <span class="summary-value">
                {{
                  formatInteger(
                    market.value
                  )
                }}
              </span>

              <span
                class="summary-change"
                :class="
                  performanceClass(
                    market.change
                  )
                "
              >
                {{
                  formatPercent(
                    market.change,
                    2
                  )
                }}
              </span>

              <span
                class="summary-ytd"
                :class="
                  performanceClass(
                    market.ytd
                  )
                "
              >
                {{
                  formatPercent(
                    market.ytd,
                    1
                  )
                }}
              </span>

              <span
                class="summary-y1"
                :class="
                  performanceClass(
                    market.y1
                  )
                "
              >
                {{
                  formatPercent(
                    market.y1,
                    1
                  )
                }}
              </span>
            </div>
          </div>
        </div>

        <!-- FX -->

        <div
          v-if="fxRates.length"
          class="summary-section fx"
        >
          <div class="summary-header-grid">
            <span class="col-title-left">
              FX Rates
            </span>

            <span>Rate</span>
            <span>Δ D</span>
            <span>YTD</span>
            <span>1 Y</span>
          </div>

          <div class="summary-list">
            <div
              v-for="rate in fxRates"
              :key="rate.code"
              class="summary-item"
            >
              <span class="summary-code">
                {{ rate.code }}
              </span>

              <span class="summary-value">
                {{ rate.rate.toFixed(4) }}
              </span>

              <span
                class="summary-change"
                :class="
                  performanceClass(
                    rate.change
                  )
                "
              >
                {{
                  formatPercent(
                    rate.change,
                    2
                  )
                }}
              </span>

              <span
                class="summary-ytd"
                :class="
                  performanceClass(
                    rate.ytd
                  )
                "
              >
                {{
                  formatPercent(
                    rate.ytd,
                    1
                  )
                }}
              </span>

              <span
                class="summary-y1"
                :class="
                  performanceClass(
                    rate.y1
                  )
                "
              >
                {{
                  formatPercent(
                    rate.y1,
                    1
                  )
                }}
              </span>
            </div>
          </div>
        </div>

        <!-- SECURITIES -->

        <div
          v-if="securities.length"
          class="summary-section securities"
        >
          <div class="summary-header-grid">
            <span class="col-title-left">
              Securities
            </span>

            <span>Closing</span>
            <span>Δ D</span>
            <span>YTD</span>
            <span>1 Y</span>
          </div>

          <div class="summary-list">
            <div
              v-for="security in securities"
              :key="security.code"
              class="summary-item"
            >
              <span
                class="summary-code security-code"
                :title="
                  security.description
                "
              >
                {{ security.code }}
              </span>

              <span
                class="summary-value"
                :title="
                  security.currency ?? ''
                "
              >
                {{
                  formatAmount(
                    security.value
                  )
                }}
              </span>

              <span
                class="summary-change"
                :class="
                  performanceClass(
                    security.change
                  )
                "
              >
                {{
                  formatPercent(
                    security.change,
                    2
                  )
                }}
              </span>

              <span
                class="summary-ytd"
                :class="
                  performanceClass(
                    security.ytd
                  )
                "
              >
                {{
                  formatPercent(
                    security.ytd,
                    1
                  )
                }}
              </span>

              <span
                class="summary-y1"
                :class="
                  performanceClass(
                    security.y1
                  )
                "
              >
                {{
                  formatPercent(
                    security.y1,
                    1
                  )
                }}
              </span>
            </div>
          </div>
        </div>

        <div
          v-if="asOf"
          class="markets-asof"
        >
          As of
          {{
            formatDate(
              asOf,
              "text"
            )
          }}
        </div>
      </div>
    </div>

    <!-- =========================
         Version
    ========================== -->

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

/* =========================
   Storage status
========================= */

.storage-status {
  display: flex;
  align-items: center;
  gap: 8px;

  margin-left: 76px;
  margin-top: -40px;

  font-size: 0.85rem;
  color: var(--text-soft);
}

.storage-status .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.storage-status.connected .dot {
  background: var(--positive);
}

.storage-status.disconnected .dot {
  background: var(--negative);
}

.storage-status.connected {
  color: var(--positive);
}

.storage-status.disconnected {
  color: var(--negative);
}

/* =========================
   Title
========================= */

:deep(.app-title h1),
:deep(.app-title h2) {
  line-height: 1.1;
  margin-top: -0.6rem;
}

/* =========================
   Theme
========================= */

.theme-toggle {
  padding: 6px;

  border: 1px solid transparent;
  border-radius: 8px;

  background: transparent;

  cursor: pointer;
}

.theme-toggle:hover {
  background: var(--primary-soft);
}

/* =========================
   Messages
========================= */

.home-message {
  margin-top: 1rem;
  padding: 0.75rem 1rem;

  border: 1px solid var(--border);
  border-radius: 8px;

  background: var(--surface);
  color: var(--text-soft);
}

.home-message.error {
  color: var(--negative);
}

/* =========================
   Layout
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
  margin-right: 60px;
}

/* =========================
   Menu
========================= */

.menu {
  margin-top: 1.5rem;
  padding: 0;

  list-style: none;
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
   Summary
========================= */

.summary-section {
  width: 100%;
  max-width: 460px;
}

.summary-section +
.summary-section {
  margin-top: 18px;
}

.summary-header-grid,
.summary-item {
  display: grid;

  grid-template-columns:
    120px
    1fr
    70px
    70px
    70px;

  align-items: center;
  gap: 12px;
}

.summary-header-grid {
  margin-bottom: 6px;

  font-size: 0.75rem;
  color: var(--text-soft);
}

.col-title-left {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text);
}

.summary-header-grid
span:not(:first-child) {
  padding-right: 10px;
  text-align: right;
}

.summary-item {
  padding: 5px 0;

  border-bottom:
    1px solid
    var(--border);

  font-size: 0.85rem;
}

.summary-item:last-child {
  border-bottom: none;
}

.summary-item
span:not(:first-child) {
  text-align: right;
}

.summary-code {
  overflow: hidden;

  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.security-code {
  cursor: help;
}

.summary-value,
.summary-change,
.summary-ytd,
.summary-y1 {
  font-variant-numeric:
    tabular-nums;
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

/* =========================
   Status dot
========================= */

.status-dot {
  flex-shrink: 0;

  width: 8px;
  height: 8px;
  border-radius: 50%;
}

/*
  Pastille d’état du menu Housekeeping, juste après son
  libellé.
*/
.menu-status-dot {
  width: 12px;
  height: 12px;
}

.status-dot.ok {
  background: var(--positive);
}

.status-dot.warning {
  background: var(--warning);
}

.status-dot.error {
  background: var(--negative);
}

/* =========================
   Version
========================= */

.app-version {
  margin-top: 2rem;

  text-align: center;

  font-size: 0.75rem;
  color: var(--text-muted);
}

/* =========================
   Responsive
========================= */

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