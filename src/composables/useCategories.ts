import { ref, computed, type Ref } from "vue";
import { listFilesInFolder, readJSON } from "@/services/google/googleDrive";
import { useDrive } from "@/composables/useDrive";

/* =========================
   Types
========================= */
export interface SubCategory {
  id: number;
  seq: number;
  label: string;
  budgets?: BudgetYear[];
}

export interface Category {
  id: number;
  seq: number;
  label: string;
  nature: string;
  subcategories: SubCategory[];
  budgets?: BudgetYear[];
}

interface CategoriesFile {
  version: number;
  updatedAt?: string;
  categories: Category[];
}

export interface BudgetItem {
  budget: number;
}

export interface BudgetYear {
  year: number;
  items: BudgetItem[];
}

/* =========================
   State (singleton)
========================= */
const categories: Ref<Category[]> = ref([]);

/* =========================
   Composable
========================= */
export function useCategories() {
  const { driveState } = useDrive();

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

    categories.value = raw.categories;
  }

  function getCategory(id: number): Category | undefined {
    return categories.value.find(c => c.id === id);
  }

  function getSubcategories(categoryId: number): SubCategory[] {
    return getCategory(categoryId)?.subcategories ?? [];
  }

  const allSubcategories = computed<SubCategory[]>(() =>
    categories.value.flatMap(c => c.subcategories)
  );

  return {
    categories,          // ✅ Ref<Category[]>
    load,
    getCategory,
    getSubcategories,
    allSubcategories,
  };
}