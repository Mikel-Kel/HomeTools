import { ref } from "vue";

import {
  getLocalItem,
  setLocalItem,
} from "@/services/environment/browserStorage";

/* =========================
   Thème clair / sombre

   Mémorisé par environnement (browserStorage.ts) : clair
   jusqu'à ce que l'environnement soit connu, puis thème
   mémorisé (restoreTheme, appelé par main.ts).
========================= */

type Theme = "light" | "dark";

const THEME_KEY = "theme";

const theme = ref<Theme>("light");

function applyTheme(value: Theme) {
  theme.value = value;
  document.documentElement.dataset.theme = value;
}

// appliquer au chargement
applyTheme(theme.value);

export function restoreTheme() {
  const stored = getLocalItem(THEME_KEY);

  if (stored === "light" || stored === "dark") {
    applyTheme(stored);
  }
}

export function useTheme() {
  function toggle() {
    applyTheme(theme.value === "light" ? "dark" : "light");
    setLocalItem(THEME_KEY, theme.value);
  }

  return {
    theme,
    toggle,
  };
}
