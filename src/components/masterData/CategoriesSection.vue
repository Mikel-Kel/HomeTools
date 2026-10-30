<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from "vue";

import PillButton from "@/components/ui/PillButton.vue";
import StatusPill from "@/components/ui/StatusPill.vue";
import CategorySheet from "@/components/masterData/CategorySheet.vue";
import OrderEditor from "@/components/masterData/OrderEditor.vue";

import type {
  Category,
  CategoryNature,
  SubCategory,
} from "@/contracts/categories";
import { usePersistentRef } from "@/composables/usePersistentRef";

/* =========================
   Section « Categories » de la page Master data

   À gauche les catégories, dans l'ordre d'affichage ; à
   droite les sous-catégories de la catégorie choisie, les
   clôturées masquées par défaut. Création et modification
   par fiche (CategorySheet), ordre par OrderEditor.
========================= */

const props = defineProps<{
  categories: Category[];
}>();

const NATURE_LABELS: Record<CategoryNature, string> = {
  I: "Income",
  E: "Expense",
  "-": "Neutral",
};

const selectedId =
  usePersistentRef<number | null>("masterData.categories.selectedId", null);

const showClosed =
  usePersistentRef("masterData.categories.showClosed", false);

/*
  Panneau en cours de réordonnancement ; le choix de la
  catégorie est figé pendant ce temps.
*/
const reordering =
  ref<"categories" | "subcategories" | null>(null);

/*
  Catégorie disparue ou pas encore choisie : la première.
*/
watch(
  () => props.categories,

  list => {
    if (!list.some(category => category.id === selectedId.value)) {
      selectedId.value =
        list[0]?.id ?? null;
    }
  },

  {
    immediate: true,
  }
);

const selected =
  computed(() =>
    props.categories.find(
      category => category.id === selectedId.value
    ) ?? null
  );

const closedCount =
  computed(() =>
    selected.value?.subcategories.filter(
      sub => sub.status === "C"
    ).length ?? 0
  );

const visibleSubcategories =
  computed(() =>
    (selected.value?.subcategories ?? []).filter(
      sub => showClosed.value || sub.status === "A"
    )
  );

/* =========================
   Fiches
========================= */

type OpenSheet =
  | { kind: "category"; item: Category | null }
  | { kind: "subcategory"; item: SubCategory | null };

const sheet =
  ref<OpenSheet | null>(null);

function activeCount(
  category: Category
): number {
  return category.subcategories.filter(
    sub => sub.status === "A"
  ).length;
}
</script>

<template>
  <div class="categories-section">
    <!-- Categories -->

    <section class="panel">
      <header class="panel-header">
        <h2>Categories</h2>

        <span
          v-if="reordering === null"
          class="panel-actions"
        >
          <PillButton
            v-if="categories.length > 1"
            @click="reordering = 'categories'"
          >
            Reorder
          </PillButton>

          <PillButton @click="sheet = { kind: 'category', item: null }">
            + Category
          </PillButton>
        </span>
      </header>

      <OrderEditor
        v-if="reordering === 'categories'"
        trigram="CAT"
        event-type="CATEGORY_ORDER_SAVED"
        :scope="{ categoryId: null }"
        :items="categories"
        @close="reordering = null"
      />

      <ul
        v-else
        class="item-list"
      >
        <li
          v-for="category in categories"
          :key="category.id"
        >
          <button
            type="button"
            class="item-row"
            :class="{ selected: category.id === selectedId }"
            :disabled="reordering === 'subcategories'"
            @click="selectedId = category.id"
          >
            <span class="item-label">{{ category.label }}</span>

            <span class="item-meta">
              <StatusPill
                v-if="category.displayScope === 'X'"
                dashed
              >
                Hidden in follow-up
              </StatusPill>

              <StatusPill
                :tone="
                  category.nature === 'I'
                    ? 'positive'
                    : category.nature === 'E'
                      ? 'negative'
                      : 'neutral'
                "
              >
                {{ NATURE_LABELS[category.nature] }}
              </StatusPill>

              <span class="item-count">{{ activeCount(category) }}</span>
            </span>
          </button>
        </li>
      </ul>
    </section>

    <!-- Sub-categories -->

    <section class="panel">
      <header class="panel-header">
        <h2>{{ selected ? selected.label : "Sub-categories" }}</h2>

        <span
          v-if="selected && reordering === null"
          class="panel-actions"
        >
          <PillButton @click="sheet = { kind: 'category', item: selected }">
            Edit category
          </PillButton>

          <PillButton
            v-if="selected.subcategories.length > 1"
            @click="reordering = 'subcategories'"
          >
            Reorder
          </PillButton>

          <PillButton
            v-if="closedCount"
            :active="showClosed"
            @click="showClosed = !showClosed"
          >
            Show closed ({{ closedCount }})
          </PillButton>

          <PillButton @click="sheet = { kind: 'subcategory', item: null }">
            + Sub-category
          </PillButton>
        </span>
      </header>

      <OrderEditor
        v-if="reordering === 'subcategories' && selected"
        trigram="CAT"
        event-type="CATEGORY_ORDER_SAVED"
        :scope="{ categoryId: selected.id }"
        :items="
          selected.subcategories.map(sub => ({
            id: sub.id,
            label: sub.label,
            closed: sub.status === 'C',
          }))
        "
        @close="reordering = null"
      />

      <p
        v-else-if="!visibleSubcategories.length"
        class="empty"
      >
        No sub-category.
      </p>

      <ul
        v-else
        class="item-list"
      >
        <li
          v-for="sub in visibleSubcategories"
          :key="sub.id"
        >
          <button
            type="button"
            class="item-row"
            :class="{ closed: sub.status === 'C' }"
            @click="sheet = { kind: 'subcategory', item: sub }"
          >
            <span class="item-label">{{ sub.label }}</span>

            <span class="item-meta">
              <StatusPill
                v-if="sub.status === 'C'"
                dashed
              >
                Closed
              </StatusPill>
            </span>
          </button>
        </li>
      </ul>
    </section>

    <CategorySheet
      v-if="sheet?.kind === 'category'"
      kind="category"
      :item="sheet.item"
      :siblings="categories"
      @close="sheet = null"
    />

    <CategorySheet
      v-else-if="sheet?.kind === 'subcategory' && selected"
      kind="subcategory"
      :item="sheet.item"
      :category="selected"
      @close="sheet = null"
    />
  </div>
</template>

<style scoped>
.categories-section {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: start;
  gap: 1.25rem;
}

@media (max-width: 760px) {
  .categories-section {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* =========================
   Panels
========================= */

.panel {
  min-width: 0;
  padding: 12px 14px;

  border: 1px solid var(--border);
  border-radius: 12px;

  background: var(--surface);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;

  min-height: 32px;
  margin-bottom: 0.5rem;
}

.panel-header h2 {
  margin: 0;

  font-size: var(--font-size-lg);
}

.panel-actions {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.empty {
  margin: 0.5rem 0;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

/* =========================
   Rows
========================= */

.item-list {
  margin: 0;
  padding: 0;

  list-style: none;
}

.item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;

  width: 100%;
  min-height: 40px;
  padding: 6px 10px;

  border: none;
  border-radius: 8px;

  background: transparent;
  color: var(--text);
  font: inherit;
  text-align: left;
}

button.item-row {
  cursor: pointer;
}

button.item-row:hover:not(:disabled) {
  background: var(--bg-soft);
}

button.item-row:disabled:not(.selected) {
  opacity: 0.5;

  cursor: default;
}

.item-row.selected {
  background: var(--primary-soft);
}

.item-row.closed .item-label {
  color: var(--text-muted);
}

.item-label {
  min-width: 0;

  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-meta {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: 0.5rem;
}

.item-count {
  min-width: 1.5rem;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
</style>
