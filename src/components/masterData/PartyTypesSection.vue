<script setup lang="ts">
import {
  computed,
  ref,
} from "vue";

import PillButton from "@/components/ui/PillButton.vue";
import StatusPill from "@/components/ui/StatusPill.vue";
import PartyTypeSheet from "@/components/masterData/PartyTypeSheet.vue";

import {
  isFolderType,
  isVisibleParty,
  RESERVED_PARTY_TYPE_IDS,
  type PartiesData,
  type PartyType,
} from "@/contracts/parties";

import { formatInteger } from "@/utils/amountFormat";

/* =========================
   Section « Party types » de la page Master data

   Les types de partie, avec le nombre de parties de chacun ;
   création, renommage et suppression d'un type sans partie
   (PartyTypeSheet). Le type 0 (A définir) se renomme mais ne
   se supprime pas. Les types de dossier d'archives (Tourism,
   Various) sont gérés dans la section Documents ; les
   parties réservées (-1, 0) ne sont pas comptées.
========================= */

const props = defineProps<{
  data: PartiesData;
}>();

const types =
  computed(() =>
    props.data.partyTypes.filter(
      type => !isFolderType(type.id)
    )
  );

const counts =
  computed(() => {
    const map =
      new Map<number, number>();

    for (const party of props.data.parties.filter(isVisibleParty)) {
      map.set(
        party.typeId,
        (map.get(party.typeId) ?? 0) + 1
      );
    }

    return map;
  });

/* undefined : fiche fermée ; null : nouveau type. */
const sheetType =
  ref<PartyType | null | undefined>(undefined);
</script>

<template>
  <section class="panel">
    <header class="panel-header">
      <h2>Party types</h2>

      <PillButton @click="sheetType = null">
        + Type
      </PillButton>
    </header>

    <ul class="item-list">
      <li
        v-for="type in types"
        :key="type.id"
      >
        <button
          type="button"
          class="item-row"
          @click="sheetType = type"
        >
          <span class="item-label">{{ type.label }}</span>

          <span class="item-meta">
            <StatusPill
              v-if="RESERVED_PARTY_TYPE_IDS.includes(type.id)"
              dashed
            >
              Default
            </StatusPill>

            <span
              class="item-count"
              title="Parties"
            >
              {{ formatInteger(counts.get(type.id) ?? 0) }}
            </span>
          </span>
        </button>
      </li>
    </ul>

    <PartyTypeSheet
      v-if="sheetType !== undefined"
      :type="sheetType"
      :types="data.partyTypes"
      :party-count="sheetType ? counts.get(sheetType.id) ?? 0 : 0"
      @close="sheetType = undefined"
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

.item-meta {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: 0.5rem;
}

.item-count {
  min-width: 2.5rem;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
</style>
