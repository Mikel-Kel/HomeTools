<script setup lang="ts">
import { onMounted } from "vue";
import { initGoogleAPI, connectGoogle } from "@/services/google/googleInit";
import { log } from "./utils/logger";

async function login() {
  try {
    await connectGoogle();
  } catch (e) {
    log.error("[Google login failed]", e);
  }
}

onMounted(async () => {
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