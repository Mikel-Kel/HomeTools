import { ref } from "vue";
import { loadJSONFromFolder } from "@/services/driveAdapter";

import {
  ALLOCATION_TAGS_FILE,
  ALLOCATION_TAGS_FOLDER,
  readAllocationTags,
  type AllocationTag,
} from "@/contracts/allocationTags";

export type { AllocationTag } from "@/contracts/allocationTags";

/* =========================
   State
========================= */

const tags = ref<AllocationTag[]>([]);
const loaded = ref(false);

/* =========================
   Composable
========================= */

export function useAllocationTags() {

  async function load(): Promise<void> {

    if (loaded.value) return;

    tags.value = readAllocationTags(
      await loadJSONFromFolder<unknown>(
        ALLOCATION_TAGS_FOLDER,
        ALLOCATION_TAGS_FILE
      )
    );

    loaded.value = true;

  }

  /*
    Liste relue par la page Master data quand
    allocationTags.json change : les autres pages en
    profitent sans recharger.
  */
  function set(list: AllocationTag[]): void {
    tags.value = list;
    loaded.value = true;
  }

  function getTag(id: number): AllocationTag | undefined {
    return tags.value.find(t => t.id === id);
  }

  return {
    tags,
    load,
    set,
    getTag,
  };

}
