import { createApp, watch } from "vue";
import App from "./App.vue";
import router from "./router";
import "@/assets/theme.css";

import {
  migrateLegacyDirectoryHandle,
  restoreLocalDirectory,
} from "@/services/local/localDirectory";

import { log } from "./utils/logger";
import { checkAppVersion, startVersionWatch } from "@/services/version/versionGuard";
import { checkAppStatus, startAppStatusWatch } from "@/services/appStatus/appStatusGuard";
import { startEnvironmentWatch } from "@/services/environment/environmentGuard";
import { environment, environmentReady } from "@/services/environment/environmentState";
import { migrateLegacyBrowserStorage } from "@/services/environment/browserStorage";
import { syncStorageBackend } from "@/composables/useStorageBackend";
import { restoreTheme } from "@/composables/useTheme";
import PageHeader from "@/components/PageHeader.vue";

/* ============================
   Stockage du navigateur de l'environnement

   Clés préfixées ht:<envId>: (browserStorage.ts) : lues
   seulement une fois l'environnement connu. Migration des
   clés d'avant le contrat, thème, choix du stockage, puis
   dossier Local Drive.
============================ */
async function prepareEnvironmentStorage() {

  migrateLegacyBrowserStorage();

  try {
    await migrateLegacyDirectoryHandle();
  } catch (e) {
    log.warn("[LocalDrive] handle migration failed", e);
  }

  restoreTheme();
  syncStorageBackend();

  try {
    await restoreLocalDirectory();
  } catch (e) {
    log.warn("[LocalDrive] restore failed", e);
  }

  environmentReady.value = true;
}

async function bootstrap() {

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

     /api/whoami part en premier ; le stockage du navigateur
     est ensuite préparé, puis les contrôles de maintenance
     et de version sont lancés.
  ============================ */
  watch(environment, async (current, previous) => {
    if (current && !previous) {
      await prepareEnvironmentStorage();

      void checkAppStatus(true);
      void checkAppVersion();
    }
  });

  startEnvironmentWatch();
  startVersionWatch();
  startAppStatusWatch();
}

bootstrap();