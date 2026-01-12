// src/composables/useSpending.ts
import { ref } from 'vue'

/* =========================
   Types
========================= */
export interface Account {
  id: string
  label: string
}

export interface SpendingRecord {
  id: string
  date: string
  party: string
  amount: number
}

/* =========================
   Composable
========================= */
export function useSpending() {
  const accounts = ref<Account[]>([])
  const recordsByAccount = ref<SpendingRecord[][]>([])

  /* =========================
     Loader (mock pour l’instant)
     → remplacé par replay d’événements
  ========================= */
  function load() {
    accounts.value = [
      { id: 'CHK', label: 'Checking account' },
      { id: 'SAV', label: 'Savings account' },
    ]

    recordsByAccount.value = [
      [
        {
          id: '1',
          date: '2026-01-10',
          party: 'Migros',
          amount: -42.5,
        },
        {
          id: '2',
          date: '2026-01-11',
          party: 'Salary',
          amount: 3200,
        },
      ],
      [
        {
          id: '3',
          date: '2026-01-05',
          party: 'Interest',
          amount: 12.3,
        },
      ],
    ]
  }

  /* =========================
     API publique
  ========================= */
  function getRecordsForAccount(index: number): SpendingRecord[] {
    return recordsByAccount.value[index] ?? []
  }

  return {
    accounts,
    recordsByAccount,

    load,
    getRecordsForAccount,
  }
}