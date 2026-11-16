<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from "vue";

import EditSheet from "@/components/masterData/EditSheet.vue";
import SegmentedControl from "@/components/ui/SegmentedControl.vue";
import SuggestInput from "@/components/ui/SuggestInput.vue";

import { useEventRequest } from "@/composables/useEventRequest";

import {
  type AllocationRule,
  type AllocationRuleKind,
  type AllocationRuleSave,
  type AllocationRulesData,
  checkCommentTemplate,
  COMMENT_MAX_LENGTH,
  MATCH_TEXT_MAX_LENGTH,
  MATCH_TEXT_MIN_LENGTH,
  REF_MONTH_OFFSET_MAX,
  renderCommentTemplate,
  RULE_EVENT_TRIGRAM,
  RULE_EVENT_VERSION,
  ruleEventSuffix,
} from "@/contracts/allocationRules";

import type { AllocationTag } from "@/contracts/allocationTags";
import type { Category } from "@/contracts/categories";
import type { PartiesData } from "@/contracts/parties";
import type { TransferTypesData } from "@/contracts/transferTypes";

import { confirmDialog } from "@/services/dialog/appDialog";
import { deviceName } from "@/services/environment/environmentState";
import { waitingElsewhereMessage } from "@/services/events/requestMessages";

/* =========================
   Fiche d'une règle d'allocation

   Contrat : ../Backend/docs/allocation-rules-contract.md
   (§ 2.2 contrôles, § 3 modèle de commentaire, § 18
   événements). Création (rule null), modification et
   suppression (confirmée), par RULE_SAVED et RULE_DELETED ;
   la fiche se ferme quand le Mac a traité la demande (il
   republie alors les règles et spending.json).

   - Quand : partie du mouvement, ou texte cherché dans le
     libellé de la banque (3 à 50 caractères, jamais rogné) ;
     type d'opération et porteur facultatifs. Genre choisi à
     la création seulement.
   - Allocation : partie (facultative pour une règle par
     partie, obligatoire par texte), sous-catégorie (ou
     aucune : la règle ne propose que la partie), tag.
   - Commentaire : modèle à jetons, avec l'aperçu de son
     rendu pour une date choisie ; décalage du mois de
     référence.
   Une création aux conditions d'une règle existante la
   remplace (signalé) ; une modification aux conditions d'une
   autre règle est bloquée. Toute règle enregistrée ici
   devient prioritaire (origin « pwa »). Le Mac reste juge.
========================= */

const props = defineProps<{
  /* null : nouvelle règle. */
  rule: AllocationRule | null;
  data: AllocationRulesData;
  parties: PartiesData;
  categories: Category[];
  allocationTags: AllocationTag[] | null;
  transferTypes: TransferTypesData | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

const NO_ANSWER_DELAY_MS =
  2 * 60 * 1000;

const isNew =
  props.rule === null;

/* Comparaison sans casse ni accents (collation MySQL). */
function fold(
  value: string
): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/* =========================
   Parties
========================= */

/* Parties réservées (-1, 0) exclues. */
const selectableParties =
  computed(() =>
    props.parties.parties.filter(party => party.id > 0)
  );

const partySuggestions =
  computed(() =>
    selectableParties.value
      .map(party => party.label)
      .sort((a, b) => a.localeCompare(b))
  );

function partyLabel(
  id: number | null
): string {
  return id === null
    ? ""
    : props.parties.parties.find(party => party.id === id)?.label ?? "";
}

/* Partie dont le libellé correspond au texte saisi ; undefined si inconnue. */
function findPartyId(
  text: string
): number | null | undefined {
  const typed =
    fold(text.trim());

  if (!typed) {
    return null;
  }

  return selectableParties.value.find(party => fold(party.label) === typed)?.id;
}

/* =========================
   Saisie
========================= */

const kind =
  ref<AllocationRuleKind>(props.rule?.kind ?? "party");

const partyText =
  ref(partyLabel(props.rule?.partyId ?? null));

const matchText =
  ref(props.rule?.matchText ?? "");

const transferTypeId =
  ref<number | null>(props.rule?.transferTypeId ?? null);

const holder =
  ref<string | null>(props.rule?.holder ?? null);

const allocPartyText =
  ref(partyLabel(props.rule?.allocPartyId ?? null));

const subCategoryId =
  ref<number | null>(props.rule?.subCategoryId ?? null);

const tagId =
  ref(props.rule?.tagId ?? 0);

const commentTemplate =
  ref(props.rule?.commentTemplate ?? "");

const refMonthOffset =
  ref(props.rule?.refMonthOffset ?? 0);

/* Date de l'aperçu du commentaire : aujourd'hui. */
const previewDate =
  ref(new Date().toISOString().slice(0, 10));

const kindOptions: { value: AllocationRuleKind; label: string }[] = [
  { value: "party", label: "Party" },
  { value: "text", label: "Bank text" },
];

/* Sous-catégories actives, et la sous-catégorie actuelle même clôturée. */
const subCategoryGroups =
  computed(() =>
    props.categories
      .map(category => ({
        id: category.id,
        label: category.label,
        options: category.subcategories
          .filter(sub => sub.status === "A" || sub.id === props.rule?.subCategoryId)
          .map(sub => ({
            id: sub.id,
            label: sub.status === "A" ? sub.label : `${sub.label} (closed)`,
          })),
      }))
      .filter(group => group.options.length)
  );

const transferTypeOptions =
  computed(() =>
    (props.transferTypes?.transferTypes ?? [])
      .map(type => ({ id: type.id, label: `${type.id} · ${type.label}` }))
  );

/* Porteurs de l'export, et le porteur actuel s'il n'y est plus. */
const holderOptions =
  computed(() =>
    props.rule?.holder && !props.data.holders.includes(props.rule.holder)
      ? [...props.data.holders, props.rule.holder]
      : props.data.holders
  );

/* =========================
   Valeurs envoyées
========================= */

const partyId =
  computed(() =>
    kind.value === "party"
      ? findPartyId(partyText.value)
      : null
  );

const allocPartyId =
  computed(() =>
    findPartyId(allocPartyText.value)
  );

const trimmedTemplate =
  computed(() =>
    commentTemplate.value.trim()
  );

const templateCheck =
  computed(() =>
    trimmedTemplate.value
      ? checkCommentTemplate(trimmedTemplate.value)
      : null
  );

const preview =
  computed(() =>
    trimmedTemplate.value && templateCheck.value?.ok
      ? renderCommentTemplate(trimmedTemplate.value, previewDate.value)
      : null
  );

const payload =
  computed<AllocationRuleSave>(() => ({
    id: props.rule?.id ?? null,
    kind: kind.value,
    partyId: partyId.value ?? null,
    matchText: kind.value === "text" ? matchText.value : null,
    transferTypeId: transferTypeId.value,
    holder: holder.value,
    allocPartyId: allocPartyId.value ?? null,
    subCategoryId: subCategoryId.value,
    tagId: tagId.value,
    commentTemplate: trimmedTemplate.value || null,
    refMonthOffset: refMonthOffset.value,
    autoConfirm: props.rule?.autoConfirm ?? false,
  }));

const initialPayload =
  JSON.stringify(payload.value);

const changed =
  computed(() =>
    JSON.stringify(payload.value) !== initialPayload
  );

/* =========================
   Contrôles (§ 2.2)
========================= */

/* Autre règle aux mêmes conditions (genre, partie ou texte, type, porteur). */
const sameConditions =
  computed(() => {
    const current =
      payload.value;

    return props.data.rules.find(
      rule =>
        rule.id !== current.id &&
        rule.kind === current.kind &&
        (current.kind === "party"
          ? rule.partyId === current.partyId
          : fold(rule.matchText ?? "") === fold(current.matchText ?? "")) &&
        rule.transferTypeId === current.transferTypeId &&
        rule.holder === current.holder
    ) ?? null;
  });

const formError =
  computed(() => {
    if (kind.value === "party") {
      if (!partyText.value.trim()) {
        return "Choose the party of the movement.";
      }

      if (partyId.value === undefined) {
        return "Unknown party: choose one from the list.";
      }
    } else {
      if (
        matchText.value.length < MATCH_TEXT_MIN_LENGTH ||
        matchText.value.length > MATCH_TEXT_MAX_LENGTH ||
        !matchText.value.trim()
      ) {
        return `Bank text: ${MATCH_TEXT_MIN_LENGTH} to ${MATCH_TEXT_MAX_LENGTH} characters.`;
      }

      if (!allocPartyText.value.trim()) {
        return "A bank text rule needs the party of the allocation.";
      }
    }

    if (allocPartyId.value === undefined) {
      return "Unknown allocation party: choose one from the list.";
    }

    if (templateCheck.value && !templateCheck.value.ok) {
      return `Comment: ${templateCheck.value.error}.`;
    }

    if (
      !Number.isInteger(refMonthOffset.value) ||
      Math.abs(refMonthOffset.value) > REF_MONTH_OFFSET_MAX
    ) {
      return `Reference month: from -${REF_MONTH_OFFSET_MAX} to ${REF_MONTH_OFFSET_MAX}.`;
    }

    if (!isNew && sameConditions.value) {
      return `Rule ${sameConditions.value.id} already has these conditions.`;
    }

    return "";
  });

/* =========================
   Envoi
========================= */

const saveRequest =
  useEventRequest({
    trigram: RULE_EVENT_TRIGRAM,
    noAnswerDelayMs: NO_ANSWER_DELAY_MS,
  });

/* Demande sur cette règle déjà en attente dans events/ (autre appareil, rechargement). */
const waitingElsewhere =
  computed(() =>
    !isNew &&
    saveRequest.request.value === null &&
    saveRequest.waitingFiles.value.some(
      name => name.endsWith(`_${ruleEventSuffix(props.rule!.id)}.json`)
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
  if (!canSave.value) {
    return;
  }

  await saveRequest.send(
    {
      eventType: "RULE_SAVED",
      version: RULE_EVENT_VERSION,
      timestamp: new Date().toISOString(),
      payload: {
        rule: payload.value,
        fromAllocation: null,
        source: deviceName(),
      },
    },
    ruleEventSuffix(payload.value.id)
  );
}

async function remove() {
  const rule =
    props.rule;

  if (
    !rule ||
    saveRequest.inProgress.value ||
    !(await confirmDialog({
      title: `Delete rule ${rule.id}?`,
      message:
        rule.usage.movements > 0
          ? `It applied to ${rule.usage.movements} movements in the last 12 months.`
          : "",
      confirmLabel: "Delete",
      destructive: true,
    }))
  ) {
    return;
  }

  await saveRequest.send(
    {
      eventType: "RULE_DELETED",
      version: RULE_EVENT_VERSION,
      timestamp: new Date().toISOString(),
      payload: {
        id: rule.id,
        source: deviceName(),
      },
    },
    ruleEventSuffix(rule.id)
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
  computed(() => {
    if (waitingElsewhere.value) {
      return waitingElsewhereMessage("A change of this rule");
    }

    if (formError.value) {
      return isNew || changed.value ? formError.value : "";
    }

    return isNew && sameConditions.value
      ? `Replaces rule ${sameConditions.value.id} (same conditions).`
      : "";
  });

const title =
  isNew
    ? "New allocation rule"
    : `Rule ${props.rule!.id}`;

const subtitle =
  computed(() => {
    if (isNew) {
      return "Priority rule: always suggested first";
    }

    const rule =
      props.rule!;

    return [
      `${rule.usage.movements} movements in 12 months`,
      `first for ${rule.usage.first}`,
      ...(rule.usage.contradicted ? [`contradicted ${rule.usage.contradicted}`] : []),
      rule.origin === "pwa" ? "Priority" : "May yield to history",
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
    :hint-is-error="!!formError && (isNew || changed) && !waitingElsewhere"
    :can-delete="!isNew"
    @save="save"
    @delete="remove"
    @close="emit('close')"
  >
    <!-- Conditions -->

    <div class="field">
      <h3>When</h3>

      <SegmentedControl
        v-if="isNew"
        v-model="kind"
        :options="kindOptions"
      />

      <SuggestInput
        v-if="kind === 'party'"
        v-model="partyText"
        class="party-input"
        :suggestions="partySuggestions"
        placeholder="Party of the movement"
      />

      <template v-else>
        <input
          v-model="matchText"
          type="text"
          :maxlength="MATCH_TEXT_MAX_LENGTH"
          placeholder="Text found in the bank text"
          autocomplete="off"
          spellcheck="false"
        />

        <p class="note">
          {{ MATCH_TEXT_MIN_LENGTH }} to {{ MATCH_TEXT_MAX_LENGTH }} characters, spaces included.
        </p>
      </template>
    </div>

    <div class="field-row">
      <label class="field">
        <h3>Transfer type</h3>

        <select v-model="transferTypeId">
          <option :value="null">Any</option>

          <option
            v-for="option in transferTypeOptions"
            :key="option.id"
            :value="option.id"
          >
            {{ option.label }}
          </option>
        </select>
      </label>

      <label class="field">
        <h3>Card holder</h3>

        <select v-model="holder">
          <option :value="null">Any</option>

          <option
            v-for="option in holderOptions"
            :key="option"
            :value="option"
          >
            {{ option }}
          </option>
        </select>
      </label>
    </div>

    <!-- Allocation -->

    <div class="field">
      <h3>Allocation party</h3>

      <SuggestInput
        v-model="allocPartyText"
        class="party-input"
        :suggestions="partySuggestions"
        :placeholder="kind === 'party' ? 'Party of the movement' : 'Required'"
      />
    </div>

    <div class="field-row">
      <label class="field">
        <h3>Sub-category</h3>

        <select v-model="subCategoryId">
          <option :value="null">None (party only)</option>

          <optgroup
            v-for="group in subCategoryGroups"
            :key="group.id"
            :label="group.label"
          >
            <option
              v-for="option in group.options"
              :key="option.id"
              :value="option.id"
            >
              {{ option.label }}
            </option>
          </optgroup>
        </select>
      </label>

      <label class="field">
        <h3>Tag</h3>

        <select v-model="tagId">
          <option :value="0">No tag</option>

          <option
            v-for="tag in allocationTags ?? []"
            :key="tag.id"
            :value="tag.id"
          >
            {{ tag.tagName }}
          </option>
        </select>
      </label>
    </div>

    <!-- Commentaire -->

    <div class="field">
      <h3>Comment</h3>

      <input
        v-model="commentTemplate"
        type="text"
        :maxlength="COMMENT_MAX_LENGTH"
        placeholder="e.g. Music {M-1}"
        autocomplete="off"
        spellcheck="false"
      />

      <p class="note">
        Date tokens: {M} month, {Y} year, {YY} 2-digit year, {Q} quarter, {R} 3-month period;
        with an offset, e.g. {M-1}, {Y+1}.
      </p>

      <div
        v-if="trimmedTemplate"
        class="preview"
      >
        <span class="preview-label">Preview on</span>

        <input
          v-model="previewDate"
          type="date"
          class="preview-date"
        />

        <span
          v-if="preview !== null"
          class="preview-text"
        >{{ preview }}</span>
      </div>
    </div>

    <label class="field">
      <h3>Reference month</h3>

      <span class="offset-line">
        <input
          v-model.number="refMonthOffset"
          type="number"
          class="offset-input"
          :min="-REF_MONTH_OFFSET_MAX"
          :max="REF_MONTH_OFFSET_MAX"
          step="1"
        />

        <span class="note">months from the value date (0 = same month)</span>
      </span>
    </label>
  </EditSheet>
</template>

<style scoped>
.field-row > .field {
  flex: 1;
  min-width: 12rem;
}

/* Champ de SuggestInput : même rendu que les autres champs de la fiche. */
.party-input :deep(input) {
  box-sizing: border-box;
  width: 100%;

  padding: 8px 10px;

  border: 1px solid var(--input-border);
  border-radius: 8px;

  font-size: var(--font-size-md);
}

.preview {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.preview-label {
  color: var(--text-soft);
  font-size: var(--font-size-sm);
}

.preview-date {
  width: auto;
}

.preview-text {
  font-weight: 600;
}

.offset-line {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.offset-input {
  width: 5rem;
}
</style>
