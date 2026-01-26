import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "url";
import pkg from "./package.json";

export default defineConfig({
  base: "/HomeTools/",
  plugins: [vue()],
  define: {__APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    allowedHosts: [
      "webcams-chain-pleased-stands.trycloudflare.com",
    ],
  },
});