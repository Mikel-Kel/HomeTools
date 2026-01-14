<script setup lang="ts">
import { ref } from 'vue'  
import PageHeader from '@/components/PageHeader.vue'  
import { useEvents } from '@/composables/useEvents'
import {
  connectToDrive,
  saveJSON,
  loadJSON,
} from "@/services/googleDrive"

const driveConnected = ref(false)
const driveBusy = ref(false)

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
async function connectDrive() {
  try {
    driveBusy.value = true
    await connectToDrive()
    driveConnected.value = true
    console.log("Drive connected")
  } catch (e) {
    console.error("Drive connection failed:", e)
  } finally {
    driveBusy.value = false
  }
}

async function saveToDrive() {
  try {
    driveBusy.value = true
    await saveJSON("events.json", exportJSON())
    console.log("Saved to Drive")
  } catch (e) {
    console.error("Save failed:", e)
  } finally {
    driveBusy.value = false
  }
}

async function loadFromDrive() {
  try {
    driveBusy.value = true
    const json = await loadJSON("events.json")
    if (json) importJSON(json)
  } catch (e) {
    console.error("Load failed:", e)
  } finally {
    driveBusy.value = false
  }
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

        <button @click="connectDrive" :disabled="driveBusy">
          {{ driveConnected ? "Drive Connected" : "Connect Drive" }}
        </button>

        <button
          @click="saveToDrive"
          :disabled="!driveConnected || driveBusy"
        >
          Save to Drive
        </button>

        <button
          @click="loadFromDrive"
          :disabled="!driveConnected || driveBusy"
        >
          Load from Drive
        </button>

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