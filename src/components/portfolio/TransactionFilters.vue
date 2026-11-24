<script setup lang="ts">
import ChipSelector from "@/components/ChipSelector.vue";
import DateChip from "@/components/DateChip.vue";
import PillButton from "@/components/ui/PillButton.vue";

import type { TransactionFilterState } from "@/composables/portfolio/useTransactionFilters";

/* =========================
   Panneau des filtres du journal du portefeuille

   Même présentation que les filtres des mouvements
   (MovementFilters) : en-tête cliquable (ouvre ou ferme le
   panneau), Reset quand il est ouvert ; corps : Custodian,
   Security, Type, Currency (s'il y en a plusieurs), Period,
   dates et montant. État : useTransactionFilters.
========================= */

const props =
  defineProps<{
    filters: TransactionFilterState;
  }>();

const {
  filtersOpen,
  partyItems,
  partyModel,
  securityItems,
  securityModel,
  typeItems,
  typeModel,
  currencyItems,
  currencyModel,
  yearItems,
  yearFilter,
  dateFrom,
  dateTo,
  minAmount,
  maxAmount,
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
    </header>

    <div
      v-if="filtersOpen"
      class="filters-body"
    >
      <ChipSelector
        v-model="partyModel"
        label="Custodian"
        :items="partyItems"
        :multiple="true"
        :show-all="true"
        :align-with-content="true"
      />

      <ChipSelector
        v-if="securityItems.length > 0"
        v-model="securityModel"
        label="Security"
        :items="securityItems"
        :multiple="true"
        :show-all="true"
        :align-with-content="true"
      />

      <ChipSelector
        v-model="typeModel"
        label="Type"
        :items="typeItems"
        :multiple="true"
        :show-all="true"
        :align-with-content="true"
      />

      <ChipSelector
        v-if="currencyItems.length > 1"
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
