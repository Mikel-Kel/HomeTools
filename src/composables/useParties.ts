import { ref } from "vue";
import { loadJSONFromFolder } from "@/services/google/driveRepository";
import { useDrive } from "@/composables/useDrive";

export interface Party {
  id: number;
  label: string;
}

interface PartiesFile {
  version: number | string;
  updatedAt?: string;
  parties: Party[];
}

const parties = ref<Party[]>([]);

export function useParties() {

  const { folders } = useDrive();

  async function load(): Promise<void> {

    const raw = await loadJSONFromFolder<PartiesFile>(
      folders.value.settings,
      "Parties.json"
    );

    if (!raw || !Array.isArray(raw.parties)) {
      throw new Error("Invalid Parties.json format");
    }

    parties.value = raw.parties;

  }

  function getParty(id: number): Party | undefined {
    return parties.value.find(p => p.id === id);
  }

  return {
    parties,
    load,
    getParty
  };
}