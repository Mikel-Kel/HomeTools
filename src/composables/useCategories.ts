import { ref, computed, type Ref } from "vue";
import { loadJSONFromFolder } from "@/services/google/driveRepository";
import { useDrive } from "@/composables/useDrive";

/* =========================
   Types
========================= */

export type CategoryNature = "-" | "I" | "E";
export type CategoryDisplayScope = "P" | "S" | "X";

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

  /* 👇 nouveaux champs métier */
  nature: CategoryNature;
  displayScope: CategoryDisplayScope;

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

  const { folders } = useDrive();

  async function load(): Promise<void> {

    const raw = await loadJSONFromFolder<CategoriesFile>(
      folders.value.settings,
      "categories.json"
    );

    if (
      !raw ||
      raw.version !== 1 ||
      !Array.isArray(raw.categories)
    ) {
      throw new Error("Invalid categories.json format");
    }

    /* JSON already matches Category interface */
    categories.value = raw.categories
      .map(c => ({
        ...c,
        subcategories: (c.subcategories ?? [])
          .slice()
          .sort((a, b) => a.seq - b.seq)
      }))
      .slice()
      .sort((a, b) => a.seq - b.seq);

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
    categories,
    load,
    getCategory,
    getSubcategories,
    allSubcategories,
  };

}