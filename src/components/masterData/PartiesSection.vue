<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from "vue";

import ChipSelector from "@/components/ChipSelector.vue";
import PillButton from "@/components/ui/PillButton.vue";
import StatusPill from "@/components/ui/StatusPill.vue";
import PartySheet from "@/components/masterData/PartySheet.vue";

import {
  isFolderType,
  isPartyUsed,
  isStandardParty,
  type PartiesData,
  type Party,
} from "@/contracts/parties";

import { formatInteger } from "@/utils/amountFormat";
import { usePersistentRef } from "@/composables/usePersistentRef";

/* =========================
   Section « Parties » de la page Master data

   À gauche la recherche (nom ou alias) et la liste, filtrée
   par type ; à droite le détail de la partie choisie.
   Création, modification et suppression par fiche
   (PartySheet). Seulement les vraies parties : les dossiers
   d'archives se gèrent dans « Party types », les parties
   réservées (-1, 0) jamais.

   Recherche : une partie est trouvée si son nom ou l'un de
   ses alias contient le texte saisi. Un libellé bancaire
   collé tel quel est aussi reconnu comme le fait le Mac
   (sp_find_allocation_rule) : l'alias le plus long contenu
   dans le texte désigne la partie.
========================= */

const props = defineProps<{
  data: PartiesData;
}>();

/* Texte assez long pour chercher un alias à l'intérieur. */
const BANK_TEXT_MIN_LENGTH = 4;

const query =
  usePersistentRef("masterData.parties.query", "");

/* Type choisi, null = tous. */
const typeFilter =
  usePersistentRef<number | null>("masterData.parties.typeFilter", null);

const typeItems =
  computed(() =>
    props.data.partyTypes
      .filter(type => !isFolderType(type.id))
      .sort((a, b) => a.label.localeCompare(b.label))
      .map(type => ({ id: type.id, label: type.label }))
  );

/* Type retrouvé de la session mais supprimé depuis : tous. */
watch(
  typeItems,

  items => {
    if (
      typeFilter.value !== null &&
      !items.some(item => item.id === typeFilter.value)
    ) {
      typeFilter.value =
        null;
    }
  },

  {
    immediate: true,
  }
);

const unusedOnly =
  usePersistentRef("masterData.parties.unusedOnly", false);

const selectedId =
  ref<number | null>(null);

const typeLabels =
  computed(() =>
    new Map(
      props.data.partyTypes.map(type => [type.id, type.label])
    )
  );

function typeLabel(
  typeId: number
): string {
  return typeLabels.value.get(typeId) ?? `#${typeId}`;
}

const parties =
  computed(() =>
    props.data.parties.filter(isStandardParty)
  );

/* =========================
   Recherche
========================= */

const normalizedQuery =
  computed(() =>
    query.value.trim().toLowerCase()
  );

/*
  Alias le plus long contenu dans le texte saisi (espaces
  compris, sans tenir compte de la casse).
*/
const bankTextMatch =
  computed(() => {
    const text =
      query.value.toLowerCase();

    if (text.trim().length < BANK_TEXT_MIN_LENGTH) {
      return null;
    }

    let best: { party: Party; alias: string } | null = null;

    for (const party of parties.value) {
      for (const alias of party.aliases) {
        if (
          text.includes(alias.toLowerCase()) &&
          (!best || alias.length > best.alias.length)
        ) {
          best = { party, alias };
        }
      }
    }

    return best;
  });

const filteredParties =
  computed(() => {
    const text =
      normalizedQuery.value;

    const matchId =
      bankTextMatch.value?.party.id;

    return parties.value.filter(
      party =>
        (typeFilter.value === null ||
          party.typeId === typeFilter.value) &&
        (!unusedOnly.value || !isPartyUsed(party)) &&
        (!text ||
          party.id === matchId ||
          party.label.toLowerCase().includes(text) ||
          party.aliases.some(
            alias => alias.toLowerCase().includes(text)
          ))
    );
  });

/*
  Partie choisie absente de la liste filtrée : la première.
*/
watch(
  filteredParties,

  list => {
    if (!list.some(party => party.id === selectedId.value)) {
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
    parties.value.find(
      party => party.id === selectedId.value
    ) ?? null
  );

/* =========================
   Fiche

   undefined : fermée ; null : nouvelle partie.
========================= */

const sheetParty =
  ref<Party | null | undefined>(undefined);

/* =========================
   Affichage
========================= */

/*
  Espaces de début et de fin rendus visibles : ils font
  partie de l'alias.
*/
function showAlias(
  alias: string
): string {
  return alias
    .replace(/^ +/, spaces => "␣".repeat(spaces.length))
    .replace(/ +$/, spaces => "␣".repeat(spaces.length));
}

function plural(
  count: number,
  word: string
): string {
  return `${formatInteger(count)} ${word}${count === 1 ? "" : "s"}`;
}

const usageText =
  computed(() => {
    const usage =
      selected.value?.usage;

    if (!usage) {
      return "";
    }

    return [
      plural(usage.allocations, "allocation"),
      plural(usage.rules, "rule"),
      plural(usage.archives, "archive"),
      plural(usage.banks, "bank"),
    ].join(" · ");
  });
</script>

<template>
  <div class="parties-section">
    <!-- Parties -->

    <section class="panel">
      <header class="panel-header">
        <h2>Parties</h2>

        <span class="panel-actions">
          <span class="count">
            {{ formatInteger(filteredParties.length) }} / {{ formatInteger(parties.length) }}
          </span>

          <PillButton @click="sheetParty = null">
            + Party
          </PillButton>
        </span>
      </header>

      <div class="search-line">
        <input
          v-model="query"
          type="search"
          class="search-input"
          placeholder="Name, alias or bank text"
          autocomplete="off"
          spellcheck="false"
        />
      </div>

      <div class="filter-line">
        <PillButton
          :active="unusedOnly"
          @click="unusedOnly = !unusedOnly"
        >
          Unused only
        </PillButton>
      </div>

      <ChipSelector
        v-model="typeFilter"
        label="Type"
        :items="typeItems"
        :bottom-spacing="8"
      />

      <button
        v-if="bankTextMatch"
        type="button"
        class="bank-match"
        @click="selectedId = bankTextMatch.party.id"
      >
        Bank text matches <code>{{ showAlias(bankTextMatch.alias) }}</code>
        → <strong>{{ bankTextMatch.party.label }}</strong>
      </button>

      <p
        v-if="!filteredParties.length"
        class="empty"
      >
        No party found.
      </p>

      <ul
        v-else
        class="item-list"
      >
        <li
          v-for="party in filteredParties"
          :key="party.id"
        >
          <button
            type="button"
            class="item-row"
            :class="{ selected: party.id === selectedId }"
            @click="selectedId = party.id"
          >
            <span class="item-label">{{ party.label }}</span>

            <span class="item-meta">
              <StatusPill
                v-if="!isPartyUsed(party)"
                dashed
              >
                Unused
              </StatusPill>

              <span class="item-type">{{ typeLabel(party.typeId) }}</span>

              <span
                class="item-count"
                :title="`${party.aliases.length} aliases`"
              >
                {{ party.aliases.length || "" }}
              </span>
            </span>
          </button>
        </li>
      </ul>
    </section>

    <!-- Detail -->

    <section class="panel detail">
      <p
        v-if="!selected"
        class="empty"
      >
        Select a party.
      </p>

      <template v-else>
        <header class="panel-header">
          <h2>{{ selected.label }}</h2>

          <span class="panel-actions">
            <StatusPill
              v-if="!isPartyUsed(selected)"
              dashed
            >
              Unused
            </StatusPill>

            <PillButton @click="sheetParty = selected">
              Edit
            </PillButton>
          </span>
        </header>

        <dl class="facts">
          <dt>Type</dt>
          <dd>{{ typeLabel(selected.typeId) }}</dd>

          <dt>ID</dt>
          <dd>{{ selected.id }}</dd>

          <dt>Used by</dt>
          <dd>{{ usageText }}</dd>
        </dl>

        <h3>Aliases</h3>

        <p
          v-if="!selected.aliases.length"
          class="empty"
        >
          No alias.
        </p>

        <ul
          v-else
          class="alias-list"
        >
          <li
            v-for="alias in selected.aliases"
            :key="alias"
            class="alias"
            :class="{ matched: alias === bankTextMatch?.alias && selected.id === bankTextMatch?.party.id }"
          >
            {{ showAlias(alias) }}
          </li>
        </ul>
      </template>
    </section>

    <PartySheet
      v-if="sheetParty !== undefined"
      :party="sheetParty"
      :data="data"
      :default-type-id="typeFilter ?? undefined"
      @close="sheetParty = undefined"
    />
  </div>
</template>

<style scoped>
.parties-section {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: start;
  gap: 1.25rem;
}

@media (max-width: 760px) {
  .parties-section {
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

/* Le détail reste visible pendant le défilement de la liste. */
.panel.detail {
  position: sticky;
  top: 1rem;
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
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.panel-header h2 {
  margin: 0;

  font-size: var(--font-size-lg);
}

h3 {
  margin: 1rem 0 0.5rem;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
  font-weight: 700;
}

.count {
  color: var(--text-soft);
  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
}

.empty {
  margin: 0.5rem 0;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

/* =========================
   Search
========================= */

.search-line {
  display: flex;
  gap: 0.5rem;

  margin-bottom: 0.5rem;
}

.search-input {
  flex: 1;
  min-width: 0;
  box-sizing: border-box;

  padding: 6px 10px;

  border: 1px solid var(--input-border);
  border-radius: 8px;

  font-size: var(--font-size-sm);
}

.filter-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;

  margin-bottom: 0.5rem;
}

.bank-match {
  display: block;

  width: 100%;
  margin-bottom: 0.5rem;
  padding: 6px 10px;

  border: 1px dashed var(--border-strong);
  border-radius: 8px;

  background: var(--bg-soft);
  color: var(--text);
  font: inherit;
  font-size: var(--font-size-sm);
  text-align: left;

  cursor: pointer;
}

.bank-match code {
  font-family: ui-monospace, Menlo, monospace;
}

/* =========================
   Rows
========================= */

.item-list {
  max-height: 65vh;
  margin: 0;
  padding: 0;
  overflow-y: auto;

  list-style: none;
}

.item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;

  width: 100%;
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

.item-row.selected {
  background: var(--primary-soft);
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

.item-type {
  max-width: 9rem;

  overflow: hidden;
  color: var(--text-soft);
  font-size: var(--font-size-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-count {
  min-width: 1.5rem;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

/* =========================
   Detail
========================= */

.facts {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 6px 1rem;

  margin: 0;

  font-size: var(--font-size-sm);
}

.facts dt {
  color: var(--text-soft);
  font-weight: 600;
}

.facts dd {
  margin: 0;
}

.alias-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;

  max-height: 50vh;
  margin: 0;
  padding: 0;
  overflow-y: auto;

  list-style: none;
}

.alias {
  padding: 3px 8px;

  border: 1px solid var(--chip-border);
  border-radius: 999px;

  background: var(--chip-bg);
  font-family: ui-monospace, Menlo, monospace;
  font-size: var(--font-size-xs);
  white-space: pre;
}

.alias.matched {
  border-color: var(--chip-active-border);

  background: var(--chip-active-bg);
}
</style>
