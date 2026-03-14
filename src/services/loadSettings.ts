import { useBanks } from "@/composables/useBanks";
import { useParties } from "@/composables/useParties";
import { useAllocationTags } from "@/composables/allocations/useAllocationTags";
import { useCategories } from "@/composables/useCategories";

let loaded = false;

export async function loadSettings(): Promise<void> {

  if (loaded) return;

  const banksStore = useBanks();
  const partiesStore = useParties();
  const tagsStore = useAllocationTags();
  const categoriesStore = useCategories();

  await Promise.all([
    banksStore.load(),
    partiesStore.load(),
    tagsStore.load(),
    categoriesStore.load()
  ]);

  loaded = true;
}