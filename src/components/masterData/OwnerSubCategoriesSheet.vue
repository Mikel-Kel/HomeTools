<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from "vue";

import EditSheet from "@/components/masterData/EditSheet.vue";

import { useEventRequest } from "@/composables/useEventRequest";

import {
  MOBILE_EXPENSE_EVENT_TRIGRAM,
  MOBILE_EXPENSE_EVENT_VERSION,
  ownerEventSuffix,
  type OwnerSubCategoriesSave,
} from "@/contracts/bankingCards";

import type { Category } from "@/contracts/categories";

import { deviceName } from "@/services/environment/environmentState";

import { waitingElsewhereMessage } from "@/services/events/requestMessages";

/* =========================
   Fiche des sous-catégories d'un propriétaire
   (Master data › iPhone › Sub-categories)

   Sous-catégories proposées sur les iPhone du propriétaire,
   par MOBILE_OWNER_SAVED (../Backend/docs/mobile-expense-contract.md,
   § 3.3 et § 3.4) : la liste envoyée, toujours complète,
   remplace celle du Mac. Le Mac reste juge : son refus est
   affiché tel quel.

   - Seules les sous-catégories actives peuvent être ajoutées ;
     une clôturée déjà attribuée reste affichée (« Closed »),
     gardée ou retirée, et l'iPhone ne la propose pas.
   - Propriétaire retiré d'owners : liste en lecture, seule
     action « Clear », qui envoie une liste vide.
========================= */

const props = defineProps<{
  owner: string;

  /* Liste publiée (bankingCards.json). */
  subCategoryIds: number[];

  categories: Category[];

  /* Propriétaire retiré d'owners. */
  removed: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const NO_ANSWER_DELAY_MS =
  2 * 60 * 1000;

/* Liste d'origine figée à l'ouverture : une republication ne l'écrase pas. */
const original =
  new Set(props.subCategoryIds);

const selected =
  ref(new Set(original));

interface Choice {
  id: number;
  label: string;
  closed: boolean;
}

interface ChoiceGroup {
  categoryId: number;
  label: string;
  choices: Choice[];
}

/*
  Par catégorie, dans l'ordre d'affichage : sous-catégories
  actives et clôturées déjà attribuées. Propriétaire retiré :
  celles de sa liste seulement.
*/
const groups =
  computed<ChoiceGroup[]>(() =>
    props.categories
      .map(category => ({
        categoryId: category.id,
        label: category.label,
        choices: category.subcategories
          .filter(sub =>
            props.removed
              ? original.has(sub.id)
              : sub.status === "A" || original.has(sub.id)
          )
          .map(sub => ({
            id: sub.id,
            label: sub.label,
            closed: sub.status === "C",
          })),
      }))
      .filter(group => group.choices.length)
  );

/* Sous-catégories attribuées absentes de categories.json. */
const unknownIds =
  computed(() => {
    const known =
      new Set(
        props.categories.flatMap(category =>
          category.subcategories.map(sub => sub.id)
        )
      );

    return [...original].filter(id => !known.has(id));
  });

function toggle(
  id: number,
  checked: boolean
) {
  const next =
    new Set(selected.value);

  if (checked) {
    next.add(id);
  } else {
    next.delete(id);
  }

  selected.value = next;
}

const changed =
  computed(() =>
    props.removed
      ? original.size > 0
      : selected.value.size !== original.size ||
        [...selected.value].some(id => !original.has(id))
  );

const payload =
  computed<OwnerSubCategoriesSave>(() => ({
    owner: props.owner,
    subCategoryIds:
      props.removed
        ? []
        : [...selected.value].sort((a, b) => a - b),
  }));

const saveRequest =
  useEventRequest({
    trigram: MOBILE_EXPENSE_EVENT_TRIGRAM,
    noAnswerDelayMs: NO_ANSWER_DELAY_MS,
  });

const fileSuffix =
  ownerEventSuffix(props.owner);

const waitingElsewhere =
  computed(() =>
    saveRequest.request.value === null &&
    saveRequest.waitingFiles.value.some(
      name => name.endsWith(`_${fileSuffix}.json`)
    )
  );

const canSave =
  computed(() =>
    changed.value &&
    !saveRequest.inProgress.value &&
    !waitingElsewhere.value
  );

async function save() {
  if (!canSave.value) {
    return;
  }

  await saveRequest.send(
    {
      eventType: "MOBILE_OWNER_SAVED",
      version: MOBILE_EXPENSE_EVENT_VERSION,
      timestamp: new Date().toISOString(),
      payload: {
        ...payload.value,
        source: deviceName(),
      },
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
      ? waitingElsewhereMessage("A change of this owner")
      : ""
  );

const subtitle =
  props.removed
    ? "Removed owner: its list can only be cleared"
    : `${selected.value.size} offered on the iPhones of ${props.owner}`;
</script>

<template>
  <EditSheet
    :title="owner"
    :subtitle="subtitle"
    :request="saveRequest"
    :changed="changed && !removed"
    :can-save="canSave"
    :save-label="removed ? 'Clear' : 'Save'"
    :hint="hint"
    @save="save"
    @close="emit('close')"
  >
    <p
      v-if="!groups.length && !unknownIds.length"
      class="note"
    >
      {{ removed ? "No sub-category left." : "No active sub-category." }}
    </p>

    <div
      v-else
      class="groups"
    >
      <section
        v-for="group in groups"
        :key="group.categoryId"
        class="group"
      >
        <h3>{{ group.label }}</h3>

        <label
          v-for="choice in group.choices"
          :key="choice.id"
          class="check"
          :class="{ closed: choice.closed }"
        >
          <input
            type="checkbox"
            :checked="selected.has(choice.id)"
            :disabled="removed || saveRequest.inProgress.value"
            @change="toggle(choice.id, ($event.target as HTMLInputElement).checked)"
          />

          {{ choice.label }}

          <span
            v-if="choice.closed"
            class="soft"
          >
            Closed
          </span>
        </label>
      </section>

      <section
        v-if="unknownIds.length"
        class="group"
      >
        <h3>Unknown</h3>

        <label
          v-for="id in unknownIds"
          :key="id"
          class="check closed"
        >
          <input
            type="checkbox"
            :checked="selected.has(id)"
            :disabled="removed || saveRequest.inProgress.value"
            @change="toggle(id, ($event.target as HTMLInputElement).checked)"
          />

          Sub-category {{ id }}
        </label>
      </section>
    </div>

    <p class="note">
      {{
        removed
          ? "This owner is no longer a device owner: Clear removes its whole list."
          : "Only active sub-categories can be added; a closed one is kept or removed, never offered on the iPhone."
      }}
    </p>
  </EditSheet>
</template>

<style scoped>
.groups {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.75rem 1.25rem;

  max-height: 55vh;
  overflow-y: auto;
}

.group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.group h3 {
  margin: 0 0 2px;
}

.check {
  display: flex;
  align-items: center;
  gap: 0.5rem;

  cursor: pointer;
}

.check input {
  width: 18px;
  height: 18px;
  margin: 0;
  padding: 0;
}

.check.closed {
  color: var(--text-soft);
}

.soft {
  color: var(--text-soft);
  font-size: var(--font-size-sm);
}
</style>
