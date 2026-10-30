<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from "vue";

import EditSheet from "@/components/masterData/EditSheet.vue";
import PillButton from "@/components/ui/PillButton.vue";

import { useEventRequest } from "@/composables/useEventRequest";

import {
  isFolderType,
  isPartyUsed,
  type PartiesData,
  type Party,
} from "@/contracts/parties";

import { confirmDialog } from "@/services/dialog/appDialog";

import { detectDevice } from "@/utils/deviceDetection";

/* =========================
   Fiche partie (et ses alias)

   Création (party null), modification ou suppression d'une
   partie inutilisée. Envoi au Mac
   (../Backend/docs/parties-contract.md) :
     events/PWA-PTY_<AAAAMMJJHHMMSS>_P<PartyID|NEW>.json
       { "eventType": "PARTY_SAVED",
         "payload": { "partyId" | null, "label", "typeId",
                      "seq", "aliases": [liste complète],
                      "source" } }
     events/PWA-PTY_<AAAAMMJJHHMMSS>_P<PartyID>_DEL.json
       { "eventType": "PARTY_DELETED",
         "payload": { "partyId", "source" } }
   puis se ferme une fois la demande traitée (parties.json
   republié). Jamais ouverte pour une partie réservée.

   Sous-dossier d'archives (types -1, -2, ouvert depuis
   « Party types ») : nom seulement, type fixe ; l'ordre se
   règle par ↑ ↓, un nouveau dossier se place à la fin.
   Vraie partie : nom, type ordinaire et alias.

   Les alias ne sont jamais rognés : leurs espaces de début
   et de fin comptent dans la recherche du Mac.
========================= */

const props = defineProps<{
  party: Party | null;
  data: PartiesData;

  /* Type proposé à la création. */
  defaultTypeId?: number;
}>();

const emit = defineEmits<{
  close: [];
}>();

const NO_ANSWER_DELAY_MS =
  2 * 60 * 1000;

const LABEL_MAX_LENGTH = 255;
const ALIAS_MAX_LENGTH = 50;

/* Ordre par défaut des parties qui ne sont pas des dossiers. */
const DEFAULT_SEQ = 100;

const isNew =
  props.party === null;

/* =========================
   Saisie

   Valeurs d'origine figées à l'ouverture : une
   republication de parties.json pendant la saisie ne
   l'écrase pas.
========================= */

const original = {
  label: props.party?.label ?? "",
  typeId: props.party?.typeId ?? props.defaultTypeId ?? 0,
  seq: props.party?.seq ?? DEFAULT_SEQ,
  aliases: [...(props.party?.aliases ?? [])],
};

const label =
  ref(original.label);

const typeId =
  ref(original.typeId);

const aliases =
  ref<string[]>([...original.aliases]);

const newAlias =
  ref("");

const isFolder =
  computed(() =>
    isFolderType(typeId.value)
  );

/* Vraie partie : types ordinaires seulement. */
const typeOptions =
  computed(() =>
    props.data.partyTypes
      .filter(type => !isFolderType(type.id))
      .sort((a, b) => a.label.localeCompare(b.label))
  );

const title =
  isNew
    ? isFolderType(original.typeId)
      ? "New folder"
      : "New party"
    : props.party!.label;

/*
  Ordre conservé pour une partie existante ; nouveau dossier
  après le dernier de son type.
*/
const seq =
  !isNew
    ? original.seq
    : isFolderType(original.typeId)
      ? Math.max(
          0,
          ...props.data.parties
            .filter(party => party.typeId === original.typeId)
            .map(party => party.seq)
        ) + 10
      : DEFAULT_SEQ;

const trimmedLabel =
  computed(() =>
    label.value.trim().replace(/\s+/g, " ")
  );

const changed =
  computed(() =>
    trimmedLabel.value !== original.label ||
    typeId.value !== original.typeId ||
    aliases.value.length !== original.aliases.length ||
    aliases.value.some(
      (alias, index) => alias !== original.aliases[index]
    )
  );

/* =========================
   Alias
========================= */

/*
  Titulaire de chaque alias (comparaison sans la casse) :
  toutes les parties, comme le contrôle du Mac.
*/
const aliasHolders =
  computed(() => {
    const map =
      new Map<string, Party>();

    for (const party of props.data.parties) {
      for (const alias of party.aliases) {
        map.set(alias.toLowerCase(), party);
      }
    }

    return map;
  });

const newAliasError =
  computed(() => {
    const alias =
      newAlias.value;

    if (!alias.trim()) {
      return "";
    }

    if (alias.length > ALIAS_MAX_LENGTH) {
      return `An alias has at most ${ALIAS_MAX_LENGTH} characters.`;
    }

    const key =
      alias.toLowerCase();

    if (aliases.value.some(other => other.toLowerCase() === key)) {
      return "This alias is already in the list.";
    }

    const holder =
      aliasHolders.value.get(key);

    if (holder && holder.id !== props.party?.id) {
      return `Alias already used by ${holder.label}.`;
    }

    return "";
  });

function addAlias() {
  if (!newAlias.value.trim() || newAliasError.value) {
    return;
  }

  aliases.value =
    [...aliases.value, newAlias.value]
      .sort((a, b) => a.localeCompare(b));

  newAlias.value = "";
}

function removeAlias(
  alias: string
) {
  aliases.value =
    aliases.value.filter(other => other !== alias);
}

/*
  Espaces de début et de fin rendus visibles.
*/
function showAlias(
  alias: string
): string {
  return alias
    .replace(/^ +/, spaces => "␣".repeat(spaces.length))
    .replace(/ +$/, spaces => "␣".repeat(spaces.length));
}

/* =========================
   Contrôles (mêmes refus que le Mac)
========================= */

const formError =
  computed(() => {
    if (!trimmedLabel.value) {
      return "The name is required.";
    }

    if (trimmedLabel.value.length > LABEL_MAX_LENGTH) {
      return `The name has at most ${LABEL_MAX_LENGTH} characters.`;
    }

    const key =
      trimmedLabel.value.toLowerCase();

    const homonym =
      props.data.parties.find(
        other =>
          other.id !== props.party?.id &&
          other.label.trim().toLowerCase() === key
      );

    if (homonym) {
      return `Name already used by party ${homonym.id}.`;
    }

    return "";
  });

/* =========================
   Enregistrement
========================= */

const saveRequest =
  useEventRequest({
    trigram: "PTY",
    noAnswerDelayMs: NO_ANSWER_DELAY_MS,
  });

const fileSuffix =
  `P${props.party?.id ?? "NEW"}`;

/*
  Modification de cette partie déjà en attente dans events/
  (autre appareil, ou envoyée avant un rechargement).
*/
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
  /* Alias saisi mais pas encore ajouté : il compte. */
  if (newAlias.value.trim() && !newAliasError.value) {
    addAlias();
  }

  if (!canSave.value) {
    return;
  }

  await saveRequest.send(
    {
      eventType: "PARTY_SAVED",
      version: 1,
      timestamp: new Date().toISOString(),
      payload: {
        partyId: props.party?.id ?? null,
        label: trimmedLabel.value,
        typeId: typeId.value,
        seq,
        aliases: aliases.value,
        source: detectDevice(),
      },
    },
    fileSuffix
  );
}

/* =========================
   Suppression (partie inutilisée)
========================= */

const canDelete =
  !isNew &&
  !isPartyUsed(props.party!);

async function remove() {
  if (
    !canDelete ||
    saveRequest.inProgress.value ||
    !(await confirmDialog({
      title: `Delete the party "${props.party!.label}"?`,
      message: "Its aliases are deleted too.",
      confirmLabel: "Delete",
      destructive: true,
    }))
  ) {
    return;
  }

  await saveRequest.send(
    {
      eventType: "PARTY_DELETED",
      version: 1,
      timestamp: new Date().toISOString(),
      payload: {
        partyId: props.party!.id,
        source: detectDevice(),
      },
    },
    `${fileSuffix}_DEL`
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
      ? "A change of this party is waiting for the Mac."
      : changed.value
        ? formError.value
        : ""
  );

const usageText =
  computed(() => {
    const usage =
      props.party?.usage;

    return usage
      ? `${usage.allocations} allocations · ${usage.rules} rules · ${usage.archives} archives · ${usage.banks} banks`
      : "";
  });
</script>

<template>
  <EditSheet
    :title="title"
    :subtitle="isNew ? 'Created on the Mac' : `${isFolder ? 'Folder' : 'Party'} ${party!.id} · ${usageText}`"
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
    <label class="field">
      <h3>Name</h3>

      <input
        v-model="label"
        type="text"
        :disabled="saveRequest.inProgress.value"
      />
    </label>

    <div
      v-if="!isFolder"
      class="field-row"
    >
      <h3>Type</h3>

      <select
        v-model.number="typeId"
        :disabled="saveRequest.inProgress.value"
      >
        <option
          v-for="type in typeOptions"
          :key="type.id"
          :value="type.id"
        >
          {{ type.label }}
        </option>
      </select>
    </div>

    <!-- Aliases -->

    <div
      v-if="!isFolder"
      class="field"
    >
      <h3>Aliases ({{ aliases.length }})</h3>

      <p class="note">
        Text found in the bank description; the longest matching alias wins. Spaces count (shown as ␣).
      </p>

      <ul
        v-if="aliases.length"
        class="alias-list"
      >
        <li
          v-for="alias in aliases"
          :key="alias"
          class="alias"
        >
          <span class="alias-text">{{ showAlias(alias) }}</span>

          <button
            type="button"
            class="alias-remove"
            :aria-label="`Remove alias ${alias}`"
            :disabled="saveRequest.inProgress.value"
            @click="removeAlias(alias)"
          >
            ×
          </button>
        </li>
      </ul>

      <div class="alias-add">
        <input
          v-model="newAlias"
          type="text"
          placeholder="New alias"
          autocomplete="off"
          spellcheck="false"
          :maxlength="ALIAS_MAX_LENGTH + 10"
          :disabled="saveRequest.inProgress.value"
          @keydown.enter.prevent="addAlias"
        />

        <PillButton
          :disabled="!newAlias.trim() || !!newAliasError || saveRequest.inProgress.value"
          @click="addAlias"
        >
          + Alias
        </PillButton>
      </div>

      <p
        v-if="newAliasError"
        class="note alias-error"
      >
        {{ newAliasError }}
      </p>
    </div>
  </EditSheet>
</template>

<style scoped>
.alias-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;

  max-height: 30vh;
  margin: 0;
  padding: 0;
  overflow-y: auto;

  list-style: none;
}

.alias {
  display: inline-flex;
  align-items: center;
  gap: 2px;

  padding: 2px 4px 2px 8px;

  border: 1px solid var(--chip-border);
  border-radius: 999px;

  background: var(--chip-bg);
}

.alias-text {
  font-family: ui-monospace, Menlo, monospace;
  font-size: var(--font-size-xs);
  white-space: pre;
}

.alias-remove {
  width: 22px;
  height: 22px;

  border: none;
  border-radius: 999px;

  background: transparent;
  color: var(--text-soft);
  font-size: var(--font-size-md);
  line-height: 1;

  cursor: pointer;
}

.alias-remove:hover:not(:disabled) {
  background: var(--primary-soft);
  color: var(--text);
}

.alias-add {
  display: flex;
  gap: 0.5rem;
}

.alias-add input {
  flex: 1;
  min-width: 0;

  font-family: ui-monospace, Menlo, monospace;
}

.alias-error {
  color: var(--negative);
}
</style>
