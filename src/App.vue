<script setup lang="ts">
import { connectGoogle, isGoogleAuthenticated } from "@/services/google/googleInit";

async function login() {
  try {
    await connectGoogle();
  } catch (e) {
    console.error("[Google] auth failed", e);
  }
}
</script>

<template>
  <div style="padding: 1rem">
    <button @click="login">
      Se connecter à Google
    </button>

    <p v-if="isGoogleAuthenticated()">✅ Connecté</p>
  </div>

  <router-view />
</template>