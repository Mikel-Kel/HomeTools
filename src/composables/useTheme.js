import { ref } from "vue";
const theme = ref(localStorage.getItem("theme") ?? "light");
function applyTheme(value) {
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
