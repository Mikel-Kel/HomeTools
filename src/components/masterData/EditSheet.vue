<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
} from "vue";

import PillButton from "@/components/ui/PillButton.vue";

import type { useEventRequest } from "@/composables/useEventRequest";

import { confirmDialog } from "@/services/dialog/appDialog";

/* =========================
   Cadre d'une fiche de données de base

   En-tête, fermeture (✕, Échap, clic hors de la fiche),
   pied avec le suivi de la demande envoyée au Mac et les
   boutons (Delete, à gauche, si canDelete). Le contenu de
   la fiche va dans le slot.

   Le parent garde la saisie et l'envoi : il fournit la
   demande (useEventRequest), l'éventuel motif de blocage et
   ce qui est modifié ; la fiche demande confirmation avant
   d'abandonner des modifications.
========================= */

const props = defineProps<{
  title: string;
  subtitle: string;
  request: ReturnType<typeof useEventRequest>;
  changed: boolean;
  canSave: boolean;
  saveLabel: string;

  /* Message affiché tant que rien n'est envoyé (contrôle, attente ailleurs). */
  hint?: string;
  hintIsError?: boolean;

  canDelete?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  save: [];
  delete: [];
}>();

const message =
  computed(() => {
    const current =
      props.request.request.value;

    switch (current?.phase) {
      case "requested":
        return props.request.noAnswerYet.value
          ? "Sent — no answer from the Mac yet. Check that it is on and reachable."
          : "Sent — waiting for the Mac…";

      case "started":
        return "Saving on the Mac…";

      case "error":
        return `Rejected: ${current.message ?? "unknown error"}`;

      default:
        return props.hint ?? "";
    }
  });

const messageClass =
  computed(() =>
    props.request.request.value?.phase ??
    (props.hintIsError ? "error" : "")
  );

async function close() {
  if (
    props.changed &&
    !props.request.inProgress.value &&
    !(await confirmDialog({
      title: "Discard the changes?",
      confirmLabel: "Discard",
      destructive: true,
    }))
  ) {
    return;
  }

  emit("close");
}

function onKeydown(
  event: KeyboardEvent
) {
  if (event.key === "Escape") {
    close();
  }
}

onMounted(() => {
  window.addEventListener(
    "keydown",
    onKeydown
  );
});

onBeforeUnmount(() => {
  window.removeEventListener(
    "keydown",
    onKeydown
  );
});
</script>

<template>
  <div
    class="overlay"
    @click="close"
  ></div>

  <section
    class="sheet"
    role="dialog"
    :aria-label="title"
  >
    <header class="sheet-header">
      <div>
        <h2>{{ title }}</h2>

        <div class="sheet-subtitle">
          {{ subtitle }}
        </div>
      </div>

      <button
        type="button"
        class="close-btn"
        aria-label="Close"
        @click="close"
      >
        ✕
      </button>
    </header>

    <slot />

    <footer class="sheet-footer">
      <PillButton
        v-if="canDelete"
        :disabled="request.inProgress.value"
        @click="emit('delete')"
      >
        Delete
      </PillButton>

      <span
        class="request-message"
        :class="messageClass"
      >
        {{ message }}
      </span>

      <PillButton @click="close">
        Cancel
      </PillButton>

      <PillButton
        variant="primary"
        :disabled="!canSave"
        @click="emit('save')"
      >
        {{ saveLabel }}
      </PillButton>
    </footer>
  </section>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 999;

  background: var(--overlay);
}

.sheet {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 1000;

  display: flex;
  flex-direction: column;
  gap: 1rem;

  width: 600px;
  max-width: 92vw;
  max-height: 92vh;
  overflow-y: auto;

  padding: 22px;

  border-radius: 14px;

  background: var(--surface);
  box-shadow: var(--shadow-lg);

  transform: translate(-50%, -50%);
}

.sheet-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;

  padding-bottom: 10px;

  border-bottom: 1px solid var(--border);
}

.sheet-header h2 {
  margin: 0;

  font-size: var(--font-size-lg);
}

.sheet-subtitle {
  margin-top: 4px;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

.close-btn {
  padding: 2px 6px;

  border: none;
  border-radius: 6px;

  background: transparent;
  color: var(--text);

  font-size: 18px;
  line-height: 1;

  cursor: pointer;
}

.close-btn:hover {
  background: var(--primary-soft);
}

/* Champs des fiches (contenu du slot). */
.sheet :slotted(h3) {
  margin: 0;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
  font-weight: 700;
}

.sheet :slotted(.field) {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sheet :slotted(.field-row) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
}

.sheet :slotted(.note) {
  margin: 0;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

.sheet :slotted(input),
.sheet :slotted(select) {
  box-sizing: border-box;

  padding: 8px 10px;

  border: 1px solid var(--input-border);
  border-radius: 8px;

  font-size: var(--font-size-md);
}

.sheet-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.5rem;

  padding-top: 10px;

  border-top: 1px solid var(--border);
}

.request-message {
  flex: 1;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

.request-message.error {
  color: var(--negative);
}
</style>
