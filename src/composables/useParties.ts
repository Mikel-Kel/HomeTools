import { ref } from "vue";
import { loadJSONFromFolder } from "@/services/google/driveRepository";
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

  const { folders } = useDrive();

  async function load(): Promise<void> {

    if (loaded.value) return;

    const raw = await loadJSONFromFolder<PartiesFile>(
      folders.value.settings,
      "Parties.json"
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