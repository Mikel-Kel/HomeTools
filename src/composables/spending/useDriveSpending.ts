// src/composables/spending/useDriveSpending.ts
import { computed } from "vue";
import { useDriveJsonFile } from "@/composables/useDriveJsonFile";
import type {
  Account,
  SpendingRecord,
} from "@/composables/spending/useSpending";

/* =========================
   Format Drive
========================= */
export interface SpendingDrivePayload {
  version: 1;
  exportedAt: string;
  accounts: Account[];
  recordsByAccount: SpendingRecord[][];
}

/* =========================
   Composable
========================= */
export function useDriveSpending(spendingFolderId: string) {
  const jsonFile = useDriveJsonFile(
    spendingFolderId,
    "spending.json"
  );

  /* =========================
     Load from Drive
  ========================= */
  async function load(): Promise<SpendingDrivePayload | null> {
    const data = await jsonFile.load();
    if (!data) return null;

    // Validation minimale
    if (
      data.version !== 1 ||
      !Array.isArray(data.accounts) ||
      !Array.isArray(data.recordsByAccount)
    ) {
      throw new Error("Invalid spending.json format");
    }

    return data as SpendingDrivePayload;
  }

  /* =========================
     Save to Drive
  ========================= */
  async function save(
    accounts: Account[],
    recordsByAccount: SpendingRecord[][]
  ): Promise<void> {
    const payload: SpendingDrivePayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      accounts,
      recordsByAccount,
    };

    await jsonFile.save(payload);
  }

  return {
    // state
    busy: jsonFile.busy,
    error: jsonFile.error,

    // actions
    load,
    save,
  };
}