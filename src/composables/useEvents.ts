// src/composables/useEvents.ts
import { ref } from 'vue'
import type { AppEvent } from '@/events/eventModels'
import { log } from '@/utils/logger'

/* =========================
   Storage config
========================= */
const STORAGE_KEY = 'home-tools-events-v1'

/* =========================
   Utils
========================= */
function uuid(): string {
  return crypto.randomUUID()
}

function now(): string {
  return new Date().toISOString()
}

function loadFromStorage(): AppEvent[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    log.warn('[events] corrupted localStorage, reset')
    return []
  }
}

function saveToStorage(list: AppEvent[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

/* =========================
   State (singleton)
========================= */
const events = ref<AppEvent[]>(loadFromStorage())

/* =========================
   API
========================= */
export function useEvents() {
  function emit<E extends AppEvent>(event: Omit<E, 'id' | 'timestamp'>) {
    const fullEvent = {
      ...event,
      id: uuid(),
      timestamp: now(),
    } as E

    events.value.push(fullEvent)
    saveToStorage(events.value)
  }

  function clear() {
    events.value = []
    saveToStorage([])
  }

  /* =========================
     Export / Import
  ========================= */

  function exportJSON(): string {
    return JSON.stringify(
      {
        version: 1,
        exportedAt: now(),
        events: events.value,
      },
      null,
      2
    )
  }

  function importJSON(json: string) {
    try {
      const parsed = JSON.parse(json)

      if (!parsed || !Array.isArray(parsed.events)) {
        throw new Error('Invalid events.json format')
      }

      events.value = parsed.events
      saveToStorage(events.value)
    } catch (err) {
      alert('Import failed: invalid file')
      log.error(err)
    }
  }

  return {
    events,
    emit,
    clear,

    exportJSON,
    importJSON,
  }
}