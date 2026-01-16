// src/composables/useEvents.ts
import { ref } from 'vue';
/* =========================
   Storage config
========================= */
const STORAGE_KEY = 'home-tools-events-v1';
/* =========================
   Utils
========================= */
function uuid() {
    return crypto.randomUUID();
}
function now() {
    return new Date().toISOString();
}
function loadFromStorage() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw)
        return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        console.warn('[events] corrupted localStorage, reset');
        return [];
    }
}
function saveToStorage(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}
/* =========================
   State (singleton)
========================= */
const events = ref(loadFromStorage());
/* =========================
   API
========================= */
export function useEvents() {
    function emit(event) {
        const fullEvent = {
            ...event,
            id: uuid(),
            timestamp: now(),
        };
        events.value.push(fullEvent);
        saveToStorage(events.value);
    }
    function clear() {
        events.value = [];
        saveToStorage([]);
    }
    /* =========================
       Export / Import
    ========================= */
    function exportJSON() {
        return JSON.stringify({
            version: 1,
            exportedAt: now(),
            events: events.value,
        }, null, 2);
    }
    function importJSON(json) {
        try {
            const parsed = JSON.parse(json);
            if (!parsed || !Array.isArray(parsed.events)) {
                throw new Error('Invalid events.json format');
            }
            events.value = parsed.events;
            saveToStorage(events.value);
        }
        catch (err) {
            alert('Import failed: invalid file');
            console.error(err);
        }
    }
    return {
        events,
        emit,
        clear,
        exportJSON,
        importJSON,
    };
}
