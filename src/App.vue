<script setup lang="ts">
import { onMounted } from "vue";
import { initGoogleAPI, connectGoogle } from "@/services/google/googleInit";
import { useStorageBackend } from "@/composables/useStorageBackend";
import { log } from "./utils/logger";

const { backend } = useStorageBackend();

/* =========================
   Google login helper
========================= */

async function login() {
  if (backend.value !== "GOOGLE_DRIVE") return;

  try {
    await connectGoogle();
  } catch (e) {
    log.error("[Google login failed]", e);
  }
}

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