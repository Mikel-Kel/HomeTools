<script setup lang="ts">
import { ref } from "vue";
import PageHeader from "@/components/PageHeader.vue";

import { connectGoogle } from "@/services/google/googleInit";
import {
  listFilesInFolder,
  readJSON,
  writeJSON,
  type DriveItem,
} from "@/services/google/googleDrive";

/* =========================
   CONFIG
========================= */
// 👉 ID du dossier parent (ex: parent de HomeTools)
const ROOT_FOLDER_ID = "root";

/* =========================
   State
========================= */
const driveConnected = ref(false);
const busy = ref(false);
const error = ref<string | null>(null);

const currentFolderId = ref<string>(ROOT_FOLDER_ID);
const folderStack = ref<string[]>([]);
const items = ref<DriveItem[]>([]);

/* =========================
   Test write JSON
========================= */
const testPayload = ref({
  source: "DriveDevView",
  counter: 0,
  timestamp: new Date().toISOString(),
});

const lastWritten = ref<any | null>(null);

/* =========================
   Helpers
========================= */
function isFolder(item: DriveItem) {
  return item.mimeType === "application/vnd.google-apps.folder";
}

function isJson(item: DriveItem) {
  return item.mimeType === "application/json";
}

/* =========================
   Loaders
========================= */
async function refresh() {
  busy.value = true;
  error.value = null;

  try {
    items.value = await listFilesInFolder(currentFolderId.value);
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : String(e);
    items.value = [];
  } finally {
    busy.value = false;
  }
}

/* =========================
   Navigation
========================= */
async function openFolder(item: DriveItem) {
  if (!isFolder(item)) return;

  folderStack.value.push(currentFolderId.value);
  currentFolderId.value = item.id;
  await refresh();
}

async function goUp() {
  const parent = folderStack.value.pop();
  if (!parent) return;

  currentFolderId.value = parent;
  await refresh();
}

/* =========================
   File actions
========================= */
async function openFile(item: DriveItem) {
  console.log("[UI] file clicked:", item.name, item.mimeType);

  if (!isJson(item)) {
    console.warn("[UI] not a JSON file");
    return;
  }

  try {
    const json = await readJSON(item.id);
    console.log("[Drive] readJSON OK", json);
    lastWritten.value = json;
  } catch (e) {
    console.error("[Drive] readJSON FAILED", e);
  }
}

/* =========================
   TEST — write JSON
========================= */
async function writeTestJSON() {
  busy.value = true;
  error.value = null;

  try {
    testPayload.value.counter++;
    testPayload.value.timestamp = new Date().toISOString();

    const id = await writeJSON(
      currentFolderId.value,
      "drive-test.json",
      testPayload.value
    );

    console.log("[TEST] writeJSON OK, id =", id);

    const reread = await readJSON(id);
    console.log("[TEST] readJSON after write =", reread);

    lastWritten.value = reread;
    await refresh(); // pour voir le fichier apparaître
  } catch (e) {
    error.value = String(e);
  } finally {
    busy.value = false;
  }
}

/* =========================
   Google connect
========================= */
async function connectDrive() {
  busy.value = true;
  error.value = null;

  try {
    await connectGoogle();
    driveConnected.value = true;
    await refresh();
  } catch (e) {
    error.value = String(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="drive-dev">
    <PageHeader title="Drive DevTools" icon="folder" />

    <div class="actions">
      <button @click="connectDrive" :disabled="busy">
        {{ driveConnected ? "Drive Connected" : "Connect Drive" }}
      </button>

      <button
        v-if="folderStack.length"
        @click="goUp"
        :disabled="busy"
      >
        ⬆️ Up
      </button>

      <button
        @click="writeTestJSON"
        :disabled="!driveConnected || busy"
      >
        🧪 Write test JSON
      </button>
    </div>

    <p v-if="busy">Loading…</p>
    <p v-if="error" class="error">{{ error }}</p>

    <ul class="file-list">
      <li v-for="item in items" :key="item.id">
        <!-- Folder -->
        <button
          v-if="isFolder(item)"
          class="folder"
          @click="openFolder(item)"
        >
          📁 {{ item.name }}
        </button>

        <!-- File -->
        <button
          v-else
          class="file"
          @click="openFile(item)"
        >
          📄 {{ item.name }}
          <small>({{ item.mimeType }})</small>
        </button>
      </li>
    </ul>

    <h3 v-if="lastWritten">Last JSON read/write</h3>
    <pre v-if="lastWritten">
{{ JSON.stringify(lastWritten, null, 2) }}
    </pre>
  </div>
</template>

<style scoped>
.drive-dev {
  padding: 1rem 0;
}

.actions {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

button {
  padding: 6px 12px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  background: var(--primary);
  color: white;
}

button:disabled {
  opacity: 0.6;
  cursor: default;
}

.file-list {
  list-style: none;
  padding: 0;
}

.file-list li {
  margin-bottom: 6px;
}

.folder,
.file {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  color: var(--primary);
}

.folder:hover,
.file:hover {
  text-decoration: underline;
}

.error {
  color: var(--danger);
}
</style>