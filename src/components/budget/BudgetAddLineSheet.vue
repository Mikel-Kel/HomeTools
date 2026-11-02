<script setup lang="ts">
import {
  onBeforeUnmount,
  onMounted,
} from "vue";

/* =========================
   Ajout d'une ligne au budget d'une année

   Liste les sous-catégories actives sans ligne cette
   année-là, par catégorie ; le choix ouvre la fiche de
   saisie de la ligne (BudgetLineSheet).
========================= */

export interface BudgetAddLineGroup {
  categoryId: number;
  label: string;
  subCategories: {
    id: number;
    label: string;
  }[];
}

defineProps<{
  year: number;
  groups: BudgetAddLineGroup[];
}>();

const emit = defineEmits<{
  pick: [subCategoryId: number];
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
    :aria-label="`Add a line to the budget ${year}`"
  >
    <header class="sheet-header">
      <div>
        <h2>Add a line</h2>

        <div class="sheet-subtitle">
          Active sub-categories not in the budget {{ year }}
        </div>
      </div>

      <button
        type="button"
        class="close-btn"
        aria-label="Close"
        @click="emit('close')"
      >
        ✕
      </button>
    </header>

    <p
      v-if="!groups.length"
      class="empty"
    >
      Every active sub-category matching the filters already has a line.
    </p>

    <div
      v-for="group in groups"
      :key="group.categoryId"
      class="group"
    >
      <h3>{{ group.label }}</h3>

      <ul class="item-list">
        <li
          v-for="sub in group.subCategories"
          :key="sub.id"
        >
          <button
            type="button"
            class="item-row"
            @click="emit('pick', sub.id)"
          >
            {{ sub.label }}
          </button>
        </li>
      </ul>
    </div>
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

  width: 480px;
  max-width: 92vw;
  max-height: 80vh;
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

.empty {
  margin: 0;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

.group h3 {
  margin: 0 0 0.25rem;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
  font-weight: 700;
}

.item-list {
  margin: 0;
  padding: 0;

  list-style: none;
}

.item-row {
  display: flex;
  width: 100%;
  align-items: center;

  min-height: 40px;
  padding: 4px 10px;

  border: none;
  border-radius: 8px;

  background: transparent;
  color: var(--text);
  font: inherit;
  text-align: left;

  cursor: pointer;
}

.item-row:hover {
  background: var(--bg-soft);
}
</style>
