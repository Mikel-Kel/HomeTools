<script setup lang="ts">
import { onMounted } from "vue";
import { initGoogleAPI, connectGoogle } from "@/services/google/googleInit";

async function login() {
  try {
    await connectGoogle();
  } catch (e) {
    console.error("[Google login failed]", e);
  }
}

onMounted(async () => {
  try {
    await initGoogleAPI();
  } catch (e) {
    console.error("[Google API init failed]", e);
  }
});
</script>

<template>
  <router-view />
</template>