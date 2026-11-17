<script setup lang="ts">
import ChipSelector from "@/components/ChipSelector.vue";
import DateChip from "@/components/DateChip.vue";
import PillButton from "@/components/ui/PillButton.vue";

import type { MovementFilterState } from "@/composables/spending/useMovementFilters";

/* =========================
   Panneau des filtres d'une liste de mouvements

   En-tête cliquable (ouvre ou ferme le panneau), Reset quand
   il est ouvert ; corps : Owner, sélecteurs propres à la
   vue, Currency (s'il y a des devises étrangères), Period,
   dates et montant. État : useMovementFilters.

   Slots :
   - header : options après Reset (le clic n'atteint pas
     l'en-tête) ;
   - selectors : sélecteurs propres à la vue, après Owner.
========================= */

const props =
  defineProps<{
    filters: MovementFilterState;
  }>();

const {
  filtersOpen,
  dateFrom,
  dateTo,
  minAmount,
  maxAmount,
  ownerItems,
  ownerModel,
  currencyItems,
  currencyModel,
  yearFilter,
  yearItems,
  resetFilters,
} = props.filters;
</script>

<template>
  <section class="filters">
    <header
      class="filters-header"
      @click="filtersOpen = !filtersOpen"
    >
      <span class="arrow">
        {{ filtersOpen ? "▼" : "►" }}
      </span>

      <h2>Filters</h2>

      <PillButton
        v-if="filtersOpen"
        @click.stop="resetFilters"
      >
        Reset
      </PillButton>

      <span
        v-if="$slots.header"
        class="header-options"
        @click.stop
      >
        <slot name="header" />
      </span>
    </header>

    <div
      v-if="filtersOpen"
      class="filters-body"
    >
      <ChipSelector
        v-model="ownerModel"
        label="Owner"
        :items="ownerItems"
        :multiple="true"
        :show-all="true"
        :align-with-content="true"
      />

      <slot name="selectors" />

      <ChipSelector
        v-if="currencyItems.length > 0"
        v-model="currencyModel"
        label="Currency"
        :items="currencyItems"
        :multiple="true"
        :show-all="true"
        :align-with-content="true"
      />

      <ChipSelector
        v-model="yearFilter"
        label="Period"
        :items="yearItems"
        :show-all="true"
        :align-with-content="true"
      />

      <div class="filter-row">
        <span class="label"></span>

        <div class="filter-content">
          <div class="inline-fields">
            <DateChip
              v-model="dateFrom"
              placeholder="From"
            />

            <DateChip
              v-model="dateTo"
              placeholder="To"
            />
          </div>
        </div>
      </div>

      <div class="filter-row">
        <span class="label">
          Amount
        </span>

        <div class="filter-content">
          <div class="inline-fields">
            <input
              v-model.number="minAmount"
              type="number"
              min="0"
              step="0.01"
              placeholder="Min"
            />

            <input
              v-model.number="maxAmount"
              type="number"
              min="0"
              step="0.01"
              placeholder="Max"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.filters {
  font-size: var(--font-size-sm);
  background: var(--bg);
}

.filters-header {
  padding: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.filters-header h2 {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-soft);
}

/* Options d'affichage, calées à droite de l'en-tête. */
.header-options {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.filters-body {
  padding: 0.5rem 0.5rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.filter-row {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr);
  align-items: center;
  gap: 0.75rem;
}

.filter-content {
  min-width: 0;
  margin-left: -14px;
}

.inline-fields {
  display: flex;
  gap: 10px;
}

.label {
  font-size: 0.9rem;
  color: var(--text-soft);
}

input {
  width: 80px;
  height: 30px;
  padding: 0 8px;

  border-radius: 18px;
  border: 1px solid var(--border);

  background: var(--surface);
  color: var(--text);

  font-size: var(--font-size-xs);
  font-weight: 600;
  font-family: inherit;
}

input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary-soft);
}
</style>
