<script setup lang="ts">
import {
  computed,
  ref,
} from "vue";

import SecuritySheet from "@/components/masterData/SecuritySheet.vue";
import SecurityTypesPanel from "@/components/masterData/SecurityTypesPanel.vue";
import PillButton from "@/components/ui/PillButton.vue";
import SegmentedControl from "@/components/ui/SegmentedControl.vue";
import StatusPill from "@/components/ui/StatusPill.vue";

import { useEventRequest } from "@/composables/useEventRequest";
import { usePersistentRef } from "@/composables/usePersistentRef";
import { useRemoteJson } from "@/composables/useRemoteJson";

import {
  INDICATORS_FOLDER,
  MARKET_HISTORY_FILE,
} from "@/contracts/indicators";

import {
  PORTFOLIO_EVENT_TRIGRAM,
  QUOTE_UNITS,
  readPortfolioMarketChoices,
  securityEventSuffix,
  type Portfolio,
  type PortfolioSecurity,
} from "@/contracts/portfolio";

import { eventFilePattern } from "@/services/events/eventFiles";

/* =========================
   Section « Portfolio » de la page Master data

   Titres du portefeuille : liste et saisie (SecuritySheet),
   à créer avant la première transaction ; leurs types
   (SecurityTypesPanel), à créer avant le premier titre. Les séries de cours
   et les devises proposées viennent de market-history.json,
   chargé à l'ouverture de la section seulement (fichier
   volumineux).

   « Pending » est déduit des événements qui attendent dans
   events/, quel que soit l'appareil.
========================= */

const NO_ANSWER_DELAY_MS =
  2 * 60 * 1000;

const props = defineProps<{
  portfolio: Portfolio;
}>();

type PortfolioFamily =
  | "securities"
  | "types";

const familyOptions: {
  value: PortfolioFamily;
  label: string;
}[] = [
  { value: "securities", label: "Securities" },
  { value: "types", label: "Types" },
];

const family =
  usePersistentRef<PortfolioFamily>("masterData.portfolio.family", "securities");

const typeLabels =
  computed(() =>
    new Map(
      props.portfolio.securityTypes.map(type => [type.securityTypeId, type.label])
    )
  );

function typeLabel(
  security: PortfolioSecurity
): string {
  return security.securityTypeId === null
    ? ""
    : typeLabels.value.get(security.securityTypeId) ?? `Type ${security.securityTypeId}`;
}

const marketFile =
  useRemoteJson({
    folder: INDICATORS_FOLDER,
    file: MARKET_HISTORY_FILE,
    read: readPortfolioMarketChoices,
    watchRemote: false,
  });

const choices =
  computed(() =>
    marketFile.data.value ?? { series: [], currencies: ["CHF"] }
  );

const sortedSecurities =
  computed(() =>
    [...props.portfolio.securities]
      .sort((a, b) => a.label.localeCompare(b.label))
  );

/* Titres présents dans une position, ouverte ou soldée. */
const tradedIds =
  computed(() =>
    new Set(
      [
        ...props.portfolio.positions,
        ...props.portfolio.closedPositions,
      ].map(position => position.securityId)
    )
  );

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
      .filter(suffix => suffix === securityEventSuffix(null))
      .length
  );

function isPending(
  securityId: number
): boolean {
  return waitingSuffixes.value.includes(securityEventSuffix(securityId));
}

function seriesLabel(
  security: PortfolioSecurity
): string {
  if (security.priceIndicatorType === null) {
    return "None";
  }

  return (
    choices.value.series.find(
      series => series.itemId === security.priceIndicatorType
    )?.label ?? `Series ${security.priceIndicatorType}`
  );
}

function unitLabel(
  factor: number
): string {
  return (
    QUOTE_UNITS.find(unit => unit.factor === factor)?.label ??
    `Factor ${factor}`
  );
}

/* undefined : fiche fermée ; null : nouveau titre. */
const editing =
  ref<PortfolioSecurity | null | undefined>(undefined);

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
  <SecurityTypesPanel
    v-if="family === 'types'"
    :types="portfolio.securityTypes"
  >
    <template #title>
      <SegmentedControl
        v-model="family"
        :options="familyOptions"
      />
    </template>
  </SecurityTypesPanel>

  <section
    v-else
    class="panel"
  >
    <div class="panel-header">
      <SegmentedControl
        v-model="family"
        :options="familyOptions"
      />

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
          New security
        </PillButton>
      </div>
    </div>

    <p
      v-if="marketFile.error.value"
      class="load-error"
    >
      Price series unavailable: {{ marketFile.error.value }}
    </p>

    <p
      v-if="!sortedSecurities.length"
      class="empty"
    >
      No security yet.
    </p>

    <div
      v-else
      class="table-scroll"
    >
      <table>
        <thead>
          <tr>
            <th>Security</th>
            <th>Type</th>
            <th>ISIN</th>
            <th>Currency</th>
            <th>Price series</th>
            <th>Quote</th>
            <th />
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="security in sortedSecurities"
            :key="security.securityId"
            :class="{ inactive: !security.active }"
            @click="editing = security"
          >
            <td class="name">{{ security.label }}</td>
            <td :class="{ missing: security.securityTypeId === null }">
              {{ typeLabel(security) || "None" }}
            </td>
            <td>{{ security.isin ?? "" }}</td>
            <td>{{ security.currency }}</td>
            <td>{{ seriesLabel(security) }}</td>
            <td>{{ unitLabel(security.quoteFactor) }}</td>
            <td class="status">
              <StatusPill
                v-if="isPending(security.securityId)"
                tone="warning"
              >
                Pending
              </StatusPill>

              <StatusPill
                v-else-if="!security.active"
                dashed
              >
                Inactive
              </StatusPill>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <SecuritySheet
    v-if="editing !== undefined"
    :security="editing"
    :securities="portfolio.securities"
    :security-types="portfolio.securityTypes"
    :currency-locked="!!editing && tradedIds.has(editing.securityId)"
    :choices="choices"
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

.load-error {
  margin: 0 0 8px;

  color: var(--negative);
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

tbody tr {
  cursor: pointer;
}

tbody tr:hover {
  background: var(--primary-soft);
}

tr.inactive td {
  color: var(--text-muted);
}

.name {
  font-weight: 600;
}

td.missing {
  color: var(--warning);
}

.status {
  text-align: right;
}
</style>
