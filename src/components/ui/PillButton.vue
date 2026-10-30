<script setup lang="ts">
/* =========================
   Bouton pilule

   - secondary : action ou filtre (Reset, presets, chips) ;
     active = choix sélectionné ;
   - primary   : action principale de la page ;
   - danger    : action destructive (suppression).

   Les attributs natifs (disabled, title, @click…) sont
   transmis au bouton.
========================= */

withDefaults(
  defineProps<{
    variant?: "secondary" | "primary" | "danger";
    active?: boolean;
  }>(),
  {
    variant: "secondary",
    active: false,
  }
);
</script>

<template>
  <button
    type="button"
    class="pill-button"
    :class="[
      variant,
      { active }
    ]"
    :aria-pressed="active || undefined"
  >
    <slot />
  </button>
</template>

<style scoped>
.pill-button {
  flex: none;

  padding: 5px 12px;

  border-radius: 999px;
  border: 1px solid var(--border);

  background: var(--surface-soft);
  color: var(--text-soft);

  font-size: var(--font-size-xs);
  font-weight: 600;
  white-space: nowrap;

  cursor: pointer;
  user-select: none;
  transition: all 0.15s ease;
}

.pill-button:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
}

.pill-button.active,
.pill-button.primary {
  border-color: var(--primary);

  background: var(--primary-soft);
  color: var(--primary);
}

.pill-button.primary {
  padding: 8px 20px;

  font-size: var(--font-size-sm);
  font-weight: 700;
}

.pill-button.danger {
  padding: 8px 20px;

  border-color: var(--negative);

  background: transparent;
  color: var(--negative);

  font-size: var(--font-size-sm);
  font-weight: 700;
}

.pill-button.danger:hover:not(:disabled) {
  border-color: var(--negative);

  background: var(--negative);
  color: var(--surface);
}

.pill-button:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
