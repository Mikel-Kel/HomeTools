import { ref } from "vue";
/* =========================
   State (singleton)
========================= */
const accounts = ref([]);
const records = ref([]);
/* =========================
   Composable
========================= */
// useSpending.ts
export function useSpending() {
    function replaceAll(newAccounts, newRecords) {
        accounts.value = newAccounts;
        records.value = newRecords.map(r => ({
            ...r,
            allocationStatus: "none",
        }));
    }
    function applyAllocationStatus(draftIds, releasedIds) {
        records.value = records.value.map(r => ({
            ...r,
            allocationStatus: releasedIds.has(r.id)
                ? "released"
                : draftIds.has(r.id)
                    ? "draft"
                    : "none",
        }));
    }
    function getRecordsForAccount(accountId) {
        return records.value
            .filter(r => r.accountId === accountId)
            .sort((a, b) => b.date.localeCompare(a.date));
    }
    return {
        accounts,
        records,
        replaceAll,
        applyAllocationStatus,
        getRecordsForAccount,
    };
}
