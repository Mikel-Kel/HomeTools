import { useAllocationTags } from "@/composables/allocations/useAllocationTags";
import { useCategories } from "@/composables/useCategories";

/* =========================
   Libellés d'une allocation

   Catégorie, sous-catégorie et tag tirés des référentiels
   déjà chargés (useCategories, useAllocationTags) ; chaîne
   vide si l'identifiant est absent ou inconnu (tag 0 : sans
   tag).
========================= */

export function useAllocationLabels() {
  const categoriesStore =
    useCategories();

  const tagsStore =
    useAllocationTags();

  function categoryLabel(
    id: number | null
  ): string {
    return id === null
      ? ""
      : categoriesStore.getCategory(id)?.label ?? "";
  }

  function subCategoryLabel(
    categoryID: number | null,
    subCategoryID: number | null
  ): string {
    if (categoryID === null || subCategoryID === null) {
      return "";
    }

    return (
      categoriesStore
        .getSubcategories(categoryID)
        .find(subCategory => subCategory.id === subCategoryID)
        ?.label ?? ""
    );
  }

  function tagLabel(
    id: number | null
  ): string {
    return id
      ? tagsStore.getTag(id)?.tagName ?? ""
      : "";
  }

  return {
    categoryLabel,
    subCategoryLabel,
    tagLabel,
  };
}
