import { ref, computed, type Ref } from "vue";
import { loadJSONFromFolder } from "@/services/driveAdapter";

import {
  CATEGORIES_FILE,
  CATEGORIES_FOLDER,
  readCategories,
  trackedCategories,
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

   Catégories suivies seulement : les catégories hors suivi
   (tracked false) ne sont ni proposées ni affichées par les
   pages qui lisent ce store (Allocation, Budget, Follow-up,
   Ledger). Master data lit categories.json complet.
========================= */

const categories: Ref<Category[]> = ref([]);

/* =========================
   Composable
========================= */

export function useCategories() {

  async function load(): Promise<void> {
    categories.value = trackedCategories(
      readCategories(
        await loadJSONFromFolder<unknown>(
          CATEGORIES_FOLDER,
          CATEGORIES_FILE
        )
      )
    );
  }

  /*
    Liste relue par la page Master data quand categories.json
    change : les autres pages en profitent sans recharger.
  */
  function set(list: Category[]): void {
    categories.value = trackedCategories(list);
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

  /* Catégorie d'une sous-catégorie, null si elle est inconnue. */
  function getCategoryIdOfSubcategory(subCategoryId: number): number | null {
    return (
      categories.value.find(c =>
        c.subcategories.some(s => s.id === subCategoryId)
      )?.id ?? null
    );
  }

  return {
    categories,
    load,
    set,
    getCategory,
    getSubcategories,
    getActiveSubcategories,
    allSubcategories,
    getCategoryIdOfSubcategory,
  };

}
