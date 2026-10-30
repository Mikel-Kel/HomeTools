import { ref } from "vue";
import { loadJSONFromFolder } from "@/services/driveAdapter";

import {
  PARTIES_FILE,
  PARTIES_FOLDER,
  readParties,
  type Party,
} from "@/contracts/parties";

export type { Party } from "@/contracts/parties";

/* =========================
   State
========================= */

const parties = ref<Party[]>([]);
const loaded = ref(false);

/* =========================
   Composable
========================= */

export function useParties() {

  async function load(): Promise<void> {

    if (loaded.value) return;

    parties.value = readParties(
      await loadJSONFromFolder<unknown>(
        PARTIES_FOLDER,
        PARTIES_FILE
      )
    ).parties;

    loaded.value = true;

  }

  /*
    Liste relue par la page Master data quand parties.json
    change : les autres pages en profitent sans recharger.
  */
  function set(list: Party[]): void {
    parties.value = list;
    loaded.value = true;
  }

  function getParty(partyID: number): Party | undefined {
    return parties.value.find(p => p.id === partyID);
  }

  return {
    parties,
    load,
    set,
    getParty,
  };

}
