<script setup lang="ts">
import {
  computed,
  ref,
} from "vue";

import PillButton from "@/components/ui/PillButton.vue";
import StatusPill from "@/components/ui/StatusPill.vue";
import PartySheet from "@/components/masterData/PartySheet.vue";
import OrderEditor from "@/components/masterData/OrderEditor.vue";

import {
  isPartyUsed,
  isVisibleParty,
  type PartiesData,
  type Party,
} from "@/contracts/parties";

import { formatInteger } from "@/utils/amountFormat";

/* =========================
   Sous-dossiers d'archives (Tourism ou Various), page Master data

   Parties du type de dossier (-2 ou -1), dans leur ordre
   d'affichage, avec le nombre d'archives de chacune ;
   création, renommage et suppression d'un dossier inutilisé
   (PartySheet), ordre par ↑ ↓ (OrderEditor). Le titre du
   panneau (slot « title ») est fourni par la section.
========================= */

const props = defineProps<{
  data: PartiesData;
  typeId: number;
}>();

const folders =
  computed(() =>
    props.data.parties
      .filter(
        party =>
          isVisibleParty(party) &&
          party.typeId === props.typeId
      )
      .sort((a, b) =>
        a.seq - b.seq ||
        a.label.localeCompare(b.label)
      )
  );

/* undefined : fiche fermée ; null : nouveau dossier. */
const sheetFolder =
  ref<Party | null | undefined>(undefined);

const reordering =
  ref(false);
</script>

<template>
  <section class="panel">
    <header class="panel-header">
      <slot name="title" />

      <span
        v-if="!reordering"
        class="panel-actions"
      >
        <PillButton
          v-if="folders.length > 1"
          @click="reordering = true"
        >
          Reorder
        </PillButton>

        <PillButton @click="sheetFolder = null">
          + Folder
        </PillButton>
      </span>
    </header>

    <OrderEditor
      v-if="reordering"
      trigram="PTY"
      event-type="PARTY_ORDER_SAVED"
      :scope="{ typeId }"
      :items="folders"
      @close="reordering = false"
    />

    <template v-else>
      <p
        v-if="!folders.length"
        class="empty"
      >
        No folder.
      </p>

      <ul
        v-else
        class="item-list"
      >
        <li
          v-for="folder in folders"
          :key="folder.id"
        >
          <button
            type="button"
            class="item-row"
            @click="sheetFolder = folder"
          >
            <span class="item-label">{{ folder.label }}</span>

            <span class="item-meta">
              <StatusPill
                v-if="!isPartyUsed(folder)"
                dashed
              >
                Unused
              </StatusPill>

              <span
                class="item-count"
                title="Archives"
              >
                {{ formatInteger(folder.usage.archives) }}
              </span>

              <span
                class="item-seq"
                title="Order"
              >
                {{ folder.seq }}
              </span>
            </span>
          </button>
        </li>
      </ul>
    </template>

    <PartySheet
      v-if="sheetFolder !== undefined"
      :party="sheetFolder"
      :data="data"
      :default-type-id="typeId"
      @close="sheetFolder = undefined"
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
