<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import PageHeader from "@/components/PageHeader.vue";
import { useDrive } from "@/composables/useDrive";

import { detectStorageBackend } from "@/utils/storageBackend";
import { pickLocalDirectory } from "@/services/local/localDirectory";

import {
  readPublishedJSON
} from "@/services/publishedData/publishedData";

import {
  readS3JSON,
  writeS3JSON,
} from "@/services/s3/s3StorageAdapter";

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

/* =========================
   TEST publishedData
========================= */
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

/* =========================
   Hetzner Object Storage POC
========================= */
const s3Busy = ref(false);
const s3Result = ref("");
const s3Error = ref("");

async function testS3Read() {
  s3Busy.value = true;
  s3Result.value = "";
  s3Error.value = "";

  try {
    const data =
      await readS3JSON<any>(
        "settings/test.json"
      );

    s3Result.value =
      JSON.stringify(data, null, 2);

  } catch (err) {
    console.error(err);

    s3Error.value =
      err instanceof Error
        ? err.message
        : String(err);

  } finally {
    s3Busy.value = false;
  }
}

async function testS3Write() {
  s3Busy.value = true;
  s3Result.value = "";
  s3Error.value = "";

  try {
    const payload = {
      provider: "Hetzner Object Storage",
      source: "HomeTools PWA",
      device: "Browser POC",
      timestamp: new Date().toISOString(),
      ok: true,
    };

    await writeS3JSON(
      "poc/ipad-write.json",
      payload
    );

    s3Result.value =
      "WRITE OK: poc/ipad-write.json";

  } catch (err) {
    console.error(err);

    s3Error.value =
      err instanceof Error
        ? err.message
        : String(err);

  } finally {
    s3Busy.value = false;
  }
}

async function testS3WriteThenRead() {
  s3Busy.value = true;
  s3Result.value = "";
  s3Error.value = "";

  try {
    const payload = {
      provider: "Hetzner Object Storage",
      source: "HomeTools PWA",
      device: "Browser POC",
      timestamp: new Date().toISOString(),
      ok: true,
    };

    await writeS3JSON(
      "poc/ipad-write.json",
      payload
    );

    const data =
      await readS3JSON<any>(
        "poc/ipad-write.json"
      );

    s3Result.value =
      JSON.stringify(data, null, 2);

  } catch (err) {
    console.error(err);

    s3Error.value =
      err instanceof Error
        ? err.message
        : String(err);

  } finally {
    s3Busy.value = false;
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

    <section class="poc-section">
      <h2>Hetzner Object Storage POC</h2>

      <p class="hint">
        Test S3 direct depuis le navigateur vers Hetzner Object Storage.
      </p>

      <div class="button-row">
        <button
          @click="testS3Read"
          :disabled="s3Busy"
        >
          Test S3 READ
        </button>

        <button
          @click="testS3Write"
          :disabled="s3Busy"
        >
          Test S3 WRITE
        </button>

        <button
          @click="testS3WriteThenRead"
          :disabled="s3Busy"
        >
          WRITE + READ
        </button>
      </div>

      <p v-if="s3Busy">
        Testing S3…
      </p>

      <div v-if="s3Result" class="result">
        <strong>S3 result</strong>
        <pre>{{ s3Result }}</pre>
      </div>

      <div v-if="s3Error" class="error">
        <strong>S3 error</strong>
        <pre>{{ s3Error }}</pre>
      </div>
    </section>

    <section class="poc-section">
      <h2>Published data test</h2>

      <button @click="testPublishedData">
        Test publishedData
      </button>
    </section>
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

/* Hover cohérent */
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
  color: var(--negative);
  font-size: var(--font-size-sm);
}

.poc-section {
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}

.poc-section h2 {
  margin: 0;
  font-size: 1.1rem;
}

.hint {
  margin-top: 0.5rem;
  opacity: 0.75;
  font-size: var(--font-size-sm);
}

.button-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.result {
  margin-top: 1rem;
}

pre {
  margin-top: 0.5rem;
  padding: 0.75rem;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>