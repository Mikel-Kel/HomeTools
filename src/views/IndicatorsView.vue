<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from "vue";

import PageHeader from "@/components/PageHeader.vue";
import PillButton from "@/components/ui/PillButton.vue";
import SegmentedControl from "@/components/ui/SegmentedControl.vue";
import StatusPill from "@/components/ui/StatusPill.vue";
import IndicatorSheet from "@/components/indicators/IndicatorSheet.vue";
import MarketQuotes from "@/components/indicators/MarketQuotes.vue";

import { useRemoteJson } from "@/composables/useRemoteJson";
import { useEventRequest } from "@/composables/useEventRequest";

import {
  ENTRY_FAMILY_IDS,
  INDICATORS_FILE,
  INDICATORS_FOLDER,
  MARKET_FAMILY_ID,
  MARKET_FAMILY_LABEL,
  VEHICLES_FAMILY_ID,
  indicatorValuesFile,
  isCarriedForward,
  isMeasuredDuring,
  readIndicatorValues,
  readIndicators,
  type IndicatorItem,
  type IndicatorValue,
} from "@/contracts/indicators";

import {
  formatInteger,
  formatMeasure,
} from "@/utils/amountFormat";

import { formatDate } from "@/utils/dateFormat";
import { detectDevice } from "@/utils/deviceDetection";

import {
  sanDue,
  serviceDateDue,
  serviceKmState,
  type DateDue,
  type DueState,
} from "@/utils/vehicleService";

/* =========================
   Page Indicators

   Valeurs d'une famille à une fin de mois, pour les
   indicateurs mesurés ce mois-là (entre leur date
   d'ouverture et leur date de clôture). Contrat :
   src/contracts/indicators.ts.

   Relevé à faire : valeur absente, ou recopiée du mois
   précédent (« <- last known value »). Ces lignes sont
   mises en évidence.
========================= */

interface IndicatorRow {
  item: IndicatorItem;
  current: IndicatorValue | null;
  previous: IndicatorValue | null;

  /* Compteurs : relevé moins le relevé précédent. */
  consumption: number | null;

  toRead: boolean;

  /* Véhicules : prochain service moins le kilométrage. */
  remainingKm: number | null;

  /* Véhicules : échéances à la date du relevé. */
  kmState: DueState;
  serviceDate: DateDue;
  san: DateDue;
}

/* =========================
   Data
========================= */

const familyId =
  ref<number>(VEHICLES_FAMILY_ID);

const indicatorsFile =
  useRemoteJson({
    folder: INDICATORS_FOLDER,
    file: INDICATORS_FILE,
    read: readIndicators,
  });

const valuesFile =
  useRemoteJson({
    folder: INDICATORS_FOLDER,
    file: () =>
      familyId.value === MARKET_FAMILY_ID
        ? null
        : indicatorValuesFile(familyId.value),
    read: readIndicatorValues,
  });

const loadError =
  computed(() =>
    indicatorsFile.error.value ??
    valuesFile.error.value
  );

const loading =
  computed(() =>
    indicatorsFile.data.value === null &&
    !loadError.value
  );

const familyOptions =
  computed(() =>
    (indicatorsFile.data.value?.families ?? [])
      .filter(
        family =>
          ENTRY_FAMILY_IDS.includes(
            family.familyId
          )
      )
      .sort((a, b) => a.seq - b.seq)
      .map(
        family => ({
          value: family.familyId,
          label: family.label,
        })
      )
      .concat({
        value: MARKET_FAMILY_ID,
        label: MARKET_FAMILY_LABEL,
      })
  );

/*
  Market data : derniers cours en consultation
  (MarketQuotes.vue), sans mois ni saisie.
*/
const isMarket =
  computed(() =>
    familyId.value === MARKET_FAMILY_ID
  );

const isVehicles =
  computed(() =>
    familyId.value === VEHICLES_FAMILY_ID
  );

/* =========================
   Month

   Toujours un dernier jour de mois (AAAA-MM-JJ), au plus
   tard la fin du mois en cours.
========================= */

function monthEnd(
  year: number,
  monthIndex: number
): string {
  const date =
    new Date(year, monthIndex + 1, 0);

  return formatDate(date, "iso");
}

function shiftMonth(
  date: string,
  months: number
): string {
  const [year, month] =
    date.split("-").map(Number);

  return monthEnd(
    year,
    month - 1 + months
  );
}

const today =
  new Date();

const currentMonthEnd =
  monthEnd(
    today.getFullYear(),
    today.getMonth()
  );

const month =
  ref<string | null>(null);

/*
  Premier chargement : le dernier mois qui a des valeurs
  (ou le mois précédent si la famille est vide).
*/
watch(
  () => valuesFile.data.value,

  values => {
    if (month.value !== null || !values) {
      return;
    }

    const latest =
      values.reduce(
        (max, value) =>
          value.date > max ? value.date : max,
        ""
      );

    month.value =
      latest ||
      shiftMonth(currentMonthEnd, -1);
  }
);

const monthLabel =
  computed(() => {
    if (!month.value) {
      return "";
    }

    return new Date(`${month.value}T12:00:00`)
      .toLocaleDateString(
        "en-GB",
        {
          month: "long",
          year: "numeric",
        }
      );
  });

const canGoNext =
  computed(() =>
    month.value !== null &&
    month.value < currentMonthEnd
  );

function goToMonth(
  months: number
) {
  if (!month.value) {
    return;
  }

  const next =
    shiftMonth(month.value, months);

  if (next <= currentMonthEnd) {
    month.value = next;
  }
}

/* =========================
   Rows
========================= */

const valuesByItem =
  computed(() => {
    const index =
      new Map<number, IndicatorValue[]>();

    for (const value of valuesFile.data.value ?? []) {
      const list =
        index.get(value.itemId) ?? [];

      list.push(value);
      index.set(value.itemId, list);
    }

    for (const list of index.values()) {
      list.sort((a, b) =>
        a.date.localeCompare(b.date)
      );
    }

    return index;
  });

const rows =
  computed<IndicatorRow[]>(() => {
    const date =
      month.value;

    if (!date) {
      return [];
    }

    return (indicatorsFile.data.value?.items ?? [])
      .filter(
        item =>
          item.familyId === familyId.value &&
          isMeasuredDuring(item, date, date)
      )
      .sort((a, b) =>
        a.seq - b.seq ||
        a.label.localeCompare(b.label)
      )
      .map(item => {
        const values =
          valuesByItem.value.get(item.itemId) ?? [];

        const current =
          values.find(value => value.date === date) ??
          null;

        const previous =
          values
            .filter(value => value.date < date)
            .at(-1) ??
          null;

        const base =
          current?.initialValue ??
          previous?.value ??
          null;

        const lastKnown =
          current?.value ??
          previous?.value ??
          null;

        const nextServiceKm =
          item.service?.nextServiceKm ??
          null;

        const remainingKm =
          nextServiceKm !== null &&
          lastKnown !== null
            ? nextServiceKm - lastKnown
            : null;

        return {
          item,
          current,
          previous,

          consumption:
            item.cumulative &&
            current &&
            base !== null
              ? current.value - base
              : null,

          toRead:
            !current ||
            isCarriedForward(current.comment),

          remainingKm,

          kmState:
            serviceKmState(
              remainingKm,
              item.service
            ),

          serviceDate:
            serviceDateDue(
              item.service,
              date
            ),

          san:
            sanDue(
              item.service,
              date
            ),
        };
      });
  });

/*
  Échéance proche ou dépassée : texte en couleur d'état,
  sans pastille.
*/
function dueClass(
  state: DueState
): string {
  return state === "ok"
    ? ""
    : `due-${state}`;
}

const toReadCount =
  computed(() =>
    rows.value.filter(
      row => row.toRead
    ).length
  );

/* =========================
   Indicator sheet
========================= */

const editedRow =
  ref<IndicatorRow | null>(null);

/* =========================
   New month (ancien « + »)

   events/PWA-IND_<AAAAMMJJHHMMSS>_NEWMONTH.json : pour le
   mois affiché, le Mac recopie la dernière valeur des
   compteurs actifs sans valeur (« <- last known value »),
   dans toutes les familles saisies.
========================= */

const newMonthRequest =
  useEventRequest({
    trigram: "IND",
    noAnswerDelayMs: 2 * 60 * 1000,
  });

const missingCounters =
  computed(() =>
    rows.value.filter(
      row =>
        row.item.cumulative &&
        !row.current
    ).length
  );

const canStartMonth =
  computed(() =>
    missingCounters.value > 0 &&
    !newMonthRequest.inProgress.value
  );

async function startMonth() {
  if (!canStartMonth.value || !month.value) {
    return;
  }

  const confirmed =
    confirm(
      `Start ${monthLabel.value}?\n\n` +
      "The last known value of every active counter without a " +
      `${monthLabel.value} value is copied, marked “last known value”.`
    );

  if (!confirmed) {
    return;
  }

  await newMonthRequest.send(
    {
      eventType: "INDICATOR_MONTH_CREATED",
      version: 1,
      timestamp: new Date().toISOString(),
      payload: {
        date: month.value,
        familyIds: ENTRY_FAMILY_IDS,
        source: detectDevice(),
      },
    },
    "NEWMONTH"
  );
}

const newMonthMessage =
  computed(() => {
    const current =
      newMonthRequest.request.value;

    switch (current?.phase) {
      case "requested":
        return newMonthRequest.noAnswerYet.value
          ? "Requested — no answer from the Mac yet. Check that it is on and reachable."
          : "Requested — waiting for the Mac…";

      case "started":
        return "Copying the last known values on the Mac…";

      case "completed":
        return "Month started.";

      case "error":
        return `Rejected: ${current.message ?? "unknown error"}`;

      default:
        return "";
    }
  });
</script>

<template>
  <PageHeader
    title="Indicators"
    icon="indicators"
  />

  <div
    v-if="loadError"
    class="state-message error"
  >
    {{ loadError }}
  </div>

  <div
    v-else-if="loading"
    class="state-message"
  >
    Loading indicators…
  </div>

  <main
    v-else
    class="indicators-view"
  >
    <!-- Filters -->

    <section class="filters">
      <SegmentedControl
        v-model="familyId"
        :options="familyOptions"
      />

      <template v-if="!isMarket">
        <div class="month-nav">
          <PillButton
            aria-label="Previous month"
            @click="goToMonth(-1)"
          >
            ‹
          </PillButton>

          <span class="month-label">
            {{ monthLabel }}
          </span>

          <PillButton
            aria-label="Next month"
            :disabled="!canGoNext"
            @click="goToMonth(1)"
          >
            ›
          </PillButton>
        </div>

        <StatusPill
          v-if="toReadCount"
          tone="warning"
        >
          {{ toReadCount }} to read
        </StatusPill>

        <PillButton
          @click="
            $router.push({
              name: 'indicatorHistory',
              query: { family: String(familyId) },
            })
          "
        >
          History
        </PillButton>

        <PillButton
          v-if="canStartMonth"
          @click="startMonth"
        >
          + Start {{ monthLabel }}
        </PillButton>

        <span
          v-if="newMonthMessage"
          class="request-message"
          :class="newMonthRequest.request.value?.phase"
        >
          {{ newMonthMessage }}
        </span>
      </template>
    </section>

    <!-- Values -->

    <MarketQuotes v-if="isMarket" />

    <section
      v-else
      class="table-wrapper"
    >
      <table class="indicators-table">
        <thead>
          <tr>
            <th class="label-cell">Indicator</th>
            <th>Value</th>
            <th>Month</th>

            <template v-if="isVehicles">
              <th>Next service</th>
              <th>In…</th>
              <th>Last service</th>
              <th>SAN</th>
            </template>

            <th class="comment-cell">Comment</th>
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="row in rows"
            :key="row.item.itemId"
            class="indicator-row"
            :class="{ 'to-read': row.toRead }"
            title="Enter or correct this value"
            @click="editedRow = row"
          >
            <th class="label-cell">
              {{ row.item.label }}

              <span class="item-description">
                {{ row.item.description }}
              </span>
            </th>

            <td>
              {{ formatMeasure(row.current?.value) }}
            </td>

            <td class="consumption-cell">
              {{
                row.consumption === null
                  ? ""
                  : formatMeasure(row.consumption)
              }}
            </td>

            <template v-if="isVehicles">
              <td>
                {{ formatInteger(row.item.service?.nextServiceKm) }}
              </td>

              <td>
                <span
                  :class="dueClass(row.kmState)"
                  :title="
                    row.kmState === 'overdue'
                      ? 'Service kilometres exceeded'
                      : row.kmState === 'soon'
                        ? 'Service kilometres coming up'
                        : undefined
                  "
                >
                  {{ formatInteger(row.remainingKm) }}
                </span>
              </td>

              <td>
                <span
                  :class="dueClass(row.serviceDate.state)"
                  :title="
                    row.serviceDate.due
                      ? `Yearly service due ${formatDate(row.serviceDate.due, 'short')}`
                      : undefined
                  "
                >
                  {{ formatDate(row.item.service?.lastServiceDate, "short") }}
                </span>
              </td>

              <td>
                <span
                  :class="dueClass(row.san.state)"
                  :title="
                    row.san.due
                      ? `Periodic inspection (SAN) due ${formatDate(row.san.due, 'short')}`
                      : undefined
                  "
                >
                  {{ formatDate(row.item.service?.lastSanVisit, "short") }}
                </span>
              </td>
            </template>

            <td class="comment-cell">
              <StatusPill
                v-if="!row.current"
                tone="warning"
              >
                Missing
              </StatusPill>

              <StatusPill
                v-else-if="row.toRead"
                tone="warning"
              >
                Last known value
              </StatusPill>

              <template v-else>
                {{ row.current.comment }}
              </template>
            </td>
          </tr>

          <tr v-if="!rows.length">
            <td
              class="empty-cell"
              :colspan="isVehicles ? 8 : 4"
            >
              No indicator of this family is measured this month.
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </main>

  <IndicatorSheet
    v-if="editedRow && month"
    :key="`${familyId}-${editedRow.item.itemId}-${month}`"
    :family-id="familyId"
    :date="month"
    :month-label="monthLabel"
    :item="editedRow.item"
    :current="editedRow.current"
    :history="valuesByItem.get(editedRow.item.itemId) ?? []"
    @close="editedRow = null"
  />
</template>

<style scoped>
.indicators-view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;

  padding: 1rem 1.5rem 2rem;
}

.state-message {
  padding: 2rem 1.5rem;

  color: var(--text-soft);
}

.state-message.error {
  color: var(--negative);
}

/* =========================
   Filters
========================= */

.filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem 1.5rem;
}

.month-nav {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.month-label {
  min-width: 9rem;

  font-weight: 700;
  text-align: center;
}

/* =========================
   Table
========================= */

.table-wrapper {
  overflow-x: auto;

  border: 1px solid var(--border);
  border-radius: 12px;

  background: var(--surface);
}

.indicators-table {
  width: 100%;
  border-collapse: collapse;

  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
}

.indicators-table th,
.indicators-table td {
  padding: 7px 12px;

  border-bottom: 1px solid var(--border);

  text-align: right;
  white-space: nowrap;
}

.indicators-table thead th {
  background: var(--surface-soft);
  color: var(--text-soft);

  font-size: var(--font-size-xs);
  font-weight: 700;
}

.label-cell {
  position: sticky;
  left: 0;
  z-index: 1;

  background: var(--surface);

  text-align: left !important;
  font-weight: 600;
}

.indicators-table thead .label-cell {
  background: var(--surface-soft);
}

.item-description {
  margin-left: 6px;

  color: var(--text-muted);
  font-size: var(--font-size-xs);
  font-weight: 400;
}

.consumption-cell {
  color: var(--text-soft);
}

.comment-cell {
  width: 100%;

  text-align: left !important;
  white-space: normal;
}

.request-message {
  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

.request-message.completed {
  color: var(--positive);
}

.request-message.error {
  color: var(--negative);
}

.indicator-row {
  cursor: pointer;
}

.indicator-row:hover th,
.indicator-row:hover td {
  background: var(--primary-soft);
}

/*
  Relevé à faire : à saisir en priorité.
*/
tr.to-read th,
tr.to-read td {
  background: color-mix(in srgb, var(--warning) 8%, var(--surface));
}

tr.to-read .label-cell {
  box-shadow: inset 3px 0 0 var(--warning);
}

.due-soon {
  color: var(--warning);
  font-weight: 700;
}

.due-overdue {
  color: var(--negative);
  font-weight: 700;
}

.empty-cell {
  padding: 1.5rem;

  color: var(--text-soft);
  text-align: center !important;
}
</style>
