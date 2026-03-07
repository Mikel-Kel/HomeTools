<script setup lang="ts">
import { onMounted } from "vue"
import { useRouter } from "vue-router"

import { pickLocalDirectory } from "@/services/local/localDirectory"
import { useStorageBackend } from "@/composables/useStorageBackend"

const router = useRouter()
const { backend } = useStorageBackend()

async function selectFolder() {

  const handle = await pickLocalDirectory()

  if (handle) {
    router.replace("/")
  }

}

onMounted(() => {

  if (backend.value !== "LOCAL_DRIVE") {
    router.replace("/")
  }

})
</script>

<template>
  <div class="folder-required">

    <h1>Select HomeTools folder</h1>

    <p>
      Please select the <b>HomeTools</b> folder in your Google Drive.
    </p>

    <button @click="selectFolder">
      Select folder
    </button>

  </div>
</template>

<style scoped>

.folder-required {
  padding: 2rem;
  text-align: center;
}

button {
  margin-top: 1rem;
  padding: 10px 20px;
  font-size: 1rem;
}

</style>