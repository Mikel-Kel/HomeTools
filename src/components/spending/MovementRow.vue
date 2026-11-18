<script lang="ts">
/* Une seule bulle de conversion ouverte à la fois, toutes lignes confondues. */
let closeOpenPopover:
  (() => void) | null = null;
</script>

<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  ref,
} from "vue";

import {
  isForeignMovement,
  type Movement,
} from "@/composables/spending/useSpending";
import { useMovementLabel } from "@/composables/spending/useMovementLabel";

import { formatAmount } from "@/utils/amountFormat";
import { formatDate } from "@/utils/dateFormat";

/* =========================
   Ligne d'un mouvement

   Cellules : date, libellé (et texte de la banque si
   showBankText), porteur, slot status (statut, marqueur…),
   devise et montant. Un appui sur la ligne signale open.

   Mouvement en devise étrangère : montant d'origine affiché
   avec son code ; un appui sur le montant montre 2 s le
   montant en CHF dans une bulle.

   Les colonnes (colgroup, thead) restent à la table du
   parent, dans cet ordre.
========================= */

const props =
  defineProps<{
    record: Movement;
    showBankText: boolean;
  }>();

const emit = defineEmits<{
  open: [];
}>();

const movementLabel =
  useMovementLabel();

const POPOVER_DELAY_MS =
  2000;

const foreign =
  computed(() =>
    isForeignMovement(props.record)
  );

/* Montant d'origine, du signe du montant en CHF. */
const displayedAmount =
  computed(() => {
    if (!foreign.value) {
      return props.record.amount;
    }

    const original =
      Math.abs(props.record.foreignAmount ?? 0);

    return props.record.amount >= 0
      ? original
      : -original;
  });

const popover =
  ref<{ x: number; y: number } | null>(null);

let popoverTimer:
  number | null = null;

function closePopover() {
  popover.value = null;

  if (popoverTimer !== null) {
    window.clearTimeout(popoverTimer);
    popoverTimer = null;
  }

  if (closeOpenPopover === closePopover) {
    closeOpenPopover = null;
  }
}

function showPopover(
  event: MouseEvent
) {
  if (!foreign.value) {
    return;
  }

  closeOpenPopover?.();

  const rect =
    (event.currentTarget as HTMLElement)
      .getBoundingClientRect();

  popover.value = {
    x: rect.right - 10,
    y: rect.top - 8,
  };

  closeOpenPopover =
    closePopover;

  popoverTimer =
    window.setTimeout(
      closePopover,
      POPOVER_DELAY_MS
    );
}

onBeforeUnmount(closePopover);
</script>

<template>
  <tr
    class="movement-row"
    @click="emit('open')"
  >
    <td class="cell-date">
      {{ formatDate(record.date, "compact") }}
    </td>

    <td class="cell-party">
      <div class="movement-label">
        {{ movementLabel.label(record) }}
      </div>

      <div
        v-if="showBankText && movementLabel.secondLine(record)"
        class="bank-text"
      >
        {{ movementLabel.secondLine(record) }}
      </div>
    </td>

    <td class="cell-owner">
      {{ record.owner }}
    </td>

    <td class="cell-status">
      <slot name="status" />
    </td>

    <td class="cell-currency">
      <span
        v-if="foreign"
        class="fx-code"
      >
        {{ record.currency }}
      </span>
    </td>

    <td
      class="cell-amount"
      :class="[
        record.amount >= 0 ? 'positive' : 'negative',
        { foreign },
      ]"
      @click.stop="showPopover"
    >
      {{ formatAmount(displayedAmount, { showPlus: true }) }}
    </td>
  </tr>

  <Teleport to="body">
    <div
      v-if="popover"
      class="fx-popover"
      :style="{
        top: popover.y + 'px',
        left: popover.x + 'px',
      }"
      @click.stop="closePopover"
    >
      {{ formatAmount(record.amount, { showPlus: true }) }}
      CHF
    </div>
  </Teleport>
</template>

<style scoped>
.movement-row:nth-child(even) {
  background: var(--surface-soft);
}

td {
  padding: 8px;
  border-bottom: 1px solid var(--border);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.cell-date,
.cell-owner,
.cell-status {
  text-align: center;
}

.cell-party {
  text-align: left;
}

.movement-label,
.bank-text {
  overflow: hidden;
  text-overflow: ellipsis;
}

.bank-text {
  color: var(--text-soft);
  font-size: var(--font-size-xs);
}

.cell-currency {
  text-align: left;
  padding-left: 0;
  padding-right: 0;
}

.fx-code {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--primary);
}

.cell-amount {
  text-align: right;
  padding-left: 0;
  padding-right: 8px;
}

.cell-amount.foreign {
  cursor: pointer;
}

.cell-amount.positive {
  color: var(--positive);
}

.cell-amount.negative {
  color: var(--negative);
}

.fx-popover {
  position: fixed;
  transform: translate(-100%, -100%);
  background: var(--surface);
  color: var(--text);
  padding: 6px 10px;
  border-radius: 10px;
  font-size: var(--font-size-xs);
  font-weight: 600;
  white-space: nowrap;
  box-shadow: var(--shadow-md);
  animation: fxFade 0.15s ease-out;
  z-index: 1000;
}

@keyframes fxFade {
  from {
    opacity: 0;
    transform:
      translate(
        -100%,
        -90%
      )
      scale(0.95);
  }

  to {
    opacity: 1;
    transform:
      translate(
        -100%,
        -100%
      )
      scale(1);
  }
}
</style>
