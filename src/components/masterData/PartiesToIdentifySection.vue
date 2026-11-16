<script setup lang="ts">
import {
  computed,
  ref,
} from "vue";

import PillButton from "@/components/ui/PillButton.vue";
import PartySheet from "@/components/masterData/PartySheet.vue";

import {
  isStandardParty,
  type PartiesData,
  type Party,
} from "@/contracts/parties";

import type {
  LabelToIdentify,
  PartiesToIdentifyData,
} from "@/contracts/partiesToIdentify";

import { formatAmount, formatInteger } from "@/utils/amountFormat";
import { formatDate } from "@/utils/dateFormat";
import { usePersistentRef } from "@/composables/usePersistentRef";

/* =========================
   Section « To identify » de la page Master data

   Libellés bancaires dont la contrepartie n'est pas
   identifiée (settings/movementPartyIDToIdentify.json,
   ../Backend/docs/parties-contract.md, § 5), dans l'ordre
   du fichier, avec une recherche.

   Pour un libellé :
   - « Alias… » : choix d'une partie existante, puis sa
     fiche avec l'alias prérempli ;
   - « New party » : fiche vierge avec l'alias prérempli.
   Alias prérempli : counterparty, coupé à 50 caractères,
   modifiable avant l'enregistrement (PARTY_SAVED
   ordinaire). Le message du statut est affiché ; la liste se
   relit quand le Mac la republie avec parties.json.

   Partie suggérée d'après les allocations passées
   (suggestedParty, contrat des règles d'allocation, § 24) :
   « Suggested: <partie> (12 of 13 allocations) » sous le
   libellé, « Use » ouvre la fiche de cette partie avec
   l'alias prérempli ; pour une partie générique, rappel que
   l'alias doit rester propre au tiers. Une indication
   seulement : rien n'est enregistré sans la fiche. Filtre
   « With suggestion ».
========================= */

const props = defineProps<{
  /* null : liste pas encore publiée (ou en chargement). */
  data: PartiesToIdentifyData | null;
  loading: boolean;
  parties: PartiesData;
}>();

const ALIAS_MAX_LENGTH = 50;

/* Parties proposées au plus pendant le choix. */
const PICKER_MAX_RESULTS = 12;

function fold(
  text: string
): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/* Clé d'une entrée : un libellé par banque. */
function entryKey(
  entry: LabelToIdentify
): string {
  return `${entry.bank}\u0000${entry.label}`;
}

/* =========================
   Liste
========================= */

const query =
  usePersistentRef("masterData.toIdentify.query", "");

const withSuggestion =
  usePersistentRef("masterData.toIdentify.withSuggestion", false);

const partiesById =
  computed(() =>
    new Map(props.parties.parties.map(party => [party.id, party]))
  );

/* Partie suggérée, si elle existe encore dans parties.json. */
function suggestedParty(
  entry: LabelToIdentify
): Party | null {
  return entry.suggestedParty
    ? partiesById.value.get(entry.suggestedParty.partyId) ?? null
    : null;
}

/* « 12 of 13 allocations » : allocations à cette partie sur le total. */
function suggestionCount(
  entry: LabelToIdentify
): string {
  const suggestion =
    entry.suggestedParty;

  if (!suggestion) {
    return "";
  }

  const total =
    Math.round(suggestion.allocations / suggestion.share);

  return `${formatInteger(suggestion.allocations)} of ${formatInteger(total)} allocations`;
}

const hasFilters =
  computed(() =>
    query.value.trim() !== "" ||
    withSuggestion.value
  );

function resetFilters() {
  query.value = "";
  withSuggestion.value = false;
}

const suggestionCountTotal =
  computed(() =>
    (props.data?.labels ?? []).filter(entry => suggestedParty(entry)).length
  );

const filteredLabels =
  computed(() => {
    const text =
      fold(query.value.trim());

    return (props.data?.labels ?? []).filter(
      entry =>
        (!withSuggestion.value || suggestedParty(entry)) &&
        (!text ||
        fold(entry.label).includes(text) ||
        fold(entry.bank).includes(text))
    );
  });

/* =========================
   Choix d'une partie (« Alias… »)
========================= */

const pickerKey =
  ref<string | null>(null);

const pickerQuery =
  ref("");

function togglePicker(
  entry: LabelToIdentify
) {
  const key =
    entryKey(entry);

  pickerKey.value =
    pickerKey.value === key ? null : key;

  pickerQuery.value = "";
}

const pickerResults =
  computed(() => {
    const text =
      fold(pickerQuery.value.trim());

    if (!text) {
      return [];
    }

    return props.parties.parties
      .filter(
        party =>
          isStandardParty(party) &&
          (fold(party.label).includes(text) ||
            party.aliases.some(alias => fold(alias).includes(text)))
      )
      .slice(0, PICKER_MAX_RESULTS);
  });

/* =========================
   Fiche

   undefined : fermée ; party null : nouvelle partie.
========================= */

const sheet =
  ref<{ party: Party | null; alias: string } | undefined>(undefined);

function proposedAlias(
  entry: LabelToIdentify
): string {
  return entry.counterparty
    .slice(0, ALIAS_MAX_LENGTH)
    .trimEnd();
}

function openSheet(
  entry: LabelToIdentify,
  party: Party | null
) {
  pickerKey.value = null;

  sheet.value = {
    party,
    alias: proposedAlias(entry),
  };
}

/* Dernier enregistrement : message du statut du Mac. */
const lastResult =
  ref<string | null>(null);

function onSaved(
  message: string | null
) {
  lastResult.value =
    message || "Party saved.";
}
</script>

<template>
  <section class="panel">
    <header class="panel-header">
      <slot name="title" />

      <span
        v-if="data"
        class="count"
      >
        {{ formatInteger(filteredLabels.length) }} / {{ formatInteger(data.labels.length) }} labels
        · {{ formatInteger(data.movements) }} movements since {{ formatDate(data.since, "compact") }}
      </span>
    </header>

    <p
      v-if="lastResult"
      class="result"
    >
      {{ lastResult }}
    </p>

    <p
      v-if="!data"
      class="empty"
    >
      {{ loading ? "Loading the labels to identify…" : "No list published yet." }}
    </p>

    <template v-else>
      <div class="search-line">
        <input
          v-model="query"
          type="search"
          class="search-input"
          placeholder="Bank label or bank"
          autocomplete="off"
          spellcheck="false"
        />

        <PillButton
          v-if="hasFilters"
          @click="resetFilters"
        >
          Reset
        </PillButton>

        <PillButton
          :active="withSuggestion"
          :disabled="!suggestionCountTotal && !withSuggestion"
          @click="withSuggestion = !withSuggestion"
        >
          With suggestion ({{ formatInteger(suggestionCountTotal) }})
        </PillButton>
      </div>

      <p
        v-if="!filteredLabels.length"
        class="empty"
      >
        {{ data.labels.length ? "No label found." : "Every counterparty is identified." }}
      </p>

      <div
        v-else
        class="table-wrapper"
      >
        <table class="labels-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Bank</th>
              <th class="col-number">Count</th>
              <th class="col-date">Last date</th>
              <th class="col-number">Amount</th>
              <th class="col-actions"></th>
            </tr>
          </thead>

          <tbody>
            <template
              v-for="entry in filteredLabels"
              :key="entryKey(entry)"
            >
              <tr>
                <td class="col-label">
                  {{ entry.label }}

                  <div
                    v-if="suggestedParty(entry)"
                    class="suggestion"
                  >
                    <span>
                      Suggested: <strong>{{ suggestedParty(entry)?.label }}</strong>
                      ({{ suggestionCount(entry) }})
                    </span>

                    <PillButton
                      variant="primary"
                      :title="`Add the alias to ${suggestedParty(entry)?.label}`"
                      @click="openSheet(entry, suggestedParty(entry))"
                    >
                      Use
                    </PillButton>

                    <span
                      v-if="entry.suggestedParty?.generic"
                      class="generic-note"
                    >
                      Generic party: keep the alias specific to this merchant (no terminal number).
                    </span>
                  </div>
                </td>
                <td class="soft">{{ entry.bank }}</td>
                <td class="col-number">{{ formatInteger(entry.count) }}</td>

                <td
                  class="col-date"
                  :title="`First: ${formatDate(entry.firstDate, 'compact')}`"
                >
                  {{ formatDate(entry.lastDate, "compact") }}
                </td>

                <td class="col-number">{{ formatAmount(entry.amount) }}</td>

                <td class="col-actions">
                  <PillButton
                    :active="pickerKey === entryKey(entry)"
                    @click="togglePicker(entry)"
                  >
                    Alias…
                  </PillButton>

                  <PillButton @click="openSheet(entry, null)">
                    New party
                  </PillButton>
                </td>
              </tr>

              <tr
                v-if="pickerKey === entryKey(entry)"
                class="picker-row"
              >
                <td colspan="6">
                  <div class="picker">
                    <span class="picker-hint">
                      Add <code>{{ proposedAlias(entry) }}</code> as alias of:
                    </span>

                    <input
                      v-model="pickerQuery"
                      type="search"
                      class="search-input"
                      placeholder="Party name or alias"
                      autocomplete="off"
                      spellcheck="false"
                    />
                  </div>

                  <ul
                    v-if="pickerResults.length"
                    class="picker-list"
                  >
                    <li
                      v-for="party in pickerResults"
                      :key="party.id"
                    >
                      <PillButton @click="openSheet(entry, party)">
                        {{ party.label }}
                      </PillButton>
                    </li>
                  </ul>

                  <p
                    v-else-if="pickerQuery.trim()"
                    class="empty"
                  >
                    No party found.
                  </p>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </template>

    <PartySheet
      v-if="sheet"
      :party="sheet.party"
      :data="parties"
      :initial-alias="sheet.alias"
      @saved="onSaved"
      @close="sheet = undefined"
    />
  </section>
</template>

<style scoped>
.suggestion {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem 0.6rem;

  margin-top: 4px;

  color: var(--text-soft);
  font-size: var(--font-size-xs);
  font-weight: 400;
}

.suggestion strong {
  color: var(--text);
}

.generic-note {
  flex-basis: 100%;

  color: var(--warning);
}

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

.count {
  color: var(--text-soft);
  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
}

.result {
  margin: 0 0 0.75rem;

  color: var(--positive);
  font-size: var(--font-size-sm);
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
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;

  margin-bottom: 0.75rem;
}

.search-input {
  flex: 1;
  min-width: 12rem;
  box-sizing: border-box;

  padding: 6px 10px;

  border: 1px solid var(--input-border);
  border-radius: 8px;

  font-size: var(--font-size-sm);
}

/* Recherche principale raccourcie, Reset juste à sa droite. */
.search-line .search-input {
  flex: 0 1 20rem;
}

/* =========================
   Table
========================= */

.table-wrapper {
  max-height: 70vh;
  overflow: auto;
}

.labels-table {
  width: 100%;

  border-collapse: collapse;

  font-size: var(--font-size-sm);
}

.labels-table th {
  position: sticky;
  top: 0;
  z-index: 1;

  padding: 6px 10px;

  border-bottom: 1px solid var(--border);

  background: var(--surface);
  color: var(--text-soft);
  font-weight: 700;
  text-align: left;
  white-space: nowrap;
}

.labels-table td {
  padding: 6px 10px;

  border-bottom: 1px solid var(--border);

  vertical-align: middle;
}

.col-label {
  overflow-wrap: anywhere;
}

.col-number,
.col-date {
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}

.labels-table th.col-number,
.labels-table th.col-date {
  text-align: right;
}

.col-actions {
  width: 1%;
  white-space: nowrap;
}

.col-actions > * + * {
  margin-left: 0.4rem;
}

.soft {
  color: var(--text-soft);
}

/* =========================
   Picker
========================= */

.picker-row td {
  background: var(--bg-soft);
}

.picker {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
}

.picker-hint {
  color: var(--text-soft);
}

.picker-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;

  margin: 0.5rem 0 0;
  padding: 0;

  list-style: none;
}
</style>
