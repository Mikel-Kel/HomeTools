import { ref, computed } from "vue";
import { listFilesInFolder, readJSON } from "@/services/google/googleDrive";
import { useDrive } from "@/composables/useDrive";

/* =========================
   Types
========================= */
export interface SubCategory {
  id: number;
  label: string;
}

export interface Category {
  id: number;
  label: string;
  nature: string;
  subcategories: SubCategory[];
}

/* =========================
   State (singleton)
========================= */
const categories = ref<Category[]>([]);
const loaded = ref(false);

/* =========================
   Composable
========================= */
export function useCategories() {
  const { driveState } = useDrive();

  /* =========================
     Load from Drive
  ========================= */
  async function load(): Promise<void> {
    if (loaded.value) return;
    if (!driveState.value) return;

    const folderId = driveState.value.folders.settings;
    const files = await listFilesInFolder(folderId);

    const file = files.find(f => f.name === "categories.json");
    if (!file) {
      throw new Error("categories.json not found in settings");
    }

    const raw = await readJSON(file.id);

    if (
      !raw ||
      raw.version !== 1 ||
      !Array.isArray(raw.categories)
    ) {
      throw new Error("Invalid categories.json format");
    }

    categories.value = raw.categories;
    loaded.value = true;
  }

  /* =========================
     Helpers
  ========================= */
  function getCategory(id: number): Category | undefined {
    return categories.value.find(c => c.id === id);
  }

  function getSubcategories(categoryId: number): SubCategory[] {
    return (
      getCategory(categoryId)?.subcategories ?? []
    );
  }

  const allSubcategories = computed(() =>
    categories.value.flatMap(c => c.subcategories)
  );

  return {
    // state
    categories,
    loaded,

    // actions
    load,

    // helpers
    getCategory,
    getSubcategories,
    allSubcategories,
  };
}