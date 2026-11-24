<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from "vue";

import EditSheet from "@/components/masterData/EditSheet.vue";

import { useEventRequest } from "@/composables/useEventRequest";

import {
  PORTFOLIO_EVENT_TRIGRAM,
  PORTFOLIO_EVENT_VERSION,
  QUOTE_UNITS,
  securityEventSuffix,
  type PortfolioMarketChoices,
  type PortfolioSecurity,
  type PortfolioSecuritySave,
} from "@/contracts/portfolio";

import {
  CREATED_ON_SERVER,
  waitingElsewhereMessage,
} from "@/services/events/requestMessages";

import { formatQuote } from "@/utils/amountFormat";

/* =========================
   Fiche d'un titre du portefeuille

   Création (security null) ou modification, par l'événement
   SECURITY_SAVED (../Backend/docs/portfolio-contract.md, § 7).
   Le Mac reste juge : son refus est affiché tel quel, par
   exemple une devise changée alors que le titre a des
   transactions.

   - Série de cours : groupe Stocks de market-history.json,
     ou aucune (dernier prix du journal).
   - « Adjusted for splits » : à cocher pour une série Yahoo
     (§ 6.1) ; sans objet sans série.
========================= */

const props = defineProps<{
  security: PortfolioSecurity | null;
  securities: PortfolioSecurity[];
  currencyLocked: boolean;
  choices: PortfolioMarketChoices;
}>();

const emit = defineEmits<{
  close: [];
}>();

const NO_ANSWER_DELAY_MS =
  2 * 60 * 1000;

const LABEL_MAX_LENGTH =
  100;

const ISIN_PATTERN =
  /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

const isNew =
  props.security === null;

const original: Omit<PortfolioSecuritySave, "securityId"> = {
  label: props.security?.label ?? "",
  isin: props.security?.isin ?? null,
  currency: props.security?.currency ?? "CHF",
  priceIndicatorType: props.security?.priceIndicatorType ?? null,
  quoteFactor: props.security?.quoteFactor ?? 1,
  seriesSplitAdjusted: props.security?.seriesSplitAdjusted ?? false,
  active: props.security?.active ?? true,
};

const label =
  ref(original.label);

const isin =
  ref(original.isin ?? "");

const currency =
  ref(original.currency);

const priceIndicatorType =
  ref<number | null>(original.priceIndicatorType);

const quoteFactor =
  ref(original.quoteFactor);

const splitAdjusted =
  ref(original.seriesSplitAdjusted);

const active =
  ref(original.active);

/* Valeur déjà enregistrée, gardée même hors des listes proposées. */
const currencyOptions =
  computed(() =>
    [...new Set([...props.choices.currencies, original.currency])]
  );

const seriesOptions =
  computed(() => {
    const options =
      props.choices.series.map(series => ({
        value: series.itemId,
        label: series.lastValue === null
          ? series.label
          : `${series.label} — ${formatQuote(series.lastValue)} (${series.last})`,
      }));

    if (
      original.priceIndicatorType !== null &&
      !options.some(option => option.value === original.priceIndicatorType)
    ) {
      options.push({
        value: original.priceIndicatorType,
        label: `Series ${original.priceIndicatorType}`,
      });
    }

    return options;
  });

const unitOptions =
  computed(() =>
    QUOTE_UNITS.some(unit => unit.factor === original.quoteFactor)
      ? QUOTE_UNITS
      : [
          ...QUOTE_UNITS,
          { factor: original.quoteFactor, label: `Factor ${original.quoteFactor}` },
        ]
  );

/* Nouveau titre sans libellé : celui de la série choisie. */
watch(
  priceIndicatorType,
  itemId => {
    if (!label.value.trim()) {
      label.value =
        props.choices.series.find(series => series.itemId === itemId)?.label ?? "";
    }
  }
);

const payload =
  computed<PortfolioSecuritySave>(() => ({
    securityId: props.security?.securityId ?? null,
    label: label.value.trim().replace(/\s+/g, " "),
    isin: isin.value.replace(/\s+/g, "").toUpperCase() || null,
    currency: currency.value,
    priceIndicatorType: priceIndicatorType.value,
    quoteFactor: quoteFactor.value,
    seriesSplitAdjusted:
      priceIndicatorType.value !== null && splitAdjusted.value,
    active: active.value,
  }));

const changed =
  computed(() => {
    const value = payload.value;

    return (
      value.label !== original.label ||
      value.isin !== original.isin ||
      value.currency !== original.currency ||
      value.priceIndicatorType !== original.priceIndicatorType ||
      value.quoteFactor !== original.quoteFactor ||
      value.seriesSplitAdjusted !== original.seriesSplitAdjusted ||
      value.active !== original.active
    );
  });

const formError =
  computed(() => {
    const value = payload.value;

    if (!value.label) {
      return "The label is required.";
    }

    if (value.label.length > LABEL_MAX_LENGTH) {
      return `At most ${LABEL_MAX_LENGTH} characters.`;
    }

    const others =
      props.securities.filter(
        other => other.securityId !== value.securityId
      );

    if (others.some(other => other.label === value.label)) {
      return "Already used by another security.";
    }

    if (value.isin && !ISIN_PATTERN.test(value.isin)) {
      return "Invalid ISIN (12 characters, for example XX0000000000).";
    }

    if (value.isin && others.some(other => other.isin === value.isin)) {
      return "ISIN already used by another security.";
    }

    return "";
  });

const saveRequest =
  useEventRequest({
    trigram: PORTFOLIO_EVENT_TRIGRAM,
    noAnswerDelayMs: NO_ANSWER_DELAY_MS,
  });

const fileSuffix =
  securityEventSuffix(props.security?.securityId ?? null);

const waitingElsewhere =
  computed(() =>
    !isNew &&
    saveRequest.request.value === null &&
    saveRequest.waitingFiles.value.some(
      name => name.endsWith(`_${fileSuffix}.json`)
    )
  );

const canSave =
  computed(() =>
    changed.value &&
    !formError.value &&
    !saveRequest.inProgress.value &&
    !waitingElsewhere.value
  );

async function save() {
  if (!canSave.value) {
    return;
  }

  await saveRequest.send(
    {
      version: PORTFOLIO_EVENT_VERSION,
      eventType: "SECURITY_SAVED",
      timestamp: new Date().toISOString(),
      payload: payload.value,
    },
    fileSuffix
  );
}

watch(
  () => saveRequest.request.value?.phase,

  phase => {
    if (phase === "completed") {
      emit("close");
    }
  }
);

const hint =
  computed(() =>
    waitingElsewhere.value
      ? waitingElsewhereMessage("A change of this security")
      : changed.value
        ? formError.value
        : ""
  );

const subtitle =
  isNew
    ? CREATED_ON_SERVER
    : `Security ${props.security!.securityId}`;
</script>

<template>
  <EditSheet
    :title="isNew ? 'New security' : security!.label"
    :subtitle="subtitle"
    :request="saveRequest"
    :changed="changed"
    :can-save="canSave"
    :save-label="isNew ? 'Create' : 'Save'"
    :hint="hint"
    :hint-is-error="!!hint && !waitingElsewhere"
    @save="save"
    @close="emit('close')"
  >
    <label class="field">
      <h3>Price series</h3>

      <select
        v-model="priceIndicatorType"
        :disabled="saveRequest.inProgress.value"
      >
        <option :value="null">None (last transaction price)</option>

        <option
          v-for="option in seriesOptions"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
    </label>

    <label class="field">
      <h3>Label</h3>

      <input
        v-model="label"
        type="text"
        :maxlength="LABEL_MAX_LENGTH"
        :disabled="saveRequest.inProgress.value"
      />
    </label>

    <div class="columns">
      <label class="field">
        <h3>ISIN (optional)</h3>

        <input
          v-model="isin"
          type="text"
          autocapitalize="characters"
          autocomplete="off"
          spellcheck="false"
          :disabled="saveRequest.inProgress.value"
        />
      </label>

      <label class="field">
        <h3>Currency</h3>

        <select
          v-model="currency"
          :disabled="currencyLocked || saveRequest.inProgress.value"
          :title="currencyLocked ? 'This security has transactions' : undefined"
        >
          <option
            v-for="code in currencyOptions"
            :key="code"
            :value="code"
          >
            {{ code }}
          </option>
        </select>
      </label>

      <label class="field">
        <h3>Quote</h3>

        <select
          v-model="quoteFactor"
          :disabled="saveRequest.inProgress.value"
        >
          <option
            v-for="unit in unitOptions"
            :key="unit.factor"
            :value="unit.factor"
          >
            {{ unit.label }}
          </option>
        </select>
      </label>
    </div>

    <label
      v-if="priceIndicatorType !== null"
      class="check"
    >
      <input
        v-model="splitAdjusted"
        type="checkbox"
        :disabled="saveRequest.inProgress.value"
      />
      Price series adjusted for splits (Yahoo)
    </label>

    <label
      v-if="!isNew"
      class="check"
    >
      <input
        v-model="active"
        type="checkbox"
        :disabled="saveRequest.inProgress.value"
      />
      Active
    </label>
  </EditSheet>
</template>

<style scoped>
.columns {
  display: grid;
  grid-template-columns: 2fr 1fr 1.4fr;
  gap: 0.75rem;
}

.columns input,
.columns select {
  width: 100%;
  min-width: 0;
}

.check {
  display: flex;
  align-items: center;
  gap: 0.5rem;

  font-size: var(--font-size-sm);
}
</style>
