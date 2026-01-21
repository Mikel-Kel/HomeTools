import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import "@/assets/theme.css";

import { initGoogleAPI } from "@/services/google/googleInit"; // ⬅️ ajout
import { log } from "./utils/logger";
import PageHeader from "@/components/PageHeader.vue";

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
     Étape 1 — Init Google (gapi)
     ➜ PAS d'auth, PAS de popup
  ============================ */
  try {
    await initGoogleAPI();
  } catch (e) {
    log.warn("[Google] init failed", e);
  }

  /* ============================
     Lancement de l'app Vue
  ============================ */
  app.use(router).mount("#app");
}

bootstrap();