<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";

import PageHeader from "@/components/PageHeader.vue";

import { useDrive } from "@/composables/useDrive";
import { useStorageBackend } from "@/composables/useStorageBackend";

import type {
  StorageBackend,
} from "@/utils/storageBackend";

import { detectDevice } from "@/utils/deviceDetection";

import {
  pickLocalDirectory,
  getLocalDirectory,
} from "@/services/local/localDirectory";

/* =========================
   Router
========================= */

const router = useRouter();

/* =========================
   Device
========================= */

const device = detectDevice();

const isMac = computed(() =>
  device === "Mac"
);

/* =========================
   Storage backend
========================= */

const {
  backend,
  setBackend,
} = useStorageBackend();

interface BackendOption {
  id: StorageBackend;
  label: string;
  description: string;
  disabled?: boolean;
}

const backendOptions = computed<BackendOption[]>(() => [
  {
    id: "LOCAL_DRIVE",
    label: "Local Drive",
    description: "Use the local HomeTools folder on this Mac.",
    disabled: !isMac.value,
  },
  {
    id: "GOOGLE_DRIVE",
    label: "Google Drive",
    description: "Use the current Google Drive backend.",
  },
  {
    id: "OBJECT_STORAGE",
    label: "Object Storage",
    description: "Use Hetzner Object Storage through S3.",
  },
]);

const isLocalDrive = computed(() =>
  backend.value === "LOCAL_DRIVE"
);

const isGoogleDrive = computed(() =>
  backend.value === "GOOGLE_DRIVE"
);

const isObjectStorage = computed(() =>
  backend.value === "OBJECT_STORAGE"
);

function selectBackend(option: BackendOption) {
  if (option.disabled) return;

  setBackend(option.id);
}

/* =========================
   Local Drive
========================= */

const localDirectorySelected = computed(() =>
  !!getLocalDirectory()
);

async function handlePickLocalDirectory() {
  try {
    await pickLocalDirectory();

    router.push({ name: "home" });

  } catch (err: any) {
    if (err?.message === "BROWSER_NOT_SUPPORTED") {
      alert(
        "Local Drive mode requires Chrome or Edge on macOS.\n\n" +
        "Safari does not support folder selection."
      );

      return;
    }

    console.error(err);
  }
}

function handleUseSelectedLocalDirectory() {
  if (!getLocalDirectory()) return;

  router.push({ name: "home" });
}

/* =========================
   Google Drive session
========================= */

const {
  connect,
  driveStatus,
  driveBusy,
  driveError,
} = useDrive();

const isConnected = computed(
  () => driveStatus.value === "CONNECTED"
);

const isExpired = computed(
  () => driveStatus.value === "EXPIRED"
);

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
   Object Storage
========================= */

function handleObjectStorageContinue() {
  router.push({ name: "home" });
}
</script>

<template>
  <PageHeader
    title="Storage"
    icon="locker"
  />

  <div class="authentication-view">
    <!-- =========================
         Backend selector
    ========================== -->

    <section class="backend-section">
      <h2>Storage backend</h2>

      <p class="hint">
        Select where HomeTools should read and write its data.
      </p>

      <div class="backend-options">
        <button
          v-for="option in backendOptions"
          :key="option.id"
          type="button"
          class="backend-option"
          :class="{
            active: backend === option.id,
            disabled: option.disabled
          }"
          :disabled="option.disabled"
          @click="selectBackend(option)"
        >
          <span class="backend-option-header">
            <span class="backend-option-radio">
              {{ backend === option.id ? "●" : "○" }}
            </span>

            <span class="backend-option-label">
              {{ option.label }}
            </span>
          </span>

          <span class="backend-option-description">
            {{ option.description }}
          </span>
        </button>
      </div>

      <p class="selected-backend">
        Active backend:
        <strong>{{ backend }}</strong>
      </p>
    </section>

    <!-- =========================
         Local Drive
    ========================== -->

    <section
      v-if="isLocalDrive"
      class="connection-section"
    >
      <h2>Local Drive</h2>

      <p>
        Select your local HomeTools folder.
      </p>

      <div class="button-row">
        <button @click="handlePickLocalDirectory">
          {{
            localDirectorySelected
              ? "Change local folder"
              : "Select local folder"
          }}
        </button>

        <button
          v-if="localDirectorySelected"
          class="secondary-button"
          @click="handleUseSelectedLocalDirectory"
        >
          Continue
        </button>
      </div>

      <p
        v-if="localDirectorySelected"
        class="success"
      >
        Local folder selected.
      </p>
    </section>

    <!-- =========================
         Google Drive
    ========================== -->

    <section
      v-else-if="isGoogleDrive"
      class="connection-section"
    >
      <h2>Google Drive</h2>

      <p>
        {{
          isExpired
            ? "Your Drive session has expired. Please reconnect."
            : "Connect your Google account to enable Drive features."
        }}
      </p>

      <button
        @click="handleConnect"
        :disabled="driveBusy || isConnected"
      >
        {{
          isConnected
            ? "Drive connected"
            : "Connect Google Drive"
        }}
      </button>

      <p v-if="driveBusy">
        Connecting…
      </p>

      <p
        v-if="driveError && !isExpired"
        class="error"
      >
        {{ driveError }}
      </p>
    </section>

    <!-- =========================
         Object Storage
    ========================== -->

    <section
      v-else-if="isObjectStorage"
      class="connection-section"
    >
      <h2>Hetzner Object Storage</h2>

      <p>
        HomeTools will use the configured S3 bucket via the Tailscale proxy.
      </p>

      <button @click="handleObjectStorageContinue">
        Continue with Object Storage
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

/* =========================================================
   Sections
========================================================= */

.backend-section,
.connection-section {
  padding-bottom: 1.25rem;
}

.connection-section {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}

h2 {
  margin: 0;
  font-size: 1.05rem;
}

.hint {
  margin-top: 0.4rem;
  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

/* =========================================================
   Backend selector
========================================================= */

.backend-options {
  display: grid;
  grid-template-columns: repeat(
    3,
    minmax(0, 1fr)
  );
  gap: 0.75rem;
  margin-top: 1rem;
}

.backend-option {
  margin: 0;
  padding: 0.9rem;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  text-align: left;

  border: 1px solid var(--border);
  border-radius: 10px;

  background: var(--surface);
  color: var(--text);

  cursor: pointer;
}

.backend-option:hover:not(:disabled) {
  border-color: var(--primary);
  background: var(--primary-soft);
}

.backend-option.active {
  border-color: var(--primary);
  background: var(--primary-soft);
  color: var(--primary);
}

.backend-option.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.backend-option-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.backend-option-radio {
  font-size: 1rem;
}

.backend-option-label {
  font-weight: 700;
}

.backend-option-description {
  margin-top: 0.45rem;
  color: var(--text-soft);
  font-size: var(--font-size-xs);
  line-height: 1.35;
}

.selected-backend {
  margin-top: 0.85rem;
  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

/* =========================================================
   Buttons
========================================================= */

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

button:hover:not(:disabled) {
  filter: brightness(1.05);
}

button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.secondary-button {
  background: var(--surface);
  color: var(--primary);
}

.button-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

/* =========================================================
   Status
========================================================= */

.success {
  margin-top: 0.75rem;
  color: var(--positive);
  font-weight: 600;
}

.error {
  margin-top: 0.75rem;
  color: var(--negative);
  font-size: var(--font-size-sm);
}

/* =========================================================
   Mobile
========================================================= */

@media (max-width: 700px) {
  .backend-options {
    grid-template-columns: 1fr;
  }
}
</style>
