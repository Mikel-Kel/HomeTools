<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'  
import { useEvents } from '@/composables/useEvents'

const {
  events,
  clear,
  exportJSON,
  importJSON,
} = useEvents()

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

/* =========================
   Export
========================= */
function download() {
  const blob = new Blob([exportJSON()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = 'events.json'
  a.click()

  URL.revokeObjectURL(url)
}

/* =========================
   Import
========================= */
function upload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    if (typeof reader.result === 'string') {
      importJSON(reader.result)
    }
  }
  reader.readAsText(file)
}
</script>

<template>
  <div class="event-log">
    <PageHeader title="Event Log" icon="rss" />

    <header>

      <div class="actions">
        <button @click="download">Export</button>

        <label class="import">
          Import
          <input type="file" accept="application/json" @change="upload" hidden />
        </label>

        <button @click="clear">Clear</button>
      </div>
    </header>
    <table v-if="events.length">
      <thead>
        <tr>
          <th>#</th>
          <th>Time</th>
          <th>Type</th>
          <th>Payload</th>
        </tr>
      </thead>

      <tbody>
        <tr v-for="(event, index) in events" :key="event.id">
          <td>{{ index + 1 }}</td>
          <td class="mono">{{ event.timestamp }}</td>
          <td class="type">{{ event.type }}</td>
          <td>
            <pre>{{ pretty(event.payload) }}</pre>
          </td>
        </tr>
      </tbody>
    </table>

    <p v-else class="empty">
      No events yet.
    </p>
  </div>
</template>

<style scoped>
.event-log {
  padding: 16px;
  background: var(--bg);
  color: var(--text);
}

/* Header */
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

/* Actions */
.actions {
  display: flex;
  gap: 8px;
}

button,
.import {
  padding: 6px 12px;
  border-radius: 8px;
  border: none;
  cursor: pointer;

  background: var(--primary);
  color: white;
}

.import {
  display: inline-flex;
  align-items: center;
}

/* Table */
table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  border: 1px solid var(--border);
  padding: 6px;
  vertical-align: top;
}

th {
  background: var(--primary-soft);
  color: var(--text);
}

/* Cells */
.mono {
  font-family: monospace;
  font-size: 0.85em;
  color: var(--text-muted);
}

.type {
  font-weight: bold;
  white-space: nowrap;
  color: var(--primary);
}

pre {
  margin: 0;
  font-size: 0.85em;
  color: var(--text);
}

/* Empty state */
.empty {
  font-style: italic;
  color: var(--text-muted);
}  
</style>