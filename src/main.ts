import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";

const app = createApp(App);

app.config.errorHandler = (err, instance, info) => {
  console.error("[Vue errorHandler]", err);
  console.error("[Vue errorHandler info]", info);
  console.error("[Vue errorHandler instance]", instance);
};

window.addEventListener("error", (e) => {
  console.error("[window error]", e.error || e.message, e);
});

window.addEventListener("unhandledrejection", (e) => {
  console.error("[unhandledrejection]", e.reason, e);
});

app.use(router).mount("#app");