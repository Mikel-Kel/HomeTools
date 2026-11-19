<script setup lang="ts">
import type { ArchiveSuggestion } from "@/composables/archives/useArchiveSuggestions";

/* =========================
   Suggestions d'un champ de la fiche de classement

   Textes proposés (useArchiveSuggestions), sous le champ,
   alignés sur sa zone de saisie ; celui déjà saisi est
   marqué. Un appui signale apply ; rien n'est affiché sans
   suggestion.
========================= */

defineProps<{
  suggestions: ArchiveSuggestion[];
  current: string;
}>();

const emit = defineEmits<{
  apply: [text: string];
}>();

function title(
  suggestion: ArchiveSuggestion
): string {
  const documents =
    suggestion.count === 1
      ? "1 document"
      : `${suggestion.count} documents`;

  return `Used for ${documents} of this relation (${Math.round(suggestion.confidence * 100)} %)`;
}
</script>

<template>
  <div
    v-if="suggestions.length"
    class="suggestions"
  >
    <button
      v-for="suggestion in suggestions"
      :key="suggestion.text"
      type="button"
      class="suggestion"
      :class="{ active: suggestion.text === current.trim() }"
      :title="title(suggestion)"
      @click="emit('apply', suggestion.text)"
    >
      {{ suggestion.text }}
    </button>
  </div>
</template>

<style scoped>
/* Sous la zone de saisie : largeur du libellé (110 px) + écart (12 px). */
.suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;

  margin: -8px 0 14px 122px;
}

.suggestion {
  max-width: 100%;
  padding: 3px 10px;

  border: 1px solid var(--border);
  border-radius: 999px;

  background: var(--surface);
  color: var(--text);

  font: inherit;
  font-size: var(--font-size-sm);

  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  cursor: pointer;
}

.suggestion:hover {
  background: var(--primary-soft);
}

.suggestion.active {
  border-color: var(--primary);
  background: var(--primary-soft);
  color: var(--primary);
}
</style>
