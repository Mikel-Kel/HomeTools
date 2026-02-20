<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";

import PageHeader from "@/components/PageHeader.vue";
import { useDrive } from "@/composables/useDrive";

/* =========================
   Router
========================= */
const router = useRouter();

/* =========================
   Drive session
========================= */
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
</script>

<template>
  <PageHeader title="Authentication" icon="locker" />

  <div class="authentication-view">
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

  </div>
</template>

<style scoped>
.authentication-view {
  padding: 1rem;
  background: var(--bg);
  color: var(--text);
}

button {
  margin-top: 1rem;
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  background: var(--primary);
  color: white;
  cursor: pointer;
}

button:disabled {
  opacity: 0.6;
  cursor: default;
}

.error {
  margin-top: 0.75rem;
  color: var(--danger);
}
</style>