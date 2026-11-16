<script setup lang="ts">
import {
  computed,
  ref,
} from "vue";

import RuleSheet from "@/components/masterData/RuleSheet.vue";
import PillButton from "@/components/ui/PillButton.vue";
import SegmentedControl from "@/components/ui/SegmentedControl.vue";
import StatusPill from "@/components/ui/StatusPill.vue";

import type {
  AllocationRule,
  AllocationRulesData,
} from "@/contracts/allocationRules";

import type { AllocationTag } from "@/contracts/allocationTags";
import type { Category } from "@/contracts/categories";
import type { PartiesData } from "@/contracts/parties";
import type { TransferTypesData } from "@/contracts/transferTypes";

import { usePersistentRef } from "@/composables/usePersistentRef";

import { formatInteger } from "@/utils/amountFormat";

/* =========================
   Section « Rules » de la page Master data

   Règles d'allocation (settings/allocationRules.json,
   ../Backend/docs/allocation-rules-contract.md, § 17), dans
   l'ordre du fichier (règles par texte, puis par partie, la
   générale avant ses exceptions) ou par usage.

   Une ligne par règle : ce qui la déclenche (partie ou texte
   de la banque, type d'opération et porteur facultatifs), ce
   qu'elle propose (catégorie › sous-catégorie, partie
   d'allocation si elle diffère, tag, modèle de commentaire
   et décalage du mois de référence), son usage sur 12 mois
   (mouvements concernés / fois en tête, fois contredite par
   l'historique) ; règle prioritaire (origin « pwa » : créée
   ou modifiée dans la PWA, toujours en tête, § 11) marquée
   « * » après son identifiant, légende sous la liste ;
   règle sans mouvement en 12 mois « Unused ».

   Filtres : recherche (partie, texte, partie d'allocation,
   commentaire), sous-catégorie, « Unused only ».
   Création (« + Rule »), modification et suppression par
   la fiche d'une règle (RuleSheet), ouverte par un clic sur
   la ligne. Le titre du panneau (slot « title ») est fourni
   par la section « Spending ».
========================= */

const props = defineProps<{
  /* null : pas encore publié ou en chargement. */
  rules: AllocationRulesData | null;
  loading: boolean;
  /* null : fichier pas encore chargé. */
  parties: PartiesData | null;
  categories: Category[];
  allocationTags: AllocationTag[] | null;
  transferTypes: TransferTypesData | null;
}>();

type SortKey = "file" | "usage";

/* Sous-catégorie filtrée : 0 toutes, NO_SUB_CATEGORY règles sans sous-catégorie. */
const NO_SUB_CATEGORY = -1;

const query =
  usePersistentRef("masterData.rules.query", "");

const subCategoryFilter =
  usePersistentRef("masterData.rules.subCategory", 0);

const unusedOnly =
  usePersistentRef("masterData.rules.unusedOnly", false);

const sortKey =
  usePersistentRef<SortKey>("masterData.rules.sort", "file");

const sortOptions: { value: SortKey; label: string }[] = [
  { value: "file", label: "Party" },
  { value: "usage", label: "Usage" },
];

/* =========================
   Libellés
========================= */

const partyNames =
  computed(() =>
    new Map((props.parties?.parties ?? []).map(party => [party.id, party.label]))
  );

function partyName(
  id: number | null
): string {
  return id === null
    ? ""
    : partyNames.value.get(id) ?? `#${id}`;
}

/* Sous-catégorie → « Catégorie › Sous-catégorie ». */
const subCategoryLabels =
  computed(() => {
    const labels =
      new Map<number, string>();

    for (const category of props.categories) {
      for (const subCategory of category.subcategories) {
        labels.set(subCategory.id, `${category.label} › ${subCategory.label}`);
      }
    }

    return labels;
  });

function subCategoryLabel(
  id: number | null
): string {
  return id === null
    ? ""
    : subCategoryLabels.value.get(id) ?? `#${id}`;
}

const tagNames =
  computed(() =>
    new Map((props.allocationTags ?? []).map(tag => [tag.id, tag.tagName]))
  );

function tagName(
  id: number
): string {
  return id === 0
    ? ""
    : tagNames.value.get(id) ?? `Tag ${id}`;
}

const transferTypeNames =
  computed(() =>
    new Map(
      (props.transferTypes?.transferTypes ?? []).map(type => [type.id, type.label])
    )
  );

/* Conditions facultatives : type d'opération et porteur. */
function conditions(
  rule: AllocationRule
): string {
  return [
    rule.transferTypeId === null
      ? ""
      : transferTypeNames.value.get(rule.transferTypeId) ?? `Type ${rule.transferTypeId}`,
    rule.holder === null
      ? ""
      : `Holder ${rule.holder}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/* Partie d'allocation (si elle diffère de celle du mouvement) et tag. */
function allocationDetail(
  rule: AllocationRule
): string {
  return [
    rule.allocPartyId === null || rule.allocPartyId === rule.partyId
      ? ""
      : `→ ${partyName(rule.allocPartyId)}`,
    tagName(rule.tagId),
  ]
    .filter(Boolean)
    .join(" · ");
}

function monthOffset(
  offset: number
): string {
  if (offset === 0) {
    return "";
  }

  return offset > 0
    ? `ref. month +${offset}`
    : `ref. month −${-offset}`;
}

/* =========================
   Filtres
========================= */

/* Sous-catégories utilisées par les règles, dans l'ordre des libellés. */
const subCategoryOptions =
  computed(() => {
    const used =
      new Set(
        (props.rules?.rules ?? [])
          .map(rule => rule.subCategoryId)
          .filter((id): id is number => id !== null)
      );

    return [...used]
      .map(id => ({ id, label: subCategoryLabel(id) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });

const hasPartyOnlyRules =
  computed(() =>
    (props.rules?.rules ?? []).some(rule => rule.subCategoryId === null)
  );

/* Comparaison sans casse ni accents. */
function fold(
  value: string
): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

const filteredRules =
  computed(() => {
    const text =
      fold(query.value.trim());

    const rules =
      (props.rules?.rules ?? []).filter(
        rule =>
          (!unusedOnly.value || rule.usage.movements === 0) &&
          (subCategoryFilter.value === 0 ||
            (subCategoryFilter.value === NO_SUB_CATEGORY
              ? rule.subCategoryId === null
              : rule.subCategoryId === subCategoryFilter.value)) &&
          (!text ||
            [
              partyName(rule.partyId),
              rule.matchText ?? "",
              partyName(rule.allocPartyId),
              rule.commentTemplate ?? "",
            ].some(value => fold(value).includes(text)))
      );

    return sortKey.value === "usage"
      ? [...rules].sort(
          (a, b) =>
            b.usage.movements - a.usage.movements ||
            b.usage.first - a.usage.first
        )
      : rules;
  });

/* =========================
   Fiche

   undefined : fermée ; null : nouvelle règle.
========================= */

const sheetRule =
  ref<AllocationRule | null | undefined>(undefined);
</script>

<template>
  <section class="panel">
    <header class="panel-header">
      <slot name="title" />

      <span
        v-if="rules && parties"
        class="panel-actions"
      >
        <span class="count">
          {{ formatInteger(filteredRules.length) }} / {{ formatInteger(rules.rules.length) }}
        </span>

        <PillButton @click="sheetRule = null">
          + Rule
        </PillButton>
      </span>
    </header>

    <p
      v-if="!rules || !parties"
      class="empty"
    >
      {{ loading || !parties ? "Loading the allocation rules…" : "No rules published yet." }}
    </p>

    <template v-else>
      <div class="search-line">
        <input
          v-model="query"
          type="search"
          class="search-input"
          placeholder="Party, bank text or comment"
          autocomplete="off"
          spellcheck="false"
        />

        <select
          v-model="subCategoryFilter"
          class="sub-select"
          aria-label="Sub-category"
        >
          <option :value="0">All sub-categories</option>

          <option
            v-if="hasPartyOnlyRules"
            :value="NO_SUB_CATEGORY"
          >
            None (party only)
          </option>

          <option
            v-for="option in subCategoryOptions"
            :key="option.id"
            :value="option.id"
          >
            {{ option.label }}
          </option>
        </select>

        <PillButton
          :active="unusedOnly"
          @click="unusedOnly = !unusedOnly"
        >
          Unused only
        </PillButton>

        <span class="sort">
          <span class="sort-label">Sort</span>

          <SegmentedControl
            v-model="sortKey"
            :options="sortOptions"
          />
        </span>
      </div>

      <p
        v-if="!filteredRules.length"
        class="empty"
      >
        No rule found.
      </p>

      <div
        v-else
        class="table-wrapper"
      >
        <table class="rules-table">
          <thead>
            <tr>
              <th class="col-id">ID</th>
              <th>When</th>
              <th>Allocation</th>
              <th>Comment</th>
              <th
                class="col-usage"
                title="Last 12 months: movements concerned / suggested first"
              >
                Usage
              </th>
              <th class="col-status"></th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="rule in filteredRules"
              :key="rule.id"
              class="clickable-row"
              @click="sheetRule = rule"
            >
              <td class="col-id">
                {{ rule.id }}<span
                  class="priority"
                  :class="{ shown: rule.origin === 'pwa' }"
                  :title="rule.origin === 'pwa' ? 'Priority rule: always suggested first' : undefined"
                >*</span>
              </td>

              <td>
                <div
                  v-if="rule.kind === 'party'"
                  class="main"
                >
                  {{ partyName(rule.partyId) }}
                </div>

                <div
                  v-else
                  class="main match-text"
                  title="Text found in the bank text"
                >“{{ rule.matchText }}”</div>

                <div
                  v-if="conditions(rule)"
                  class="soft"
                >
                  {{ conditions(rule) }}
                </div>
              </td>

              <td>
                <div :class="{ soft: rule.subCategoryId === null }">
                  {{ rule.subCategoryId === null ? "Party only" : subCategoryLabel(rule.subCategoryId) }}
                </div>

                <div
                  v-if="allocationDetail(rule)"
                  class="soft"
                >
                  {{ allocationDetail(rule) }}
                </div>
              </td>

              <td>
                <div class="template">{{ rule.commentTemplate ?? "" }}</div>

                <div
                  v-if="rule.refMonthOffset"
                  class="soft"
                >
                  {{ monthOffset(rule.refMonthOffset) }}
                </div>
              </td>

              <td
                class="col-usage"
                :title="`${rule.usage.movements} movements · first for ${rule.usage.first} · contradicted ${rule.usage.contradicted}`"
              >
                {{ formatInteger(rule.usage.movements) }} / {{ formatInteger(rule.usage.first) }}

                <div
                  v-if="rule.usage.contradicted"
                  class="contradicted"
                >
                  contradicted {{ formatInteger(rule.usage.contradicted) }}
                </div>
              </td>

              <td class="col-status">
                <StatusPill
                  v-if="rule.usage.movements === 0"
                  dashed
                  title="No movement in the last 12 months"
                >
                  Unused
                </StatusPill>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="legend">
        * Priority rule (created or changed in the app): always suggested first.
        Other rules may yield to the recent history.
      </p>
    </template>

    <RuleSheet
      v-if="rules && parties && sheetRule !== undefined"
      :rule="sheetRule"
      :data="rules"
      :parties="parties"
      :categories="categories"
      :allocation-tags="allocationTags"
      :transfer-types="transferTypes"
      @close="sheetRule = undefined"
    />
  </section>
</template>

<style scoped>
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

/* Toujours la place de l'astérisque : identifiants alignés. */
.priority {
  visibility: hidden;

  margin-left: 2px;

  color: var(--primary);
  font-weight: 700;
}

.priority.shown {
  visibility: visible;
}

.legend {
  margin: 0.5rem 0 0;

  color: var(--text-soft);
  font-size: var(--font-size-xs);
}

.panel-actions {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.clickable-row {
  cursor: pointer;
}

.clickable-row:hover {
  background: var(--bg-soft);
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
   Filtres
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

.sub-select {
  max-width: 18rem;
  box-sizing: border-box;

  padding: 6px 10px;

  border: 1px solid var(--input-border);
  border-radius: 8px;

  font-size: var(--font-size-sm);
}

.sort {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.sort-label {
  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

/* =========================
   Table
========================= */

.table-wrapper {
  max-height: 70vh;
  overflow: auto;
}

.rules-table {
  width: 100%;

  border-collapse: collapse;

  font-size: var(--font-size-sm);
}

.rules-table th {
  position: sticky;
  top: 0;

  padding: 6px 10px;

  border-bottom: 1px solid var(--border);

  background: var(--surface);
  color: var(--text-soft);
  font-weight: 700;
  text-align: left;
  white-space: nowrap;
}

.rules-table td {
  padding: 6px 10px;

  border-bottom: 1px solid var(--border);

  vertical-align: top;
}

.col-id,
.col-usage {
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}

.rules-table th.col-id,
.rules-table th.col-usage {
  text-align: right;
}

.col-status {
  width: 1%;
  white-space: nowrap;
}

.col-status > * + * {
  margin-left: 0.35rem;
}

.main {
  font-weight: 600;
}

/* Texte cherché : espaces de début et de fin significatifs. */
.match-text {
  white-space: pre;
}

.template {
  font-family: ui-monospace, Menlo, monospace;
  font-size: var(--font-size-xs);
}

.soft {
  color: var(--text-soft);
  font-size: var(--font-size-xs);
}

.contradicted {
  color: var(--warning);
  font-size: var(--font-size-xs);
}
</style>
