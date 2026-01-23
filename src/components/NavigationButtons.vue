<script setup lang="ts">
import { useRouter, useRoute } from "vue-router";
import AppIcon from "@/components/AppIcon.vue";

const router = useRouter();
const route = useRoute();

const props = defineProps<{
  disabled?: boolean;
}>();

function goBack() {
  if (props.disabled) return;
  router.back();
}

function goHome() {
  if (props.disabled) return;
  router.push("/");
}

const level = (route.meta.level as number) ?? 0;
const showBack = level >= 2;
</script>

<template>
  <div class="nav-buttons">
    <button
      v-if="showBack"
      class="nav-btn"
      @click="goBack"
      :disabled="disabled"
      title="Back"
    >
      <AppIcon name="back" :size="32" />
    </button>

    <button
      class="nav-btn"
      @click="goHome"
      title="Home",
      :disabled="disabled"
    >
      <AppIcon name="home" :size="32" />
    </button>
  </div>
</template>

<style scoped>
.nav-buttons {
  display: flex;
  align-items: center;
  gap: 6px;
}

.nav-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;

  padding: 6px;
  border-radius: 8px;
  border: none;
  background: none;

  cursor: pointer;
}

.icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}

.nav-btn:hover {
  background: #eef2ff;
}
</style>