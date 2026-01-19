import { ref } from "vue";
/* =========================
   State (singleton)
========================= */
const accounts = ref([]);
const records = ref([]);
/* =========================
   Composable
========================= */
export function useSpending() {
    function replaceAll(newAccounts, newRecords) {
        accounts.value = newAccounts;
        records.value = newRecords;
    }
    function getRecordsForAccount(accountId) {
        return records.value
            .filter(r => r.accountId === accountId)
            .sort((a, b) => b.date.localeCompare(a.date));
    }
    return {
        // state
        accounts,
        records,
        // actions
        replaceAll,
        getRecordsForAccount,
    };
}
