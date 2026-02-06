import { ref, computed } from "vue";
import { listFilesInFolder, readJSON } from "@/services/google/googleDrive";
import { useDrive } from "@/composables/useDrive";
/* =========================
   State (singleton)
========================= */
const categories = ref([]);
/* =========================
   Composable
========================= */
export function useCategories() {
    const { driveState } = useDrive();
    async function load() {
        if (!driveState.value)
            return;
        const folderId = driveState.value.folders.settings;
        const files = await listFilesInFolder(folderId);
        const file = files.find(f => f.name === "categories.json");
        if (!file) {
            throw new Error("categories.json not found in settings");
        }
        const raw = await readJSON(file.id);
        if (!raw ||
            raw.version !== 1 ||
            !Array.isArray(raw.categories)) {
            throw new Error("Invalid categories.json format");
        }
        categories.value = raw.categories;
    }
    function getCategory(id) {
        return categories.value.find(c => c.id === id);
    }
    function getSubcategories(categoryId) {
        return getCategory(categoryId)?.subcategories ?? [];
    }
    const allSubcategories = computed(() => categories.value.flatMap(c => c.subcategories));
    return {
        categories, // ✅ Ref<Category[]>
        load,
        getCategory,
        getSubcategories,
        allSubcategories,
    };
}
