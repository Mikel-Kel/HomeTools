import { ref } from "vue";
import { loadJSONFromFolder } from "@/services/driveAdapter";
import { useDrive } from "@/composables/useDrive";

/* =========================
   Types
========================= */

export interface Party {
  id: number;
  label: string;
}

interface PartiesFile {
  version: number;
  updatedAt?: string;
  parties: Party[];
}

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

    const raw = await loadJSONFromFolder<PartiesFile>(
      "settings",
      "parties.json"
    );

    if (
      !raw ||
      raw.version !== 1 ||
      !Array.isArray(raw.parties)
    ) {
      throw new Error("Invalid Parties.json format");
    }

    parties.value = raw.parties;
    loaded.value = true;

  }

  function getParty(partyID: number): Party | undefined {
    return parties.value.find(p => p.id === partyID);
  }

  return {
    parties,
    load,
    getParty,
  };

}