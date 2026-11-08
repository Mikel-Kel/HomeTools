import { createApp, watch } from "vue";
import App from "./App.vue";
import router from "./router";
import "@/assets/theme.css";

import { restoreLocalDirectory } from "@/services/local/localDirectory";

import { log } from "./utils/logger";
import { checkAppVersion, startVersionWatch } from "@/services/version/versionGuard";
import { checkAppStatus, startAppStatusWatch } from "@/services/appStatus/appStatusGuard";
import { startEnvironmentWatch } from "@/services/environment/environmentGuard";
import { environment } from "@/services/environment/environmentState";
import PageHeader from "@/components/PageHeader.vue";

async function bootstrap() {

  /* ============================
     Étape 0 — Restore Local Drive
  ============================ */
  try {
    await restoreLocalDirectory();
  } catch (e) {
    log.warn("[LocalDrive] restore failed", e);
  }

  const app = createApp(App);

  app.component("PageHeader", PageHeader);

  /* ============================ 
     Gestion globale des erreurs
  ============================ */

  app.config.errorHandler = (err, instance, info) => {
    log.error("[Vue errorHandler]", err);
    log.error("[Vue errorHandler info]", info);
    log.error("[Vue errorHandler instance]", instance);
  };

  window.addEventListener("error", (e) => {
    log.error("[window error]", e.error || e.message, e);
  });

  window.addEventListener("unhandledrejection", (e) => {
    log.error("[unhandledrejection]", e.reason, e);
  });

  /* ============================
     Lancement de l'app Vue
  ============================ */
  app.use(router).mount("#app");

  /* ============================
     Environnement, puis disponibilité et version

     /api/whoami part en premier ; les contrôles de
     maintenance et de version attendent l'environnement.
  ============================ */
  watch(environment, (current, previous) => {
    if (current && !previous) {
      void checkAppStatus(true);
      void checkAppVersion();
    }
  });

  startEnvironmentWatch();
  startVersionWatch();
  startAppStatusWatch();
}

bootstrap();