<script setup lang="ts">
import {
  computed,
  ref,
} from "vue";

import PartySheet from "@/components/masterData/PartySheet.vue";

import { useRemoteJson } from "@/composables/useRemoteJson";
import { useParties } from "@/composables/useParties";
import { useTransferTypes } from "@/composables/useTransferTypes";
import { useRememberRequest } from "@/composables/allocations/useRememberRequest";

import {
  ALLOCATION_RULES_FILE,
  ALLOCATION_RULES_FOLDER,
  type AllocationRuleKind,
  type AllocationRuleSave,
  MATCH_TEXT_MAX_LENGTH,
  MATCH_TEXT_MIN_LENGTH,
  readAllocationRules,
} from "@/contracts/allocationRules";

import {
  PARTIES_FILE,
  PARTIES_FOLDER,
  readParties,
} from "@/contracts/parties";

import type {
  SpendingRecord,
} from "@/composables/spending/useSpending";

/* =========================
   Remember : retenir une allocation comme règle

   Contrat des règles d'allocation, § 18.1 et § 20. Case
   proposée pour une allocation sur une seule ligne (montant
   entier, aucune ligne enregistrée) ; désactivée pour une
   ventilation. À l'enregistrement de l'allocation, un
   RULE_SAVED avec fromAllocation part en plus (événements
   indépendants) : le Mac convertit le commentaire en modèle
   et calcule le décalage du mois de référence ; son statut
   s'affiche dans la liste Spending (useRememberRequest).

   - Mouvement avec une partie (non générique) : règle sur
     cette partie ; partie d'allocation envoyée seulement si
     elle diffère.
   - Sans partie, ou partie générique (une règle sur elle
     viserait tous ses mouvements) : règle sur un texte de la
     banque, prérempli, à raccourcir (3 à 50 caractères,
     contenu dans le texte, casse et accents ignorés) ; partie
     d'allocation obligatoire. En alternative : ajouter ce
     texte comme alias de la partie d'allocation (PartySheet,
     PARTY_SAVED existant).
   - « More… » : seulement pour le type d'opération et / ou
     le porteur de la carte de ce mouvement.
   Une règle existante aux mêmes conditions est remplacée
   (signalé).

   Le parent lit la demande par capture() avant d'enregistrer
   l'allocation (le formulaire se vide ensuite), puis l'envoie
   si l'allocation tient sur une seule ligne équilibrée.
========================= */

const props =
  defineProps<{
    record: SpendingRecord;

    /* Saisie du formulaire d'allocation. */
    allocPartyId: number | null;
    subCategoryId: number | null;
    tagId: number | null;

    /* Une seule ligne : montant entier, aucune ligne enregistrée ni modifiée. */
    singleLine: boolean;

    /* Lignes déjà enregistrées : la case n'est plus proposée. */
    hasLines: boolean;

    disabled: boolean;
  }>();

const partiesStore =
  useParties();

const transferTypesStore =
  useTransferTypes();

const rememberRequest =
  useRememberRequest();

/* Règles publiées : porteurs connus et règle remplacée. */
const rulesFile =
  useRemoteJson({
    folder: ALLOCATION_RULES_FOLDER,
    file: ALLOCATION_RULES_FILE,
    read: readAllocationRules,
    optional: true,
  });

const remember =
  ref(false);

const rememberMore =
  ref(false);

const onlyTransferType =
  ref(false);

const onlyHolder =
  ref(false);

/* Texte de la banque tel quel (accmovement.Description). */
const bankText =
  computed(() =>
    props.record.bankDescription ?? ""
  );

const matchText =
  ref(
    bankText.value.slice(0, MATCH_TEXT_MAX_LENGTH)
  );

const movementParty =
  computed(() => {
    const id =
      props.record.movementPartyID;

    return id === null
      ? null
      : partiesStore.getParty(id) ?? null;
  });

const rememberKind =
  computed<AllocationRuleKind>(() =>
    movementParty.value && !movementParty.value.generic
      ? "party"
      : "text"
  );

const allocPartyName =
  computed(() =>
    props.allocPartyId === null
      ? ""
      : partiesStore.getParty(props.allocPartyId)?.label ?? ""
  );

const transferTypeLabel =
  computed(() => {
    const id =
      props.record.transferTypeID;

    return id === null
      ? ""
      : transferTypesStore.getTransferType(id)?.label ?? "";
  });

/* Porteur de la carte, s'il fait partie des porteurs connus des règles. */
const movementHolder =
  computed(() => {
    const owner =
      props.record.owner ?? "";

    return owner && owner !== "-" && rulesFile.data.value?.holders.includes(owner)
      ? owner
      : "";
  });

function foldText(
  value: string
): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

const matchTextError =
  computed(() => {
    if (rememberKind.value !== "text") {
      return "";
    }

    const text =
      matchText.value;

    if (
      text.length < MATCH_TEXT_MIN_LENGTH ||
      text.length > MATCH_TEXT_MAX_LENGTH ||
      !text.trim()
    ) {
      return `${MATCH_TEXT_MIN_LENGTH} to ${MATCH_TEXT_MAX_LENGTH} characters of the bank text.`;
    }

    return foldText(bankText.value).includes(foldText(text))
      ? ""
      : "Not found in the bank text.";
  });

/* Motif pour lequel la règle ne peut pas être retenue, vide sinon. */
const rememberBlocker =
  computed(() => {
    if (!props.singleLine) {
      return "Only for an allocation on a single line.";
    }

    if (rememberKind.value === "text" && props.allocPartyId === null) {
      return "A bank text rule needs a party for the allocation.";
    }

    return "";
  });

const rememberRule =
  computed<AllocationRuleSave>(() => {
    const movementPartyID =
      props.record.movementPartyID;

    const byParty =
      rememberKind.value === "party";

    return {
      id: null,
      kind: rememberKind.value,
      partyId: byParty ? movementPartyID : null,
      matchText: byParty ? null : matchText.value,
      transferTypeId:
        onlyTransferType.value
          ? props.record.transferTypeID
          : null,
      holder:
        onlyHolder.value && movementHolder.value
          ? movementHolder.value
          : null,
      allocPartyId:
        byParty && props.allocPartyId === movementPartyID
          ? null
          : props.allocPartyId,
      subCategoryId: props.subCategoryId,
      tagId: props.tagId ?? 0,
      commentTemplate: null,
      refMonthOffset: null,
      autoConfirm: false,
    };
  });

/* Règle existante aux mêmes conditions : remplacée par le Mac. */
const replacedRuleId =
  computed(() => {
    const rule =
      rememberRule.value;

    return rulesFile.data.value?.rules.find(
      existing =>
        existing.kind === rule.kind &&
        (rule.kind === "party"
          ? existing.partyId === rule.partyId
          : foldText(existing.matchText ?? "") === foldText(rule.matchText ?? "")) &&
        existing.transferTypeId === rule.transferTypeId &&
        existing.holder === rule.holder
    )?.id ?? null;
  });

const rememberLabel =
  computed(() =>
    rememberKind.value === "party" && movementParty.value
      ? `Remember for ${movementParty.value.label}`
      : "Remember for this text"
  );

/* Alternative à la règle par texte : alias de la partie d'allocation. */
const aliasOpen =
  ref(false);

const partiesFile =
  useRemoteJson({
    folder: PARTIES_FOLDER,
    file: () => (aliasOpen.value ? PARTIES_FILE : null),
    read: readParties,
  });

const aliasParty =
  computed(() =>
    props.allocPartyId === null
      ? null
      : partiesFile.data.value?.parties.find(
          party => party.id === props.allocPartyId
        ) ?? null
  );

function openAlias() {
  remember.value = false;
  aliasOpen.value = true;
}

/*
  Demande lue maintenant, envoyée plus tard par la fonction
  rendue (case décochée ensuite) ; null si Remember n'est pas
  coché ou pas valable. La fonction rend false si la demande
  n'a pas pu être écrite : le message reste affiché ici.
*/
function capture(
  comment: string,
  allocDate: string
): (() => Promise<boolean>) | null {
  if (
    !remember.value ||
    rememberBlocker.value ||
    matchTextError.value
  ) {
    return null;
  }

  const rule =
    rememberRule.value;

  const fromAllocation = {
    fitid: props.record.id,
    comment,
    allocDate,
  };

  return async () => {
    await rememberRequest.send(
      rule,
      fromAllocation
    );

    remember.value = false;

    return rememberRequest.tone.value !== "error";
  };
}

defineExpose({
  capture,
});
</script>

<template>
  <div
    v-if="!hasLines || remember"
    class="remember"
  >
    <div class="remember-line">
      <label
        class="remember-check"
        :class="{ disabled: !!rememberBlocker }"
        :title="rememberBlocker || 'Save this allocation as a priority rule'"
      >
        <input
          v-model="remember"
          type="checkbox"
          :disabled="!!rememberBlocker || disabled"
        />
        {{ rememberLabel }}
      </label>

      <button
        v-if="remember && !rememberBlocker"
        type="button"
        class="link-button"
        @click="rememberMore = !rememberMore"
      >
        {{ rememberMore ? "Less" : "More…" }}
      </button>

      <span
        v-if="remember && !rememberBlocker && replacedRuleId !== null"
        class="remember-note"
      >
        replaces rule {{ replacedRuleId }}
      </span>
    </div>

    <template v-if="remember && !rememberBlocker">
      <div
        v-if="rememberKind === 'text'"
        class="remember-text"
      >
        <input
          v-model="matchText"
          type="text"
          class="match-text"
          :maxlength="MATCH_TEXT_MAX_LENGTH"
          autocomplete="off"
          spellcheck="false"
          aria-label="Text of the bank text"
        />

        <span
          class="remember-note"
          :class="{ error: !!matchTextError }"
        >
          {{ matchTextError || "Shorten to the part that identifies it." }}
        </span>

        <button
          v-if="allocPartyId !== null"
          type="button"
          class="link-button"
          @click="openAlias"
        >
          Or add it as an alias of {{ allocPartyName || "the party" }}…
        </button>
      </div>

      <div
        v-if="rememberMore"
        class="remember-more"
      >
        <label
          v-if="transferTypeLabel"
          class="remember-check"
        >
          <input
            v-model="onlyTransferType"
            type="checkbox"
          />
          Only for {{ transferTypeLabel }}
        </label>

        <label
          v-if="movementHolder"
          class="remember-check"
        >
          <input
            v-model="onlyHolder"
            type="checkbox"
          />
          Only for card holder {{ movementHolder }}
        </label>

        <span
          v-if="!transferTypeLabel && !movementHolder"
          class="remember-note"
        >
          No transfer type or card holder known for this movement.
        </span>
      </div>
    </template>

    <p
      v-if="rememberRequest.message.value"
      class="remember-note"
      :class="rememberRequest.tone.value"
    >
      {{ rememberRequest.message.value }}
    </p>
  </div>

  <PartySheet
    v-if="aliasOpen && aliasParty && partiesFile.data.value"
    :party="aliasParty"
    :data="partiesFile.data.value"
    :initial-alias="matchText"
    @close="aliasOpen = false"
  />
</template>

<style scoped>
.remember {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  width: 100%;
  max-width: 640px;
}

.remember-line,
.remember-more {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem 1rem;
}

.remember-check {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;

  font-size: var(--font-size-sm);

  cursor: pointer;
}

.remember-check.disabled {
  color: var(--text-muted);

  cursor: default;
}

.remember-check input {
  width: 18px;
  height: 18px;
  margin: 0;
}

.remember-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.3rem;
}

/* Largeur des champs longs du formulaire d'allocation (--long-w). */
.match-text {
  box-sizing: border-box;
  width: var(--long-w, 100%);
  max-width: 100%;

  padding: 6px 10px;

  border: 1px solid var(--input-border);
  border-radius: 8px;

  font: inherit;
  font-size: 0.9rem;
}

.match-text:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary-soft);
}

.remember-note {
  margin: 0;

  color: var(--text-soft);
  font-size: var(--font-size-xs);
}

.remember-note.error {
  color: var(--negative);
}

.remember-note.completed {
  color: var(--positive);
}

.link-button {
  padding: 0;

  border: none;

  background: none;
  color: var(--primary);

  font: inherit;
  font-size: var(--font-size-sm);

  cursor: pointer;
}
</style>
