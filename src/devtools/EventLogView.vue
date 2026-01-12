<template>
  <div class="event-log">
    <header>
      <h1>Event log</h1>
      <button @click="clear">Clear</button>
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

<script setup lang="ts">
import { useEvents } from '@/composables/useEvents'

const { events, clear } = useEvents()

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2)
}
</script>

<style scoped>
.event-log {
  padding: 16px;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  border: 1px solid #ccc;
  padding: 6px;
  vertical-align: top;
}

th {
  background: #f0f0f0;
}

.mono {
  font-family: monospace;
  font-size: 0.85em;
}

.type {
  font-weight: bold;
  white-space: nowrap;
}

pre {
  margin: 0;
  font-size: 0.85em;
}

.empty {
  font-style: italic;
  color: #666;
}
</style>