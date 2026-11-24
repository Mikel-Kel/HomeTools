<script setup lang="ts">
import {
  computed,
  ref,
} from "vue";

import SecurityTypeSheet from "@/components/masterData/SecurityTypeSheet.vue";
import PillButton from "@/components/ui/PillButton.vue";
import StatusPill from "@/components/ui/StatusPill.vue";

import { useEventRequest } from "@/composables/useEventRequest";

import {
  PORTFOLIO_EVENT_TRIGRAM,
  securityTypeDeleteSuffix,
  securityTypeEventSuffix,
  type PortfolioSecurityType,
} from "@/contracts/portfolio";

import { eventFilePattern } from "@/services/events/eventFiles";

/* =========================
   Types de titres du portefeuille (Master data › Portfolio)

   Liste dans l'ordre publié par le Mac (sortOrder puis
   libellé), avec le nombre de titres de chaque type ; saisie
   par SecurityTypeSheet. « Pending » est déduit des
   événements qui attendent dans events/, quel que soit
   l'appareil.
========================= */

const NO_ANSWER_DELAY_MS =
  2 * 60 * 1000;

defineProps<{
  types: PortfolioSecurityType[];
}>();

const events =
  useEventRequest({
    trigram: PORTFOLIO_EVENT_TRIGRAM,
    noAnswerDelayMs: NO_ANSWER_DELAY_MS,
  });

const eventPattern =
  eventFilePattern(PORTFOLIO_EVENT_TRIGRAM);

const waitingSuffixes =
  computed(() =>
    events.waitingFiles.value
      .map(name => eventPattern.exec(name)?.[1])
      .filter((suffix): suffix is string => !!suffix)
  );

const newWaiting =
  computed(() =>
    waitingSuffixes.value
      .filter(suffix => suffix === securityTypeEventSuffix(null))
      .length
  );

function isPending(
  securityTypeId: number
): boolean {
  return (
    waitingSuffixes.value.includes(securityTypeEventSuffix(securityTypeId)) ||
    waitingSuffixes.value.includes(securityTypeDeleteSuffix(securityTypeId))
  );
}

/* undefined : fiche fermée ; null : nouveau type. */
const editing =
  ref<PortfolioSecurityType | null | undefined>(undefined);

async function closeSheet() {
  editing.value = undefined;
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

      <div class="panel-actions">
        <StatusPill
          v-if="newWaiting"
          tone="warning"
        >
          {{ newWaiting }} new pending
        </StatusPill>

        <PillButton
          variant="primary"
          @click="editing = null"
        >
          New type
        </PillButton>
      </div>
    </div>

    <p
      v-if="!types.length"
      class="empty"
    >
      No security type yet.
    </p>

    <div
      v-else
      class="table-scroll"
    >
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th class="number">Order</th>
            <th class="number">Securities</th>
            <th />
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="type in types"
            :key="type.securityTypeId"
            @click="editing = type"
          >
            <td class="name">{{ type.label }}</td>
            <td class="number">{{ type.sortOrder }}</td>
            <td class="number">{{ type.securityCount }}</td>
            <td class="status">
              <StatusPill
                v-if="isPending(type.securityTypeId)"
                tone="warning"
              >
                Pending
              </StatusPill>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <SecurityTypeSheet
    v-if="editing !== undefined"
    :type="editing"
    :types="types"
    @close="closeSheet"
  />
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
  gap: 0.5rem 1rem;

  margin-bottom: 8px;
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.empty {
  margin: 0;

  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

.table-scroll {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;

  font-size: var(--font-size-sm);
}

th,
td {
  padding: 6px 8px;

  border-bottom: 1px solid var(--border);

  text-align: left;
  white-space: nowrap;
}

th {
  color: var(--text-soft);
  font-weight: 600;
}

th.number,
td.number {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

tbody tr {
  cursor: pointer;
}

tbody tr:hover {
  background: var(--primary-soft);
}

.name {
  font-weight: 600;
}

.status {
  text-align: right;
}
</style>
