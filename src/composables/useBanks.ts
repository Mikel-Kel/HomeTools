import { ref } from "vue";
import { listFilesInFolder, readJSON } from "@/services/google/googleDrive";
import { useDrive } from "@/composables/useDrive";

/* =========================
   Types
========================= */
export interface Bank {
  id: string; // 3 chars (from FITID)
  label: string;
}

interface BanksFile {
  version: number;
  updatedAt?: string;
  banks: Bank[];
}

/* =========================
   State (singleton)
========================= */
const banks = ref<Bank[]>([]);

/* =========================
   Composable
========================= */
export function useBanks() {
  const { driveState } = useDrive();

  /* =========================
     Load from Drive
  ========================= */
  async function load(): Promise<void> {
    if (!driveState.value) return;

    const folderId = driveState.value.folders.settings;
    const files = await listFilesInFolder(folderId);

    const file = files.find(f => f.name === "banks.json");
    if (!file) {
      throw new Error("banks.json not found in settings");
    }

    const raw = await readJSON<BanksFile>(file.id);

    if (
      !raw ||
      raw.version !== 1 ||
      !Array.isArray(raw.banks)
    ) {
      throw new Error("Invalid banks.json format");
    }

    // remplacement explicite
    banks.value = raw.banks;
  }

  /* =========================
     Helpers
  ========================= */
  function getBank(bankID: string): Bank | undefined {
    return banks.value.find(b => b.id === bankID);
  }

  return {
    banks,
    load,
    getBank,
  };
}