<script setup lang="ts">
import {
  computed,
  ref,
} from "vue";

import OwnerSubCategoriesSheet from "@/components/masterData/OwnerSubCategoriesSheet.vue";
import PillButton from "@/components/ui/PillButton.vue";
import StatusPill from "@/components/ui/StatusPill.vue";

import { useEventRequest } from "@/composables/useEventRequest";

import {
  MOBILE_EXPENSE_EVENT_TRIGRAM,
  ownerEventSuffix,
  type BankingCards,
  type OwnerSubCategories,
} from "@/contracts/bankingCards";

import type { Category } from "@/contracts/categories";

import { eventFilePattern } from "@/services/events/eventFiles";

/* =========================
   Sous-catégories de chaque propriétaire
   (Master data › iPhone › Sub-categories)

   Un bloc par élément d'ownerSubCategories (bankingCards.json,
   ../Backend/docs/mobile-expense-contract.md, § 3.3), avec ses
   sous-catégories regroupées par catégorie (libellés et
   statuts de categories.json). Les montants du réel et du
   budget restent communs au ménage : seule la liste dépend
   du propriétaire. Modification par OwnerSubCategoriesSheet ;
   propriétaire retiré d'owners : « Clear » seulement.

   « Pending » est déduit des événements qui attendent dans
   events/, quel que soit l'appareil.
========================= */

const NO_ANSWER_DELAY_MS =
  2 * 60 * 1000;

const props = defineProps<{
  data: BankingCards;
  categories: Category[];
}>();

interface SubCategoryLine {
  id: number;
  label: string;
  closed: boolean;
}

interface OwnerBlock {
  item: OwnerSubCategories;
  removed: boolean;
  groups: { label: string; lines: SubCategoryLine[] }[];
}

const blocks =
  computed<OwnerBlock[]>(() =>
    props.data.ownerSubCategories.map(item => {
      const ids =
        new Set(item.subCategoryIds);

      const groups =
        props.categories
          .map(category => ({
            label: category.label,
            lines: category.subcategories
              .filter(sub => ids.has(sub.id))
              .map(sub => ({
                id: sub.id,
                label: sub.label,
                closed: sub.status === "C",
              })),
          }))
          .filter(group => group.lines.length);

      const known =
        new Set(groups.flatMap(group => group.lines.map(line => line.id)));

      const unknown =
        item.subCategoryIds
          .filter(id => !known.has(id))
          .map(id => ({ id, label: `Sub-category ${id}`, closed: true }));

      return {
        item,
        removed: !props.data.owners.includes(item.owner),
        groups: unknown.length
          ? [...groups, { label: "Unknown", lines: unknown }]
          : groups,
      };
    })
  );

const events =
  useEventRequest({
    trigram: MOBILE_EXPENSE_EVENT_TRIGRAM,
    noAnswerDelayMs: NO_ANSWER_DELAY_MS,
  });

const eventPattern =
  eventFilePattern(MOBILE_EXPENSE_EVENT_TRIGRAM);

const waitingSuffixes =
  computed(() =>
    events.waitingFiles.value
      .map(name => eventPattern.exec(name)?.[1])
      .filter((suffix): suffix is string => !!suffix)
  );

function isPending(
  owner: string
): boolean {
  return waitingSuffixes.value.includes(ownerEventSuffix(owner));
}

/* null : fiche fermée. */
const editing =
  ref<OwnerBlock | null>(null);

async function closeSheet() {
  editing.value = null;
  await events.check().catch(
    err =>
      console.warn(
        "Unable to read events",
        err
      )
  );
}
</script>

<template>
  <section class="panel">
    <div class="panel-header">
      <slot name="title" />
    </div>

    <p
      v-if="!blocks.length"
      class="empty"
    >
      No device owner in this environment.
    </p>

    <article
      v-for="block in blocks"
      :key="block.item.owner"
      class="owner"
      :class="{ removed: block.removed }"
    >
      <header class="owner-header">
        <h3>
          {{ block.item.owner }}

          <span class="soft">
            {{ block.item.subCategoryIds.length }} sub-categor{{ block.item.subCategoryIds.length === 1 ? "y" : "ies" }}
          </span>
        </h3>

        <span class="owner-actions">
          <StatusPill
            v-if="isPending(block.item.owner)"
            tone="warning"
          >
            Pending
          </StatusPill>

          <StatusPill
            v-if="block.removed"
            dashed
          >
            Removed
          </StatusPill>

          <PillButton
            v-if="!block.removed || block.item.subCategoryIds.length"
            @click="editing = block"
          >
            {{ block.removed ? "Clear" : "Edit" }}
          </PillButton>
        </span>
      </header>

      <p
        v-if="!block.groups.length"
        class="empty"
      >
        No sub-category offered.
      </p>

      <dl
        v-else
        class="groups"
      >
        <div
          v-for="group in block.groups"
          :key="group.label"
          class="group"
        >
          <dt>{{ group.label }}</dt>

          <dd>
            <span
              v-for="line in group.lines"
              :key="line.id"
              class="line"
              :class="{ closed: line.closed }"
            >
              {{ line.label }}

              <StatusPill
                v-if="line.closed"
                dashed
              >
                Closed
              </StatusPill>
            </span>
          </dd>
        </div>
      </dl>
    </article>
  </section>

  <OwnerSubCategoriesSheet
    v-if="editing"
    :owner="editing.item.owner"
    :sub-category-ids="editing.item.subCategoryIds"
    :categories="categories"
    :removed="editing.removed"
    @close="closeSheet"
  />
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

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
  gap: 0.5rem 1rem;
}

.owner {
  padding-top: 0.75rem;

  border-top: 1px solid var(--border);
}

.owner.removed h3 {
  color: var(--warning);
}

.owner-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;

  margin-bottom: 6px;
}

.owner-header h3 {
  margin: 0;

  font-size: var(--font-size-md);
}

.owner-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.soft,
.empty {
  color: var(--text-soft);
  font-size: var(--font-size-sm);
  font-weight: 400;
}

.empty {
  margin: 0;
}

.groups {
  display: flex;
  flex-direction: column;
  gap: 4px;

  margin: 0;

  font-size: var(--font-size-sm);
}

.group {
  display: grid;
  grid-template-columns: 12rem 1fr;
  gap: 0.75rem;
}

.group dt {
  color: var(--text-soft);
  font-weight: 600;
}

.group dd {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;

  margin: 0;
}

.line {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.line.closed {
  color: var(--text-soft);
}
</style>
