import { ref } from "vue";
import { loadJSONFromFolder } from "@/services/driveAdapter";
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

  /* =========================
     Load banks
  ========================= */

  async function load(): Promise<void> {

    const raw = await loadJSONFromFolder<BanksFile>(
      "settings",
      "banks.json"
    );

    if (
      !raw ||
      raw.version !== 1 ||
      !Array.isArray(raw.banks)
    ) {
      throw new Error("Invalid banks.json format");
    }

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