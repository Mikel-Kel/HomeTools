import { ref, computed, type Ref } from "vue";
import { loadJSONFromFolder } from "@/services/driveAdapter";

import {
  CATEGORIES_FILE,
  CATEGORIES_FOLDER,
  readCategories,
  type Category,
  type SubCategory,
} from "@/contracts/categories";

export type {
  Category,
  CategoryDisplayScope,
  CategoryNature,
  SubCategory,
  SubCategoryStatus,
} from "@/contracts/categories";

/* =========================
   State (singleton)
========================= */

const categories: Ref<Category[]> = ref([]);

/* =========================
   Composable
========================= */

export function useCategories() {

  async function load(): Promise<void> {
    categories.value = readCategories(
      await loadJSONFromFolder<unknown>(
        CATEGORIES_FOLDER,
        CATEGORIES_FILE
      )
    );
  }

  /*
    Liste relue par la page Master data quand categories.json
    change : les autres pages en profitent sans recharger.
  */
  function set(list: Category[]): void {
    categories.value = list;
  }

  function getCategory(id: number): Category | undefined {
    return categories.value.find(c => c.id === id);
  }

  function getSubcategories(categoryId: number): SubCategory[] {
    return getCategory(categoryId)?.subcategories ?? [];
  }

  function getActiveSubcategories(categoryId: number): SubCategory[] {
    return getSubcategories(categoryId).filter(s => s.status === "A");
  }

  const allSubcategories = computed<SubCategory[]>(() =>
    categories.value.flatMap(c => c.subcategories)
  );

  return {
    categories,
    load,
    set,
    getCategory,
    getSubcategories,
    getActiveSubcategories,
    allSubcategories,
  };

}
