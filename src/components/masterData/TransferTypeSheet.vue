<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from "vue";

import EditSheet from "@/components/masterData/EditSheet.vue";

import { useEventRequest } from "@/composables/useEventRequest";

import {
  isTransferTypeDeletable,
  TRANSFER_TYPE_ID_MAX,
  TRANSFER_TYPE_ID_MIN,
  type TransferType,
  type TransferTypesData,
} from "@/contracts/transferTypes";

import { confirmDialog } from "@/services/dialog/appDialog";

import { deviceName } from "@/services/environment/environmentState";

import { waitingElsewhereMessage } from "@/services/events/requestMessages";

/* =========================
   Fiche type d'opération

   Création (transferType null), modification ou suppression
   d'un type inutilisé et non réservé. Envoi au Mac
   (../Backend/docs/transfertypes-contract.md) :
     events/PWA-TRF_<AAAAMMJJHHMMSS>_T<TransferTypeID>.json
       { "eventType": "TRANSFER_TYPE_SAVED",
         "payload": { "transferTypeId", "create", "label",
                      "operation", "usesCard", "displaySeq",
                      "reversal", "allocRule": { "withDescription",
                      "withParty", "withCard" }, "keyword",
                      "descriptionPattern", "source" } }
     events/PWA-TRF_<AAAAMMJJHHMMSS>_T<TransferTypeID>_DEL.json
       { "eventType": "TRANSFER_TYPE_DELETED",
         "payload": { "transferTypeId", "source" } }
   puis se ferme une fois la demande traitée
   (transferTypes.json republié).

   Fiche complète envoyée à chaque fois ; textes rognés,
   textes vides envoyés comme null.

   Identifiant saisi à la création, proposé dans la plage
   choisie (premier libre après le plus grand identifiant de
   la plage) ; jamais modifié ensuite.
========================= */

const props = defineProps<{
  transferType: TransferType | null;
  data: TransferTypesData;
}>();

const emit = defineEmits<{
  close: [];
}>();

const NO_ANSWER_DELAY_MS =
  2 * 60 * 1000;

const LABEL_MAX_LENGTH = 255;
const OPERATION_MAX_LENGTH = 255;
const KEYWORD_MAX_LENGTH = 20;
const PATTERN_MAX_LENGTH = 30;
const DISPLAY_SEQ_MAX = 9999;

const isNew =
  props.transferType === null;

/* =========================
   Plages d'identifiants (une par banque)
========================= */

interface IdRange {
  key: string;
  label: string;
  min: number;
  max: number;
}

const RANGE_SIZE = 100;

const BANK_RANGES: IdRange[] = [
  { key: "legacy", label: "Legacy", min: TRANSFER_TYPE_ID_MIN, max: 99 },
  { key: "bcv", label: "BCV", min: 100, max: 199 },
  { key: "bcvs", label: "BCVs", min: 200, max: 299 },
  { key: "ubs", label: "UBS", min: 300, max: 399 },
];

/* Réservés hors plage (Solde initial, Report) : ignorés pour la nouvelle plage. */
const RESERVED_HIGH_IDS = [998, 999];

const takenIds =
  computed(() =>
    new Set(
      props.data.transferTypes.map(type => type.id)
    )
  );

/* Centaine suivant le plus grand identifiant utilisé. */
const newRange =
  computed<IdRange>(() => {
    const highest =
      Math.max(
        0,
        ...props.data.transferTypes
          .map(type => type.id)
          .filter(id => !RESERVED_HIGH_IDS.includes(id))
      );

    const min =
      Math.max(
        BANK_RANGES[BANK_RANGES.length - 1].max + 1,
        (Math.floor(highest / RANGE_SIZE) + 1) * RANGE_SIZE
      );

    return {
      key: "new",
      label: "New range",
      min,
      max: min + RANGE_SIZE - 1,
    };
  });

const ranges =
  computed(() => [
    ...BANK_RANGES,
    newRange.value,
  ]);

function rangeLabel(
  range: IdRange
): string {
  return `${range.label} (${range.min}–${range.max})`;
}

/* Premier libre après le plus grand identifiant de la plage, sinon premier trou. */
function proposedId(
  range: IdRange
): number | null {
  const inRange =
    props.data.transferTypes
      .map(type => type.id)
      .filter(id => id >= range.min && id <= range.max);

  const next =
    inRange.length
      ? Math.max(...inRange) + 1
      : range.min;

  if (next <= range.max) {
    return next;
  }

  for (let id = range.min; id <= range.max; id++) {
    if (!takenIds.value.has(id)) {
      return id;
    }
  }

  return null;
}

const rangeKey =
  ref(BANK_RANGES[BANK_RANGES.length - 1].key);

const idInput =
  ref<number | null>(
    isNew
      ? proposedId(BANK_RANGES[BANK_RANGES.length - 1])
      : props.transferType!.id
  );

function chooseRange(
  key: string
) {
  rangeKey.value = key;

  const range =
    ranges.value.find(item => item.key === key);

  if (range) {
    idInput.value =
      proposedId(range);
  }
}

/* =========================
   Saisie

   Valeurs d'origine figées à l'ouverture : une
   republication de transferTypes.json pendant la saisie ne
   l'écrase pas.
========================= */

const original = {
  label: props.transferType?.label ?? "",
  operation: props.transferType?.operation ?? "",
  usesCard: props.transferType?.usesCard ?? false,
  displaySeq: props.transferType?.displaySeq ?? 0,
  reversal: props.transferType?.reversal ?? false,
  withDescription: props.transferType?.allocRule.withDescription ?? false,
  withParty: props.transferType?.allocRule.withParty ?? false,
  withCard: props.transferType?.allocRule.withCard ?? false,
  keyword: props.transferType?.keyword ?? "",
  descriptionPattern: props.transferType?.descriptionPattern ?? "",
};

const label = ref(original.label);
const operation = ref(original.operation);
const usesCard = ref(original.usesCard);
const displaySeq = ref<number | null>(original.displaySeq);
const reversal = ref(original.reversal);
const withDescription = ref(original.withDescription);
const withParty = ref(original.withParty);
const withCard = ref(original.withCard);
const keyword = ref(original.keyword);
const descriptionPattern = ref(original.descriptionPattern);

function clean(
  value: string
): string {
  return value.trim().replace(/\s+/g, " ");
}

const trimmedLabel =
  computed(() => clean(label.value));

const changed =
  computed(() =>
    trimmedLabel.value !== original.label ||
    clean(operation.value) !== original.operation ||
    usesCard.value !== original.usesCard ||
    displaySeq.value !== original.displaySeq ||
    reversal.value !== original.reversal ||
    withDescription.value !== original.withDescription ||
    withParty.value !== original.withParty ||
    withCard.value !== original.withCard ||
    keyword.value.trim() !== original.keyword ||
    descriptionPattern.value.trim() !== original.descriptionPattern
  );

const labelChanged =
  computed(() =>
    !isNew &&
    trimmedLabel.value !== original.label
  );

const title =
  isNew
    ? "New transfer type"
    : props.transferType!.label;

/* =========================
   Contrôles (mêmes refus que le Mac)
========================= */

const formError =
  computed(() => {
    const id =
      idInput.value;

    if (isNew) {
      if (
        id === null ||
        !Number.isInteger(id) ||
        id < TRANSFER_TYPE_ID_MIN ||
        id > TRANSFER_TYPE_ID_MAX
      ) {
        return `The ID is a whole number from ${TRANSFER_TYPE_ID_MIN} to ${TRANSFER_TYPE_ID_MAX}.`;
      }

      if (takenIds.value.has(id)) {
        return `ID ${id} is already used.`;
      }
    }

    if (!trimmedLabel.value) {
      return "The label is required.";
    }

    if (trimmedLabel.value.length > LABEL_MAX_LENGTH) {
      return `The label has at most ${LABEL_MAX_LENGTH} characters.`;
    }

    const key =
      trimmedLabel.value.toLowerCase();

    const homonym =
      props.data.transferTypes.find(
        other =>
          other.id !== props.transferType?.id &&
          other.label.trim().toLowerCase() === key
      );

    if (homonym) {
      return `Label already used by transfer type ${homonym.id}.`;
    }

    if (clean(operation.value).length > OPERATION_MAX_LENGTH) {
      return `The operation has at most ${OPERATION_MAX_LENGTH} characters.`;
    }

    if (keyword.value.trim().length > KEYWORD_MAX_LENGTH) {
      return `The keyword has at most ${KEYWORD_MAX_LENGTH} characters.`;
    }

    const pattern =
      descriptionPattern.value.trim();

    if (pattern.length > PATTERN_MAX_LENGTH) {
      return `The description pattern has at most ${PATTERN_MAX_LENGTH} characters.`;
    }

    if (pattern && pattern.split("*").length !== 2) {
      return "The description pattern contains exactly one *.";
    }

    const seq =
      displaySeq.value;

    if (
      seq === null ||
      !Number.isInteger(seq) ||
      seq < 0 ||
      seq > DISPLAY_SEQ_MAX
    ) {
      return `The display order is a whole number from 0 to ${DISPLAY_SEQ_MAX}.`;
    }

    return "";
  });

/* =========================
   Enregistrement
========================= */

const saveRequest =
  useEventRequest({
    trigram: "TRF",
    noAnswerDelayMs: NO_ANSWER_DELAY_MS,
  });

function fileSuffix(
  id: number
): string {
  return `T${id}`;
}

/*
  Modification de ce type déjà en attente dans events/
  (autre appareil, ou envoyée avant un rechargement).
*/
const waitingElsewhere =
  computed(() =>
    !isNew &&
    saveRequest.request.value === null &&
    saveRequest.waitingFiles.value.some(
      name => name.endsWith(`_${fileSuffix(props.transferType!.id)}.json`)
    )
  );

const canSave =
  computed(() =>
    (isNew || changed.value) &&
    !formError.value &&
    !saveRequest.inProgress.value &&
    !waitingElsewhere.value
  );

async function save() {
  if (!canSave.value || idInput.value === null) {
    return;
  }

  /* L'import retrouve le type par le code bancaire contenu dans son libellé. */
  if (
    labelChanged.value &&
    !(await confirmDialog({
      title: "Change the label of this transfer type?",
      message:
        "Bank imports find this type by the code contained in its label. " +
        "If the code disappears, the next movements of this type will no longer be recognised.",
      confirmLabel: "Continue",
    }))
  ) {
    return;
  }

  const id =
    idInput.value;

  await saveRequest.send(
    {
      eventType: "TRANSFER_TYPE_SAVED",
      version: 1,
      timestamp: new Date().toISOString(),
      payload: {
        transferTypeId: id,
        create: isNew,
        label: trimmedLabel.value,
        operation: clean(operation.value) || null,
        usesCard: usesCard.value,
        displaySeq: displaySeq.value,
        reversal: reversal.value,
        allocRule: {
          withDescription: withDescription.value,
          withParty: withParty.value,
          withCard: withCard.value,
        },
        keyword: keyword.value.trim() || null,
        descriptionPattern: descriptionPattern.value.trim() || null,
        source: deviceName(),
      },
    },
    fileSuffix(id)
  );
}

/* =========================
   Suppression (type inutilisé et non réservé)
========================= */

const canDelete =
  !isNew &&
  isTransferTypeDeletable(props.transferType!);

async function remove() {
  if (
    !canDelete ||
    saveRequest.inProgress.value ||
    !(await confirmDialog({
      title: `Delete the transfer type "${props.transferType!.label}"?`,
      confirmLabel: "Delete",
      destructive: true,
    }))
  ) {
    return;
  }

  await saveRequest.send(
    {
      eventType: "TRANSFER_TYPE_DELETED",
      version: 1,
      timestamp: new Date().toISOString(),
      payload: {
        transferTypeId: props.transferType!.id,
        source: deviceName(),
      },
    },
    `${fileSuffix(props.transferType!.id)}_DEL`
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
      ? waitingElsewhereMessage("A change of this transfer type")
      : isNew || changed.value
        ? formError.value
        : ""
  );

const subtitle =
  computed(() => {
    if (isNew) {
      return "ID chosen now, never changed afterwards";
    }

    const type =
      props.transferType!;

    return [
      `Transfer type ${type.id}`,
      `${type.usage.movements} movements · ${type.usage.rules} rules`,
      ...(type.reserved ? ["Reserved"] : []),
    ].join(" · ");
  });
</script>

<template>
  <EditSheet
    :title="title"
    :subtitle="subtitle"
    :request="saveRequest"
    :changed="changed"
    :can-save="canSave"
    :save-label="isNew ? 'Create' : 'Save'"
    :hint="hint"
    :hint-is-error="!!hint && !waitingElsewhere"
    :can-delete="canDelete"
    @save="save"
    @delete="remove"
    @close="emit('close')"
  >
    <!-- Identifiant -->

    <div
      v-if="isNew"
      class="field"
    >
      <h3>ID</h3>

      <div class="id-line">
        <select
          :value="rangeKey"
          :disabled="saveRequest.inProgress.value"
          @change="chooseRange(($event.target as HTMLSelectElement).value)"
        >
          <option
            v-for="range in ranges"
            :key="range.key"
            :value="range.key"
          >
            {{ rangeLabel(range) }}
          </option>
        </select>

        <input
          v-model.number="idInput"
          type="number"
          class="id-input"
          :min="TRANSFER_TYPE_ID_MIN"
          :max="TRANSFER_TYPE_ID_MAX"
          step="1"
          :disabled="saveRequest.inProgress.value"
        />
      </div>

      <p class="note">
        First free ID after the highest one of the range.
      </p>
    </div>

    <label class="field">
      <h3>Label</h3>

      <input
        v-model="label"
        type="text"
        :maxlength="LABEL_MAX_LENGTH + 10"
        :disabled="saveRequest.inProgress.value"
      />

      <p
        v-if="!isNew"
        class="note"
      >
        Contains the bank code used by the import (e.g. UBS-K70).
      </p>
    </label>

    <label class="field">
      <h3>Operation</h3>

      <input
        v-model="operation"
        type="text"
        list="transfer-type-operations"
        autocomplete="off"
        :maxlength="OPERATION_MAX_LENGTH + 10"
        :disabled="saveRequest.inProgress.value"
      />

      <datalist id="transfer-type-operations">
        <option
          v-for="item in data.operations"
          :key="item"
          :value="item"
        />
      </datalist>
    </label>

    <label class="field">
      <h3>Keyword</h3>

      <input
        v-model="keyword"
        type="text"
        autocomplete="off"
        spellcheck="false"
        :maxlength="KEYWORD_MAX_LENGTH + 10"
        :disabled="saveRequest.inProgress.value"
      />

      <p class="note">
        Paynet sets the PayNet flag at import; other values will be used as filters.
      </p>
    </label>

    <label class="field">
      <h3>Description pattern</h3>

      <input
        v-model="descriptionPattern"
        type="text"
        autocomplete="off"
        spellcheck="false"
        :maxlength="PATTERN_MAX_LENGTH + 10"
        :disabled="saveRequest.inProgress.value"
      />

      <p class="note">
        * = counterparty of the statement, replaced by the party name when it is known and not generic; e.g. Twint de *
      </p>
    </label>

    <div class="field-row">
      <h3>Display order</h3>

      <input
        v-model.number="displaySeq"
        type="number"
        class="seq-input"
        min="0"
        :max="DISPLAY_SEQ_MAX"
        step="1"
        :disabled="saveRequest.inProgress.value"
      />
    </div>

    <div class="checks">
      <label class="check">
        <input
          v-model="usesCard"
          type="checkbox"
          :disabled="saveRequest.inProgress.value"
        />
        Card
      </label>

      <label class="check">
        <input
          v-model="reversal"
          type="checkbox"
          :disabled="saveRequest.inProgress.value"
        />
        Reversal
      </label>
    </div>

    <div class="field">
      <h3>Allocation rules</h3>

      <div class="checks">
        <label class="check">
          <input
            v-model="withDescription"
            type="checkbox"
            :disabled="saveRequest.inProgress.value"
          />
          By description
        </label>

        <label class="check">
          <input
            v-model="withParty"
            type="checkbox"
            :disabled="saveRequest.inProgress.value"
          />
          By party and alias
        </label>

        <label class="check">
          <input
            v-model="withCard"
            type="checkbox"
            :disabled="saveRequest.inProgress.value"
          />
          Card filter
        </label>
      </div>
    </div>
  </EditSheet>
</template>

<style scoped>
.id-line {
  display: flex;
  gap: 0.5rem;
}

.id-line select {
  flex: 1;
  min-width: 0;
}

.id-input {
  width: 7rem;
}

.seq-input {
  width: 6rem;
}

.checks {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.5rem;
}

.check {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;

  font-size: var(--font-size-sm);

  cursor: pointer;
}

.check input {
  width: 18px;
  height: 18px;
  margin: 0;
  padding: 0;
}
</style>
