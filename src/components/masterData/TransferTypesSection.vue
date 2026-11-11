<script setup lang="ts">
import {
  computed,
  ref,
} from "vue";

import PillButton from "@/components/ui/PillButton.vue";
import StatusPill from "@/components/ui/StatusPill.vue";
import TransferTypeSheet from "@/components/masterData/TransferTypeSheet.vue";

import {
  isTransferTypeUsed,
  type TransferType,
  type TransferTypesData,
} from "@/contracts/transferTypes";

import { formatInteger } from "@/utils/amountFormat";
import { usePersistentRef } from "@/composables/usePersistentRef";

/* =========================
   Section « Transfer types » de la page Master data

   Types d'opération bancaire (famille de « Spending »),
   triés par identifiant :
   recherche (identifiant, libellé, qui contient le code
   bancaire, ou opération), filtre « Unused only ».
   Création, modification et suppression par fiche
   (TransferTypeSheet), ouverte par un clic sur la ligne.
   Le titre du panneau (slot « title ») est fourni par la
   section.
========================= */

const props = defineProps<{
  /* null : fichier pas encore chargé. */
  data: TransferTypesData | null;
}>();

const query =
  usePersistentRef("masterData.transferTypes.query", "");

const unusedOnly =
  usePersistentRef("masterData.transferTypes.unusedOnly", false);

const filteredTypes =
  computed(() => {
    const text =
      query.value.trim().toLowerCase();

    return (props.data?.transferTypes ?? []).filter(
      type =>
        (!unusedOnly.value || !isTransferTypeUsed(type)) &&
        (!text ||
          String(type.id).includes(text) ||
          type.label.toLowerCase().includes(text) ||
          (type.operation ?? "").toLowerCase().includes(text))
    );
  });

/* =========================
   Fiche

   undefined : fermée ; null : nouveau type.
========================= */

const sheetType =
  ref<TransferType | null | undefined>(undefined);
</script>

<template>
  <section class="panel">
    <header class="panel-header">
      <slot name="title" />

      <span
        v-if="data"
        class="panel-actions"
      >
        <span class="count">
          {{ formatInteger(filteredTypes.length) }} / {{ formatInteger(data.transferTypes.length) }}
        </span>

        <PillButton @click="sheetType = null">
          + Transfer type
        </PillButton>
      </span>
    </header>

    <p
      v-if="!data"
      class="empty"
    >
      Loading transfer types…
    </p>

    <template v-else>
      <div class="search-line">
        <input
          v-model="query"
          type="search"
          class="search-input"
          placeholder="ID, label, bank code or operation"
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
        v-if="!filteredTypes.length"
        class="empty"
      >
        No transfer type found.
      </p>

      <div
        v-else
        class="table-wrapper"
      >
        <table class="types-table">
          <thead>
            <tr>
              <th class="col-id">ID</th>
              <th>Label</th>
              <th>Operation</th>
              <th>Keyword</th>
              <th>Pattern</th>
              <th
                class="col-usage"
                title="Movements / allocation rules"
              >
                Usage
              </th>
              <th class="col-status"></th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="type in filteredTypes"
              :key="type.id"
              class="clickable-row"
              @click="sheetType = type"
            >
              <td class="col-id">{{ type.id }}</td>
              <td class="col-label">{{ type.label }}</td>
              <td class="soft">{{ type.operation ?? "" }}</td>
              <td class="soft">{{ type.keyword ?? "" }}</td>
              <td class="soft pattern">{{ type.descriptionPattern ?? "" }}</td>

              <td
                class="col-usage"
                :title="`${type.usage.movements} movements · ${type.usage.rules} rules`"
              >
                {{ formatInteger(type.usage.movements) }} / {{ formatInteger(type.usage.rules) }}
              </td>

              <td class="col-status">
                <StatusPill v-if="type.reserved">
                  Reserved
                </StatusPill>

                <StatusPill
                  v-else-if="!isTransferTypeUsed(type)"
                  dashed
                >
                  Unused
                </StatusPill>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <TransferTypeSheet
      v-if="data && sheetType !== undefined"
      :transfer-type="sheetType"
      :data="data"
      @close="sheetType = undefined"
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

.panel-actions {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.panel-header :slotted(h2) {
  margin: 0;

  font-size: var(--font-size-lg);
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

/* =========================
   Table
========================= */

.table-wrapper {
  max-height: 70vh;
  overflow: auto;
}

.types-table {
  width: 100%;

  border-collapse: collapse;

  font-size: var(--font-size-sm);
}

.types-table th {
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

.types-table td {
  padding: 6px 10px;

  border-bottom: 1px solid var(--border);

  vertical-align: middle;
}

.clickable-row {
  cursor: pointer;
}

.clickable-row:hover {
  background: var(--bg-soft);
}

.col-id,
.col-usage {
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}

.types-table th.col-id,
.types-table th.col-usage {
  text-align: right;
}

.col-label {
  font-weight: 600;
}

.col-status {
  width: 1%;
  white-space: nowrap;
}

.soft {
  color: var(--text-soft);
}

.pattern {
  font-family: ui-monospace, Menlo, monospace;
  font-size: var(--font-size-xs);
}
</style>
