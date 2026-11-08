<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import PillButton from "@/components/ui/PillButton.vue";
import { CONTRACT_VERSION } from "@/contracts/environment";

import {
  appBlock,
  appStatusChecking,
  checkAppStatus,
} from "@/services/appStatus/appStatusGuard";

import {
  environmentChecking,
  loadEnvironment,
  submitProxyKey,
} from "@/services/environment/environmentGuard";

import {
  environmentBlock,
  requiresReload,
} from "@/services/environment/environmentState";

/* =========================
   Écran « app indisponible »

   Couvre toute l'app tant qu'elle est bloquée :
   - environnement (environmentGuard.ts) : refus du proxy,
     contrat incompatible, environnement changé ou proxy
     injoignable au démarrage. Prioritaire, sur toutes les
     pages et quel que soit le stockage ; « Retry » relance
     /api/whoami, « Reload » recharge l'app. Clé du proxy
     absente ou refusée : saisie, une fois par appareil
     (« Connect ») ;
   - disponibilité (appStatusGuard.ts) : maintenance
     annoncée par le Mac, ou proxy injoignable. « Retry »
     relance le contrôle ; « Storage » ouvre le choix du
     stockage, page sur laquelle cet écran s'efface.
========================= */

const route =
  useRoute();

const router =
  useRouter();

const showAppBlock =
  computed(() =>
    appBlock.value !== null &&
    route.name !== "authentication"
  );

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

function reloadApp() {
  window.location.reload();
}

const keyInput =
  ref("");

async function connect() {
  if (!keyInput.value.trim() || environmentChecking.value) {
    return;
  }

  await submitProxyKey(keyInput.value);

  keyInput.value = "";
}
</script>

<template>
  <div
    v-if="environmentBlock"
    class="unavailable"
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="unavailable-title"
  >
    <section
      v-if="environmentBlock.kind === 'key'"
      class="card"
    >
      <h1 id="unavailable-title">
        {{ environmentBlock.rejected ? "Proxy key rejected" : "Proxy key required" }}
      </h1>

      <p class="message">
        {{
          environmentBlock.rejected
            ? "The home services refused this key. Enter the current proxy key."
            : "Enter the HomeTools proxy key. It is asked once on this device and stored encrypted."
        }}
      </p>

      <input
        v-model="keyInput"
        class="key-input"
        type="password"
        autocomplete="off"
        aria-label="Proxy key"
        :disabled="environmentChecking"
        @keyup.enter="connect"
      >

      <div class="actions">
        <PillButton
          variant="primary"
          :disabled="environmentChecking || !keyInput.trim()"
          @click="connect"
        >
          {{ environmentChecking ? "Checking…" : "Connect" }}
        </PillButton>
      </div>
    </section>

    <section
      v-else
      class="card"
    >
      <template v-if="environmentBlock.kind === 'unreachable'">
        <h1 id="unavailable-title">Home services unreachable</h1>

        <p class="message">
          The Mac does not answer. Check that it is on and connected.
        </p>
      </template>

      <template v-else-if="environmentBlock.kind === 'error'">
        <h1 id="unavailable-title">HomeTools is not available</h1>

        <p
          v-if="environmentBlock.message"
          class="message"
        >
          {{ environmentBlock.message }}
        </p>

        <p
          v-if="environmentBlock.code"
          class="code"
        >
          {{ environmentBlock.code }}
        </p>
      </template>

      <template v-else-if="environmentBlock.kind === 'contract'">
        <h1 id="unavailable-title">Incompatible version</h1>

        <p class="message">
          This app follows contract {{ CONTRACT_VERSION }}; the home services follow
          contract {{ environmentBlock.proxyVersion || "(unknown)" }}.
          Reload to get the matching version of the app.
        </p>
      </template>

      <template v-else-if="environmentBlock.kind === 'changed'">
        <h1 id="unavailable-title">Environment changed</h1>

        <p class="message">
          This device now belongs to environment {{ environmentBlock.received }}
          instead of {{ environmentBlock.expected }}. Reload to continue.
        </p>
      </template>

      <p
        v-if="!requiresReload(environmentBlock)"
        class="detail"
      >
        The app checks again every minute.
      </p>

      <div class="actions">
        <PillButton
          v-if="requiresReload(environmentBlock)"
          variant="primary"
          @click="reloadApp"
        >
          Reload
        </PillButton>

        <PillButton
          v-else
          variant="primary"
          :disabled="environmentChecking"
          @click="loadEnvironment"
        >
          {{ environmentChecking ? "Checking…" : "Retry" }}
        </PillButton>
      </div>
    </section>
  </div>

  <div
    v-else-if="showAppBlock && appBlock"
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

.key-input {
  width: 100%;
  max-width: 320px;
  box-sizing: border-box;
}

.code {
  margin: 0;

  color: var(--text-soft);
  font-family: ui-monospace, Menlo, monospace;
  font-size: var(--font-size-sm);
}

.detail {
  margin: 0;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
}
</style>
