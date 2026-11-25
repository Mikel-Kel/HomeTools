<script setup lang="ts">
import type { AllocationSuggestion } from "@/contracts/spending";

import {
  sourceText,
  sourceTitle,
} from "@/components/allocation/suggestionSource";

/* =========================
   Source de la suggestion appliquée

   Discrète et entre parenthèses, sous le formulaire
   d'allocation, hors du panneau des propositions.
========================= */

defineProps<{
  applied: AllocationSuggestion;
}>();
</script>

<template>
  <p
    class="suggestion-source"
    :title="sourceTitle(applied)"
  >
    ({{ sourceText(applied) }})
  </p>
</template>

<style scoped>
/* Collée au commentaire, malgré l'espacement du formulaire. */
.suggestion-source {
  margin: -0.4rem 0 0;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
  font-style: italic;
}
</style>
