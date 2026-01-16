<script setup lang="ts">
import PageHeader from "@/components/PageHeader.vue";
import { useDrive } from "@/composables/useDrive";

/* =========================
   Drive
========================= */
const {
  connect,
  driveReady,
  driveBusy,
  driveError,
} = useDrive();
</script>

<template>
  <PageHeader title="Authentication" icon="lock" />

  <div class="authentication-view">
    <p>
      Please connect your Google account to enable Drive
      features.
    </p>

    <button
      @click="connect"
      :disabled="driveBusy || driveReady"
    >
      {{ driveReady ? "Drive connected" : "Connect Google Drive" }}
    </button>

    <p v-if="driveBusy">Connecting…</p>

    <p v-if="driveError" class="error">
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