<script setup lang="ts">
import { computed } from "vue";

import StatusPill from "@/components/ui/StatusPill.vue";

import { useAllocationLabels } from "@/composables/allocations/useAllocationLabels";

import { formatDate } from "@/utils/dateFormat";

import type { AllocationSuggestion } from "@/contracts/spending";

/* =========================
   Suggestions d'allocation d'un mouvement

   Candidats de spending.json (contrat des règles
   d'allocation, § 12 et § 19), la suggestion principale en
   premier. Placées sous le commentaire, pour ne pas déplacer
   le formulaire : la source de la suggestion appliquée,
   discrète et entre parenthèses, puis « Other suggestions »,
   les autres candidats ; un appui signale apply. Aucune
   suggestion appliquée (« Same as last » choisi) : pas de
   source, tous les candidats proposés.
========================= */

const props =
  withDefaults(
    defineProps<{
      suggestions: AllocationSuggestion[];
      applied: AllocationSuggestion | null;

      /* Date de valeur : date d'allocation affichée seulement si elle diffère. */
      valueDate: string;

      disabled?: boolean;
    }>(),
    {
      disabled: false,
    }
  );

const emit = defineEmits<{
  apply: [suggestion: AllocationSuggestion];
}>();

const {
  categoryLabel,
  subCategoryLabel,
  tagLabel,
} = useAllocationLabels();

const others =
  computed(() =>
    props.suggestions.filter(
      suggestion => suggestion !== props.applied
    )
  );

function sourceLabel(
  suggestion: AllocationSuggestion
): string {
  switch (suggestion.source) {
    case "rule":
      return "Rule";

    case "learn-party":
    case "learn-text":
      return suggestion.recent === null
        ? "Learned"
        : `Learned ${suggestion.recent}/10`;

    case "party":
      return "Party";

    case "bank":
      return "Bank";
  }
}

function sourceTitle(
  suggestion: AllocationSuggestion
): string {
  switch (suggestion.source) {
    case "rule":
      return suggestion.ruleId === null
        ? "Allocation rule"
        : `Allocation rule ${suggestion.ruleId}`;

    case "learn-party":
      return "Learned from the past allocations of this party";

    case "learn-text":
      return "Learned from the past allocations of similar bank texts";

    case "party":
      return "Party of the movement, no rule nor history";

    case "bank":
      return "Party of the bank, no rule nor history";
  }
}

/* Source sous le commentaire : « Learned 3/10 · for <partie> ». */
function sourceText(
  suggestion: AllocationSuggestion
): string {
  return [
    suggestion.contradicted
      ? `${sourceLabel(suggestion)}, contradicted by history`
      : sourceLabel(suggestion),
    suggestion.allocPartyName
      ? `for ${suggestion.allocPartyName}`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/* Catégorie › sous-catégorie, ou « Party only » pour une règle sans sous-catégorie. */
function suggestionCategory(
  suggestion: AllocationSuggestion
): string {
  const category =
    categoryLabel(suggestion.categoryID);

  const subCategory =
    subCategoryLabel(
      suggestion.categoryID,
      suggestion.subCategoryID
    );

  if (!category) {
    return "Party only";
  }

  return subCategory
    ? `${category} › ${subCategory}`
    : category;
}

/* Partie, commentaire, tag et date d'allocation s'il diffère de la date de valeur. */
function suggestionDetail(
  suggestion: AllocationSuggestion
): string {
  return [
    suggestion.allocPartyName,
    suggestion.allocComment,
    tagLabel(suggestion.tagID),
    suggestion.allocDate &&
    suggestion.allocDate !== props.valueDate
      ? formatDate(suggestion.allocDate, "short")
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
</script>

<template>
  <p
    v-if="applied"
    class="suggestion-source"
    :title="sourceTitle(applied)"
  >
    ({{ sourceText(applied) }})
  </p>

  <div
    v-if="others.length"
    class="suggestions"
  >
    <span class="suggestion-label">Other suggestions</span>

    <button
      v-for="(suggestion, index) in others"
      :key="index"
      type="button"
      class="suggestion-option"
      :disabled="disabled"
      @click="emit('apply', suggestion)"
    >
      <span class="option-text">
        <span class="option-category">
          {{ suggestionCategory(suggestion) }}
        </span>

        <span class="option-detail">
          {{ suggestionDetail(suggestion) }}
        </span>
      </span>

      <StatusPill
        :tone="suggestion.contradicted ? 'warning' : 'neutral'"
        :title="sourceTitle(suggestion)"
      >
        {{ sourceLabel(suggestion) }}
      </StatusPill>
    </button>
  </div>
</template>

<style scoped>
/* Collée au commentaire, malgré l'espacement du formulaire. */
.suggestion-source {
  margin: -0.4rem 0 0;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
  font-style: italic;
}

.suggestions {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  width: 100%;
  max-width: 640px;
}

.suggestion-label {
  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

.suggestion-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;

  padding: 6px 10px;

  border: 1px solid var(--border);
  border-radius: 8px;

  background: var(--surface);
  color: var(--text);

  font: inherit;
  text-align: left;

  cursor: pointer;
}

.suggestion-option:hover:not(:disabled) {
  background: var(--primary-soft);
}

.suggestion-option:disabled {
  cursor: default;
  opacity: 0.6;
}

.option-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.option-category {
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.option-detail {
  color: var(--text-soft);
  font-size: var(--font-size-xs);
  overflow-wrap: anywhere;
}
</style>
