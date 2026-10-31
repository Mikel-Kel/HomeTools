<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from "vue";

import PillButton from "@/components/ui/PillButton.vue";
import SegmentedControl from "@/components/ui/SegmentedControl.vue";
import StatusPill from "@/components/ui/StatusPill.vue";
import TagSheet from "@/components/masterData/TagSheet.vue";

import { ACC_TAG_TYPE, type AllocationTag } from "@/contracts/allocationTags";
import { DOC_TAG_TYPE, type DocumentTag } from "@/contracts/documentTags";

import {
  fromAllocationTag,
  fromDocumentTag,
  type TagItem,
  type TagType,
} from "@/components/masterData/tagItems";

import { formatInteger } from "@/utils/amountFormat";
import { usePersistentRef } from "@/composables/usePersistentRef";

/* =========================
   Section « Tags » de la page Master data

   Deux familles : Spending (tags des mouvements, Acc) et
   Documents (tags des archives, Doc). Tags dans leur ordre
   d'affichage (numéro d'ordre puis identifiant), avec leur
   usage et, pour les documents, leur couleur. Recherche sur
   le libellé, filtre « Unused only ». Création,
   modification et suppression par fiche (TagSheet).
========================= */

const props = defineProps<{
  allocationTags: AllocationTag[] | null;
  documentTags: DocumentTag[] | null;
}>();

const familyOptions: {
  value: TagType;
  label: string;
}[] = [
  { value: ACC_TAG_TYPE, label: "Spending" },
  { value: DOC_TAG_TYPE, label: "Documents" },
];

const family =
  usePersistentRef<TagType>("masterData.tags.family", ACC_TAG_TYPE);

const query =
  usePersistentRef("masterData.tags.query", "");

const unusedOnly =
  usePersistentRef("masterData.tags.unusedOnly", false);

/* null : fichier de la famille pas encore chargé. */
const tags =
  computed<TagItem[] | null>(() =>
    family.value === DOC_TAG_TYPE
      ? props.documentTags?.map(fromDocumentTag) ?? null
      : props.allocationTags?.map(fromAllocationTag) ?? null
  );

function normalize(
  value: string
): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

const filteredTags =
  computed(() => {
    const text =
      normalize(query.value);

    return (tags.value ?? []).filter(
      tag =>
        (!unusedOnly.value || tag.used === false) &&
        (!text || normalize(tag.label).includes(text))
    );
  });

/* undefined : fiche fermée ; null : nouveau tag. */
const sheetTag =
  ref<TagItem | null | undefined>(undefined);

/* Changer de famille ferme la fiche. */
watch(
  family,

  () => {
    sheetTag.value = undefined;
  }
);
</script>

<template>
  <section class="panel">
    <header class="panel-header">
      <SegmentedControl
        v-model="family"
        :options="familyOptions"
      />

      <span
        v-if="tags"
        class="panel-actions"
      >
        <span class="count">
          {{ formatInteger(filteredTags.length) }} / {{ formatInteger(tags.length) }}
        </span>

        <PillButton @click="sheetTag = null">
          + Tag
        </PillButton>
      </span>
    </header>

    <p
      v-if="!tags"
      class="empty"
    >
      Loading tags…
    </p>

    <template v-else>
      <div class="filter-line">
        <input
          v-model="query"
          type="search"
          class="search-input"
          placeholder="Search"
          autocomplete="off"
          spellcheck="false"
        />

        <PillButton
          :active="unusedOnly"
          @click="unusedOnly = !unusedOnly"
        >
          Unused only
        </PillButton>
      </div>

      <p
        v-if="!filteredTags.length"
        class="empty"
      >
        No tag found.
      </p>

      <ul
        v-else
        class="item-list"
      >
        <li
          v-for="tag in filteredTags"
          :key="tag.id"
        >
          <button
            type="button"
            class="item-row"
            @click="sheetTag = tag"
          >
            <span class="item-label">
              <span
                v-if="tag.color"
                class="color-dot"
                :style="{ background: tag.color }"
              ></span>

              {{ tag.label }}
            </span>

            <span class="item-meta">
              <StatusPill
                v-if="tag.reserved"
                dashed
              >
                Reserved
              </StatusPill>

              <StatusPill
                v-else-if="tag.used === false"
                dashed
              >
                Unused
              </StatusPill>

              <span
                class="item-count"
                :title="tag.countLabel"
              >
                {{ tag.count === null ? "–" : formatInteger(tag.count) }}
              </span>

              <span
                class="item-seq"
                title="Order"
              >
                {{ tag.seq }}
              </span>
            </span>
          </button>
        </li>
      </ul>
    </template>

    <TagSheet
      v-if="sheetTag !== undefined && tags"
      :key="family"
      :tag-type="family"
      :tag="sheetTag"
      :tags="tags"
      @close="sheetTag = undefined"
    />
  </section>
</template>

<style scoped>
.panel {
  max-width: 640px;
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
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.count {
  color: var(--text-soft);
  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
}

.filter-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;

  margin-bottom: 0.5rem;
}

.search-input {
  flex: 1;
  min-width: 10rem;
  box-sizing: border-box;

  padding: 6px 10px;

  border: 1px solid var(--input-border);
  border-radius: 8px;

  font-size: var(--font-size-sm);
}

.empty {
  margin: 0.5rem 0;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
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
  justify-content: space-between;
  gap: 0.75rem;

  min-height: 36px;
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

.item-label {
  min-width: 0;

  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.color-dot {
  display: inline-block;
  flex-shrink: 0;

  width: 0.7rem;
  height: 0.7rem;
  margin-right: 0.5rem;

  border: 1px solid var(--border-strong);
  border-radius: 50%;

  vertical-align: -1px;
}

.item-meta {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: 0.5rem;
}

.item-count,
.item-seq {
  min-width: 2.5rem;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.item-seq {
  color: var(--text-muted);
}
</style>
