<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";

import PageHeader from "@/components/PageHeader.vue";
import { useDrive } from "@/composables/useDrive";

import { detectStorageBackend } from "@/utils/storageBackend";
import { pickLocalDirectory } from "@/services/local/localDirectory";

import {
  readPublishedJSON
} from "@/services/publishedData/publishedData";

/* =========================
   Router
========================= */
const router = useRouter();

/* =========================
   Drive session
========================= */
const backend = detectStorageBackend();

const isLocalDrive = computed(() =>
  backend === "LOCAL_DRIVE"
);

async function handlePickLocalDirectory() {
  try {

    await pickLocalDirectory();

    router.push({ name: "home" });

  } catch (err: any) {

    if (err?.message === "BROWSER_NOT_SUPPORTED") {

      alert(
        "Local Drive mode requires Chrome or Edge.\n\n" +
        "Safari does not support folder selection."
      );

      return;
    }

    console.error(err);
  }
}

const {
  connect,
  driveStatus,
  driveBusy,
  driveError,
} = useDrive();

/* =========================
   Derived state
========================= */
const isConnected = computed(
  () => driveStatus.value === "CONNECTED"
);

const isExpired = computed(
  () => driveStatus.value === "EXPIRED"
);

/* =========================
   Actions
========================= */
async function handleConnect() {
  if (driveBusy.value) return;

  try {
    await connect();

    if (driveStatus.value === "CONNECTED") {
      router.push({ name: "home" });
    }
  } catch (err) {
    console.error(err);
  }
}

/*====================
TEST publishedData
======================*/
async function testPublishedData() {
  try {

    const data =
      await readPublishedJSON<any>(
        "spending/spending.json"
      );

    console.log(
      "Published Data:",
      data
    );

    alert(
      data
        ? "Published data loaded successfully"
        : "Published data not found"
    );

  } catch (err) {

    console.error(err);

    alert("Published data read failed");
  }
}
</script>

<template>
<PageHeader
  :title="isLocalDrive ? 'Select Folder' : 'Authentication'"
  :icon="isLocalDrive ? 'folder' : 'locker'"
/>

<div class="authentication-view">
  <template v-if="isLocalDrive">
    <p>Please select your local HomeTools folder.</p>

    <button @click="handlePickLocalDirectory">
      Select local folder
    </button>
  </template>

  <template v-else>
    <p>
      {{
        isExpired
          ? "Your Drive session has expired. Please reconnect."
          : "Please connect your Google account to enable Drive features."
      }}
    </p>

    <button
      @click="handleConnect"
      :disabled="driveBusy || isConnected"
    >
      {{ isConnected ? "Drive connected" : "Connect Google Drive" }}
    </button>

    <p v-if="driveBusy">Connecting…</p>

    <p v-if="driveError && !isExpired" class="error">
      {{ driveError }}
    </p>
  </template>
</div>

</template>

<style scoped>
.authentication-view {
  padding: 1rem;
  background: var(--bg);
  color: var(--text);
}

/* Bouton principal */
button {
  margin-top: 1rem;
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--primary);
  background: var(--primary);
  color: white;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.15s ease;
}

/* Hover cohérent (évite effet "flash" en dark) */
button:hover:not(:disabled) {
  filter: brightness(1.05);
}

/* Disabled */
button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Erreur */
.error {
  margin-top: 0.75rem;
  color: var(--negative); /* FIX: var(--danger) n’existe pas */
  font-size: var(--font-size-sm);
}
</style>