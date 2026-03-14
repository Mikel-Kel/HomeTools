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

  const raw = await loadJSONFromFolder<any>(
    folders.value.settings,
    "parties.json"
  );

  console.log("PARTIES RAW =", raw);
  console.log("TYPEOF RAW =", typeof raw);

  if (raw) {
    console.log("RAW KEYS =", Object.keys(raw));
    console.log("RAW.VERSION =", raw.version);
    console.log("RAW.PARTIES =", raw.parties);
    console.log("IS ARRAY =", Array.isArray(raw.parties));
  }

  if (!raw || !Array.isArray(raw.parties)) {
    throw new Error("Invalid Parties.json format");
  }

  parties.value = raw.parties;
}

/*  async function load(): Promise<void> {

    const raw = await loadJSONFromFolder<PartiesFile>(
      folders.value.settings,
      "parties.json"
    );

    if (!raw || !Array.isArray(raw.parties)) {
      throw new Error("Invalid Parties.json format");
    }

    parties.value = raw.parties;

  }*/

  function getParty(id: number): Party | undefined {
    return parties.value.find(p => p.id === id);
  }

  return {
    parties,
    load,
    getParty
  };
}