import { ref } from "vue";
import { loadJSONFromFolder } from "@/services/driveAdapter";

import {
  readTransferTypes,
  TRANSFER_TYPES_FILE,
  TRANSFER_TYPES_FOLDER,
  type TransferType,
} from "@/contracts/transferTypes";

export type { TransferType } from "@/contracts/transferTypes";

/* =========================
   State
========================= */

const transferTypes = ref<TransferType[]>([]);
const loaded = ref(false);

/* =========================
   Composable
========================= */

export function useTransferTypes() {

  async function load(): Promise<void> {

    if (loaded.value) return;

    transferTypes.value = readTransferTypes(
      await loadJSONFromFolder<unknown>(
        TRANSFER_TYPES_FOLDER,
        TRANSFER_TYPES_FILE
      )
    ).transferTypes;

    loaded.value = true;

  }

  /*
    Liste relue par la page Master data quand
    transferTypes.json change : les autres pages en
    profitent sans recharger.
  */
  function set(list: TransferType[]): void {
    transferTypes.value = list;
    loaded.value = true;
  }

  function getTransferType(id: number): TransferType | undefined {
    return transferTypes.value.find(type => type.id === id);
  }

  return {
    transferTypes,
    load,
    set,
    getTransferType,
  };

}
