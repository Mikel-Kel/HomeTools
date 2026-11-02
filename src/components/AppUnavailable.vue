<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";

import PillButton from "@/components/ui/PillButton.vue";

import {
  appBlock,
  appStatusChecking,
  checkAppStatus,
} from "@/services/appStatus/appStatusGuard";

/* =========================
   Écran « app indisponible »

   Couvre toute l'app tant que appStatusGuard la bloque :
   maintenance annoncée par le Mac, ou services de la maison
   (proxy du Mac) injoignables. « Retry » relance le contrôle ;
   « Storage » ouvre le choix du stockage, laissé accessible.
========================= */

const router =
  useRouter();

const sinceLabel =
  computed(() => {
    const block =
      appBlock.value;

    if (block?.kind !== "maintenance" || !block.since) {
      return "";
    }

    const date =
      new Date(block.since);

    return Number.isNaN(date.getTime())
      ? ""
      : `Since ${date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`;
  });
</script>

<template>
  <div
    v-if="appBlock"
    class="unavailable"
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="unavailable-title"
  >
    <section class="card">
      <template v-if="appBlock.kind === 'maintenance'">
        <h1 id="unavailable-title">HomeTools is under maintenance</h1>

        <p
          v-if="appBlock.message"
          class="message"
        >
          {{ appBlock.message }}
        </p>

        <p
          v-if="sinceLabel"
          class="detail"
        >
          {{ sinceLabel }}
        </p>
      </template>

      <template v-else>
        <h1 id="unavailable-title">Home services unreachable</h1>

        <p class="message">
          The Mac does not answer. Check that it is on and connected.
        </p>
      </template>

      <p class="detail">
        The app checks again every minute.
      </p>

      <div class="actions">
        <PillButton @click="router.push('/authentication')">
          Storage
        </PillButton>

        <PillButton
          variant="primary"
          :disabled="appStatusChecking"
          @click="checkAppStatus(true)"
        >
          {{ appStatusChecking ? "Checking…" : "Retry" }}
        </PillButton>
      </div>
    </section>
  </div>
</template>

<style scoped>
.unavailable {
  position: fixed;
  inset: 0;
  z-index: 3000;

  display: flex;
  align-items: center;
  justify-content: center;

  padding: 16px;

  background: var(--bg);
}

.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;

  width: 100%;
  max-width: 480px;
  padding: 28px 24px;

  border: 1px solid var(--border);
  border-radius: 14px;

  background: var(--surface);
  box-shadow: var(--shadow-lg);

  text-align: center;
}

.card h1 {
  margin: 0;

  font-size: var(--font-size-lg);
}

.message {
  margin: 0;

  color: var(--text);
  white-space: pre-wrap;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.detail {
  margin: 0;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
}
</style>
