<script setup lang="ts">
import { onMounted } from "vue";
import { initGoogleAPI } from "@/services/google/googleInit";
import { useStorageBackend } from "@/composables/useStorageBackend";
import { log } from "./utils/logger";

const { backend } = useStorageBackend();

/* =========================
   Init
========================= */

onMounted(async () => {

  if (backend.value !== "GOOGLE_DRIVE") {
    log.info("LOCAL_DRIVE mode → Google API skipped");
    return;
  }

  try {
    await initGoogleAPI();
  } catch (e) {
    log.error("[Google API init failed]", e);
  }

});
</script>

<template>
  <router-view />
</template>