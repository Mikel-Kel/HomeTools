<script setup lang="ts">
import type { Allocation } from "@/composables/allocations/useAllocation";
import { useAllocationLabels } from "@/composables/allocations/useAllocationLabels";

import { formatAmount } from "@/utils/amountFormat";
import { formatDate } from "@/utils/dateFormat";

/* =========================
   Lignes d'allocation d'un mouvement

   Une ligne par allocation : commentaire, date d'allocation
   (si elle diffère de la date de valeur), tag, catégorie ›
   sous-catégorie et montant. Libellés : useAllocationLabels.

   editable : boutons « ✎ » (reprendre la ligne dans le
   formulaire, un second appui annule) et « ✕ » (retirer),
   signalés au parent par edit et remove ; ligne en cours de
   modification surlignée (editingId). Sans editable :
   lecture seule.
========================= */

withDefaults(
  defineProps<{
    lines: Allocation[];

    /* Date de valeur du mouvement : date d'allocation affichée seulement si elle diffère. */
    valueDate: string;

    editable?: boolean;
    editingId?: string | null;
    disabled?: boolean;
  }>(),
  {
    editable: false,
    editingId: null,
    disabled: false,
  }
);

const emit = defineEmits<{
  edit: [index: number];
  remove: [index: number];
}>();

const {
  categoryLabel,
  subCategoryLabel,
  tagLabel,
} = useAllocationLabels();
</script>

<template>
  <table class="allocation-lines">
    <tbody>
      <tr
        v-for="(line, index) in lines"
        :key="line.id"
        :class="{ editing: editable && line.id === editingId }"
      >
        <td class="alloc-text">
          <div class="alloc-comment-row">
            <span class="alloc-comment">
              {{ line.comment || "(no comment)" }}
            </span>

            <span
              v-if="line.allocationDate && line.allocationDate !== valueDate"
              class="alloc-badge"
              :title="line.allocationDate"
            >
              {{ formatDate(line.allocationDate, "short") }}
            </span>

            <span
              v-if="line.allocatedTagID"
              class="alloc-badge alloc-tag"
            >
              {{ tagLabel(line.allocatedTagID) }}
            </span>
          </div>

          <div class="alloc-category">
            {{ categoryLabel(line.categoryID) }}

            <span v-if="line.subCategoryID">
              › {{ subCategoryLabel(line.categoryID, line.subCategoryID) }}
            </span>
          </div>
        </td>

        <td class="alloc-amount">
          {{ formatAmount(line.amount) }}
        </td>

        <td
          v-if="editable"
          class="alloc-action"
        >
          <button
            type="button"
            class="alloc-edit"
            :disabled="disabled"
            :title="line.id === editingId ? 'Cancel edit' : 'Edit allocation'"
            @click="emit('edit', index)"
          >
            ✎
          </button>

          <button
            type="button"
            class="alloc-remove"
            :disabled="disabled"
            title="Remove allocation"
            @click="emit('remove', index)"
          >
            ✕
          </button>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.allocation-lines {
  width: 100%;
  border-collapse: collapse;
}

.allocation-lines td {
  padding: 6px 4px;
  border-bottom: 1px solid var(--border);
  font-size: 0.9rem;
}

.allocation-lines tr.editing {
  background: var(--primary-soft);
}

.alloc-comment-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.alloc-comment {
  font-size: 0.95rem;
  font-weight: 500;
}

.alloc-badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface-soft);
  color: var(--text-soft);
  font-size: 0.68rem;
  font-weight: 600;
  white-space: nowrap;
}

.alloc-tag {
  font-weight: 700;
}

.alloc-category {
  font-size: 0.75rem;
  color: var(--text-soft);
}

.alloc-amount {
  font-weight: 500;
  text-align: right;
}

.alloc-action {
  white-space: nowrap;
}

.alloc-action button {
  background: none;
  border: none;
  color: var(--negative);
}

.alloc-action button.alloc-edit {
  color: var(--primary);
}
</style>
