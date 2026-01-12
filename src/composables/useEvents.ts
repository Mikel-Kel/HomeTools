// src/composables/useEvents.ts
import { ref } from 'vue'
import type { AppEvent } from '@/events/eventModels'

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
    console.warn('[events] corrupted localStorage, reset')
    return []
  }
}

function saveToStorage(list: AppEvent[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

/* =========================
   State (SINGLETON)
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

  return {
    events,   // ✅ ON EXPOSE LA REF
    emit,
    clear,
  }
}