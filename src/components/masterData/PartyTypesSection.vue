<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from "vue";

import PillButton from "@/components/ui/PillButton.vue";
import SegmentedControl from "@/components/ui/SegmentedControl.vue";
import StatusPill from "@/components/ui/StatusPill.vue";
import PartySheet from "@/components/masterData/PartySheet.vue";
import PartyTypeSheet from "@/components/masterData/PartyTypeSheet.vue";
import OrderEditor from "@/components/masterData/OrderEditor.vue";

import {
  isFolderType,
  isPartyUsed,
  isVisibleParty,
  RESERVED_PARTY_TYPE_IDS,
  TOURISM_FOLDER_TYPE_ID,
  VARIOUS_FOLDER_TYPE_ID,
  type PartiesData,
  type Party,
  type PartyType,
} from "@/contracts/parties";

import { formatInteger } from "@/utils/amountFormat";

/* =========================
   Section « Party types » de la page Master data

   Trois familles de parties :
   - Standard : les types de partie, avec le nombre de
     parties de chacun ; création, renommage et suppression
     d'un type sans partie (PartyTypeSheet). Le type 0
     (A définir) se renomme mais ne se supprime pas.
   - Tourism, Various : les sous-dossiers d'archives (parties
     des types -2 et -1), dans leur ordre d'affichage ;
     création, renommage et suppression d'un dossier
     inutilisé (PartySheet), ordre par ↑ ↓ (OrderEditor).
   Les parties réservées (-1, 0) ne sont ni affichées ni
   comptées.
========================= */

const props = defineProps<{
  data: PartiesData;
}>();

type PartyFamily =
  | "standard"
  | "tourism"
  | "various";

const familyOptions: {
  value: PartyFamily;
  label: string;
}[] = [
  { value: "standard", label: "Standard" },
  { value: "tourism", label: "Tourism" },
  { value: "various", label: "Various" },
];

const family =
  ref<PartyFamily>("standard");

const folderTypeId =
  computed(() =>
    family.value === "tourism"
      ? TOURISM_FOLDER_TYPE_ID
      : VARIOUS_FOLDER_TYPE_ID
  );

/* =========================
   Standard : types de partie
========================= */

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

/* =========================
   Tourism, Various : sous-dossiers
========================= */

const folders =
  computed(() =>
    props.data.parties
      .filter(
        party =>
          isVisibleParty(party) &&
          party.typeId === folderTypeId.value
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

/* Changer de famille quitte le réordonnancement. */
watch(
  family,

  () => {
    reordering.value = false;
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

      <PillButton
        v-if="family === 'standard'"
        @click="sheetType = null"
      >
        + Type
      </PillButton>

      <span
        v-else-if="!reordering"
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

    <!-- Standard: party types -->

    <ul
      v-if="family === 'standard'"
      class="item-list"
    >
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

    <!-- Tourism, Various: sub-folders -->

    <OrderEditor
      v-else-if="reordering"
      :key="family"
      trigram="PTY"
      event-type="PARTY_ORDER_SAVED"
      :scope="{ typeId: folderTypeId }"
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

    <PartyTypeSheet
      v-if="sheetType !== undefined"
      :type="sheetType"
      :types="data.partyTypes"
      :party-count="sheetType ? counts.get(sheetType.id) ?? 0 : 0"
      @close="sheetType = undefined"
    />

    <PartySheet
      v-if="sheetFolder !== undefined"
      :party="sheetFolder"
      :data="data"
      :default-type-id="folderTypeId"
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
