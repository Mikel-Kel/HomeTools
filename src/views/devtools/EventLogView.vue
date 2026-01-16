<script setup lang="ts">
import { ref, computed } from "vue";
import PageHeader from "@/components/PageHeader.vue";
import { useEvents } from "@/composables/useEvents";

import { connectGoogle } from "@/services/google/googleInit";
import { useDriveJsonFile } from "@/composables/useDriveJsonFile";

/* =========================
   CONFIG
========================= */
// 👉 ID réel du dossier /HomeTools/events
const EVENTS_FOLDER_ID = "PUT_EVENTS_FOLDER_ID_HERE";

/* =========================
   Events métier
========================= */
const {
  events,
  importJSON,
  exportJSON,
  clear,
} = useEvents();

/* =========================
   Drive JSON binding
========================= */
const driveFile = useDriveJsonFile(
  EVENTS_FOLDER_ID,
  "events.json"
);

const driveConnected = ref(false);

/* =========================
   UI state (APLATI)
========================= */
const isBusy = computed<boolean>(() => {
  return driveFile.busy.value;
});

const canUseDrive = computed<boolean>(() => {
  return driveConnected.value && !isBusy.value;
});

/* =========================
   Actions
========================= */
async function connectDrive() {
  await connectGoogle();
  driveConnected.value = true;
}

async function loadFromDrive() {
  const json = await driveFile.load();
  if (json) importJSON(JSON.stringify(json));
}

async function saveToDrive() {
  await driveFile.save(JSON.parse(exportJSON()));
}
</script>

<template>
  <div class="event-log">
    <PageHeader title="Event Log" icon="rss" />

    <div class="actions">
      <button @click="connectDrive">
        Connect Drive
      </button>

      <button
        @click="loadFromDrive"
        :disabled="!canUseDrive"
      >
        Load from Drive
      </button>

      <button
        @click="saveToDrive"
        :disabled="!canUseDrive"
      >
        Save to Drive
      </button>

      <button @click="clear">
        Clear
      </button>
    </div>

    <pre>{{ events }}</pre>

    <p v-if="driveFile.error" class="error">
      {{ driveFile.error }}
    </p>
  </div>
</template>