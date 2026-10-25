<script setup lang="ts">
import {
  onBeforeUnmount,
  onMounted,
} from "vue";

import PillButton from "@/components/ui/PillButton.vue";

/* =========================
   Mémo budget (consultation)

   Mémo d'une sous-catégorie pour une année, tel que publié
   dans budget.json. La saisie se fait dans la page Budget.
========================= */

defineProps<{
  title: string;
  subtitle: string;
  memo: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

function onKeydown(
  event: KeyboardEvent
) {
  if (event.key === "Escape") {
    emit("close");
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
    @click="emit('close')"
  ></div>

  <section
    class="sheet"
    role="dialog"
    :aria-label="title"
  >
    <header class="sheet-header">
      <h2>{{ title }}</h2>

      <div class="sheet-subtitle">
        {{ subtitle }}
      </div>
    </header>

    <pre class="memo-text">{{ memo }}</pre>

    <footer class="sheet-footer">
      <PillButton @click="emit('close')">
        Close
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

  width: 520px;
  max-width: 92vw;
  max-height: 85vh;

  padding: 22px;

  border-radius: 14px;

  background: var(--surface);
  box-shadow: var(--shadow-lg);

  transform: translate(-50%, -50%);
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

/*
  Police à chasse fixe : les mémos alignent des montants
  avec des espaces.
*/
.memo-text {
  flex: 1;
  overflow-y: auto;

  margin: 0;
  padding: 10px 12px;

  border-radius: 8px;

  background: var(--surface-soft);
  color: var(--text);

  font-family: ui-monospace, Menlo, monospace;
  font-size: var(--font-size-sm);
  line-height: 1.4;
  white-space: pre-wrap;
}

.sheet-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
