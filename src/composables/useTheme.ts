import { ref } from "vue";

const theme = ref<"light" | "dark">(
  (localStorage.getItem("theme") as "light" | "dark") ?? "light"
);

function applyTheme(value: "light" | "dark") {
  theme.value = value;
  document.documentElement.dataset.theme = value;
  localStorage.setItem("theme", value);
}

// appliquer au chargement
applyTheme(theme.value);

export function useTheme() {
  function toggle() {
    applyTheme(theme.value === "light" ? "dark" : "light");
  }

  return {
    theme,
    toggle,
  };
}