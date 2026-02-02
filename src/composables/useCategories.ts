import { ref, computed } from "vue";
import { listFilesInFolder, readJSON } from "@/services/google/googleDrive";
import { useDrive } from "@/composables/useDrive";
import { googleAuthenticated } from "@/services/google/googleInit";

/* =========================
   Types
========================= */
export interface SubCategory {
  id: number;
  seq: number;        // ✅ AJOUT
  label: string;
}

export interface Category {
  id: number;
  seq: number;        // ✅ AJOUT
  label: string;
  nature: string;
  subcategories: SubCategory[];
}
interface CategoriesFile {
  version: number;
  updatedAt?: string;
  categories: Category[];
}

/* =========================
   State (singleton)
========================= */
const categories = ref<Category[]>([]);

/* =========================
   Composable
========================= */
export function useCategories() {
  const { driveState } = useDrive();

  /* =========================
     Load from Drive
  ========================= */
  async function load(): Promise<void> {
    if (!driveState.value) return;

    const folderId = driveState.value.folders.settings;
    const files = await listFilesInFolder(folderId);

    const file = files.find(f => f.name === "categories.json");
    if (!file) {
      throw new Error("categories.json not found in settings");
    }

    const raw = await readJSON<CategoriesFile>(file.id);

    if (
      !raw ||
      raw.version !== 1 ||
      !Array.isArray(raw.categories)
    ) {
      throw new Error("Invalid categories.json format");
    }

    // remplacement explicite
    categories.value = raw.categories;
  }

  /* =========================
     Helpers
  ========================= */
  function getCategory(id: number): Category | undefined {
    return categories.value.find(c => c.id === id);
  }

  function getSubcategories(categoryId: number): SubCategory[] {
    return getCategory(categoryId)?.subcategories ?? [];
  }

  const allSubcategories = computed(() =>
    categories.value.flatMap(c => c.subcategories)
  );

  return {
    categories,
    load,
    getCategory,
    getSubcategories,
    allSubcategories,
  };
}