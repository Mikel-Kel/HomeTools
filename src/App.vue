<script setup lang="ts">
import {
  connectGoogle,
  googleAuthenticated,
  listDriveFiles
} from "@/services/google/googleInit";

async function login() {
  await connectGoogle();
}

async function listFiles() {
  try {
    await listDriveFiles();
  } catch (e) {
    console.error(e);
  }
}
</script>

<template>
  <div style="padding: 1rem">
    <button @click="login">Se connecter à Google</button>
    <button @click="listFiles" :disabled="!googleAuthenticated"> Lister Drive
    </button>

    <p v-if="googleAuthenticated">✅ Connecté</p>
  </div>

  <router-view />
</template>