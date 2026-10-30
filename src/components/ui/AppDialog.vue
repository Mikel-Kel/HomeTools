<script setup lang="ts">
import {
  nextTick,
  onMounted,
  ref,
  watch,
} from "vue";

import PillButton from "@/components/ui/PillButton.vue";

import {
  answerDialog,
  currentDialog,
  type DialogRequest,
} from "@/services/dialog/appDialog";

/* =========================
   Dialogue de l'application (confirmation ou information)

   Affiche currentDialog (src/services/dialog/appDialog.ts)
   dans un <dialog> modal, au-dessus de tout le reste.
   - Entrée : bouton qui a le focus (l'action, ou Cancel
     pour une action destructive) ;
   - Échap : Cancel (OK pour une information) ;
   - toucher le fond : Cancel, sans effet sur une information.
   Les touches ne remontent pas à la page : une fiche ouverte
   dessous ne reçoit pas l'Échap.
========================= */

const dialog =
  ref<HTMLDialogElement | null>(null);

const cancelButton =
  ref<InstanceType<typeof PillButton> | null>(null);

const confirmButton =
  ref<InstanceType<typeof PillButton> | null>(null);

async function show(
  request: DialogRequest | null
) {
  const element =
    dialog.value;

  if (!element) {
    return;
  }

  if (!request) {
    if (element.open) {
      element.close();
    }

    return;
  }

  if (!element.open) {
    element.showModal();
  }

  await nextTick();

  const focused =
    request.kind === "confirm" && request.destructive
      ? cancelButton.value
      : confirmButton.value;

  (focused?.$el as HTMLElement | undefined)?.focus();
}

watch(
  currentDialog,
  show,

  {
    flush: "post",
  }
);

/* Dialogue demandé avant le montage (garde du routeur). */
onMounted(() => {
  show(currentDialog.value);
});

function cancel() {
  answerDialog(
    currentDialog.value?.kind === "alert"
  );
}

function onKeydown(
  event: KeyboardEvent
) {
  event.stopPropagation();
}

function onBackdropClick(
  event: MouseEvent
) {
  if (
    event.target === dialog.value &&
    currentDialog.value?.kind === "confirm"
  ) {
    answerDialog(false);
  }
}
</script>

<template>
  <dialog
    ref="dialog"
    class="app-dialog"
    :aria-label="currentDialog?.title"
    @cancel.prevent="cancel"
    @keydown="onKeydown"
    @click="onBackdropClick"
  >
    <div
      v-if="currentDialog"
      class="dialog-body"
    >
      <h2>{{ currentDialog.title }}</h2>

      <p
        v-if="currentDialog.message"
        class="dialog-message"
      >
        {{ currentDialog.message }}
      </p>

      <footer class="dialog-actions">
        <PillButton
          v-if="currentDialog.kind === 'confirm'"
          ref="cancelButton"
          @click="answerDialog(false)"
        >
          Cancel
        </PillButton>

        <PillButton
          ref="confirmButton"
          :variant="currentDialog.destructive ? 'danger' : 'primary'"
          @click="answerDialog(true)"
        >
          {{ currentDialog.confirmLabel }}
        </PillButton>
      </footer>
    </div>
  </dialog>
</template>

<style scoped>
.app-dialog {
  width: 420px;
  max-width: calc(100vw - 32px);
  padding: 0;

  border: 1px solid var(--border);
  border-radius: 14px;

  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-lg);
}

.app-dialog::backdrop {
  background: var(--overlay);
}

.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  padding: 20px 22px 18px;
}

.dialog-body h2 {
  margin: 0;

  font-size: var(--font-size-lg);
}

.dialog-message {
  margin: 0;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-base);
  white-space: pre-line;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;

  margin-top: 0.5rem;
}

/* iPad : cibles tactiles d'au moins 44 px. */
@media (pointer: coarse) {
  .dialog-actions .pill-button {
    min-height: 44px;
    min-width: 88px;
  }
}
</style>
