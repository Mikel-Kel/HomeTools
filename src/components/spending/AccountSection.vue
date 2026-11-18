<script setup lang="ts">
import { formatAmount } from "@/utils/amountFormat";

/* =========================
   Section d'un compte

   En-tête collant et cliquable : flèche, libellé du compte,
   nombre d'opérations et total (signé, coloré ; ou solde :
   totalIsBalance, sans « + » ; indicatif : en italique ;
   filtré : total d'une partie des mouvements, encadré en
   pointillé ; null : rien). Un appui
   signale toggle ; l'état replié reste au parent.

   Slots :
   - details : information centrée dans l'en-tête (ex. solde
     du compte dans le Ledger) ;
   - actions : boutons après le nombre d'opérations
     (le clic n'atteint pas l'en-tête) ;
   - défaut : contenu du compte, masqué si replié.
========================= */

defineProps<{
  label: string;
  count: number;
  total: number | null;
  totalIsBalance?: boolean;
  totalIndicative?: boolean;
  totalFiltered?: boolean;
  totalTitle?: string;
  collapsed: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
}>();
</script>

<template>
  <section class="account">
    <div class="account-separator"></div>

    <header
      class="account-header"
      @click="emit('toggle')"
    >
      <div class="account-title">
        <span class="arrow">
          {{ collapsed ? "►" : "▼" }}
        </span>

        <h2>{{ label }}</h2>

        <span class="ops-count">
          {{ count }} ops
        </span>

        <span
          v-if="$slots.actions"
          class="account-actions"
          @click.stop
        >
          <slot name="actions" />
        </span>
      </div>

      <div class="account-details">
        <slot name="details" />
      </div>

      <div
        class="total"
        :class="[
          (total ?? 0) >= 0 ? 'positive' : 'negative',
          { indicative: totalIndicative, filtered: totalFiltered },
        ]"
        :title="totalTitle"
      >
        {{ formatAmount(total, { showPlus: !totalIsBalance }) }}
      </div>
    </header>

    <slot v-if="!collapsed" />
  </section>
</template>

<style scoped>
.account {
  margin-bottom: 0.75rem;
}

.account-separator {
  height: 1px;
  background: var(--border);
  margin: 0.25rem 0 0.5rem;
}

.account-header {
  position: sticky;
  top: var(--sticky-height);
  z-index: 120;

  /* Titre à gauche, détails au centre, total à droite. */
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;

  background:
    color-mix(
      in srgb,
      var(--surface-soft) 90%,
      transparent
    );

  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);

  cursor: pointer;
}

.account-title {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  padding-left: 0.5rem;
  flex-wrap: wrap;
  min-width: 0;
}

.account-title h2 {
  font-size: var(--font-size-lg);
  font-weight: 600;
  margin: 0;
}

.ops-count {
  font-size: var(--font-size-sm);
  opacity: 0.6;
  white-space: nowrap;
}

.account-details {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.3rem 0.75rem;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
  text-align: center;
}

.account-actions {
  display: inline-flex;
  align-items: baseline;
  gap: 0.4rem;
}

.total {
  justify-self: end;
  font-weight: 600;
  text-align: right;
  padding-right: 0.5rem;
}

.total.indicative {
  font-style: italic;
}

.total.filtered {
  margin-right: 0.5rem;
  padding: 0 0.4rem;
  border: 1px dashed currentColor;
  border-radius: 6px;
}

.total.positive {
  color: var(--positive);
}

.total.negative {
  color: var(--negative);
}
</style>
