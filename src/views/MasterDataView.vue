<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from "vue";

import PageHeader from "@/components/PageHeader.vue";
import SegmentedControl from "@/components/ui/SegmentedControl.vue";
import PartiesSection from "@/components/masterData/PartiesSection.vue";
import PartyTypesSection from "@/components/masterData/PartyTypesSection.vue";
import SpendingSection from "@/components/masterData/SpendingSection.vue";
import DocumentsSection from "@/components/masterData/DocumentsSection.vue";

import { useRemoteJson } from "@/composables/useRemoteJson";
import { useCategories } from "@/composables/useCategories";
import { useParties } from "@/composables/useParties";
import { useTransferTypes } from "@/composables/useTransferTypes";
import { useAllocationTags } from "@/composables/allocations/useAllocationTags";
import { useDocumentTags } from "@/composables/archives/useDocumentTags";

import {
  ALLOCATION_TAGS_FILE,
  ALLOCATION_TAGS_FOLDER,
  readAllocationTags,
} from "@/contracts/allocationTags";

import {
  DOCUMENT_TAGS_FILE,
  DOCUMENT_TAGS_FOLDER,
  readDocumentTags,
} from "@/contracts/documentTags";

import {
  CATEGORIES_FILE,
  CATEGORIES_FOLDER,
  readCategories,
} from "@/contracts/categories";

import {
  PARTIES_FILE,
  PARTIES_FOLDER,
  readParties,
} from "@/contracts/parties";

import {
  readTransferTypes,
  TRANSFER_TYPES_FILE,
  TRANSFER_TYPES_FOLDER,
} from "@/contracts/transferTypes";

import { usePersistentRef } from "@/composables/usePersistentRef";

/* =========================
   Données de base (Master data)

   Une section par type de données de base ; modifications
   envoyées au Mac par événements, données relues dès que
   le backend republie leur export.
========================= */

type MasterDataSection =
  | "parties"
  | "partyTypes"
  | "spending"
  | "documents";

const sectionOptions: {
  value: MasterDataSection;
  label: string;
}[] = [
  { value: "parties", label: "Parties" },
  { value: "partyTypes", label: "Party types" },
  { value: "spending", label: "Spending" },
  { value: "documents", label: "Documents" },
];

const section =
  usePersistentRef<MasterDataSection>("masterData.section", "parties");

/* Section mémorisée qui n'existe plus : la première. */
if (!sectionOptions.some(option => option.value === section.value)) {
  section.value = "parties";
}

const categoriesStore =
  useCategories();

const partiesStore =
  useParties();

const transferTypesStore =
  useTransferTypes();

const tagsStore =
  useAllocationTags();

const documentTagsStore =
  useDocumentTags();

const categoriesFile =
  useRemoteJson({
    folder: CATEGORIES_FOLDER,
    file: CATEGORIES_FILE,
    read: readCategories,
  });

/* Chargé à la première ouverture d'une section qui lit les parties. */
const partiesWanted =
  ref(false);

watch(
  section,

  value => {
    if (
      value === "parties" ||
      value === "partyTypes" ||
      value === "documents"
    ) {
      partiesWanted.value = true;
    }
  },

  {
    immediate: true,
  }
);

const partiesFile =
  useRemoteJson({
    folder: PARTIES_FOLDER,
    file: () => (partiesWanted.value ? PARTIES_FILE : null),
    read: readParties,
  });

/* Types d'opération (famille de « Spending ») : chargés à la première ouverture de la section. */
const transferTypesWanted =
  ref(false);

watch(
  section,

  value => {
    if (value === "spending") {
      transferTypesWanted.value = true;
    }
  },

  {
    immediate: true,
  }
);

const transferTypesFile =
  useRemoteJson({
    folder: TRANSFER_TYPES_FOLDER,
    file: () => (transferTypesWanted.value ? TRANSFER_TYPES_FILE : null),
    read: readTransferTypes,
  });

/* Tags : chargés à la première ouverture de leur section. */
const tagsWanted =
  ref(false);

const documentTagsWanted =
  ref(false);

watch(
  section,

  value => {
    if (value === "spending") {
      tagsWanted.value = true;
    }

    if (value === "documents") {
      documentTagsWanted.value = true;
    }
  },

  {
    immediate: true,
  }
);

const tagsFile =
  useRemoteJson({
    folder: ALLOCATION_TAGS_FOLDER,
    file: () => (tagsWanted.value ? ALLOCATION_TAGS_FILE : null),
    read: readAllocationTags,
  });

const documentTagsFile =
  useRemoteJson({
    folder: DOCUMENT_TAGS_FOLDER,
    file: () => (documentTagsWanted.value ? DOCUMENT_TAGS_FILE : null),
    read: readDocumentTags,
  });

/*
  Les autres pages lisent ces données dans leur store :
  elles voient les changements sans recharger l'application.
*/
watch(
  categoriesFile.data,

  list => {
    if (list) {
      categoriesStore.set(list);
    }
  }
);

watch(
  partiesFile.data,

  data => {
    if (data) {
      partiesStore.set(data.parties);
    }
  }
);

watch(
  transferTypesFile.data,

  data => {
    if (data) {
      transferTypesStore.set(data.transferTypes);
    }
  }
);

watch(
  tagsFile.data,

  list => {
    if (list) {
      tagsStore.set(list);
    }
  }
);

watch(
  documentTagsFile.data,

  list => {
    if (list) {
      documentTagsStore.set(list);
    }
  }
);

const current =
  computed(() =>
    section.value === "spending"
      ? (tagsFile.error.value
          ? tagsFile
          : transferTypesFile.error.value
            ? transferTypesFile
            : categoriesFile)
      : section.value === "documents" && documentTagsFile.error.value
        ? documentTagsFile
        : partiesFile
  );
</script>

<template>
  <PageHeader
    title="Master data"
    icon="process"
  />

  <main class="master-data-view">
    <section class="filters">
      <SegmentedControl
        v-model="section"
        :options="sectionOptions"
      />
    </section>

    <div
      v-if="current.error.value"
      class="state-message error"
    >
      {{ current.error.value }}
    </div>

    <div
      v-else-if="!current.data.value"
      class="state-message"
    >
      Loading master data…
    </div>

    <template v-else>
      <PartiesSection
        v-if="section === 'parties' && partiesFile.data.value"
        :data="partiesFile.data.value"
      />

      <PartyTypesSection
        v-else-if="section === 'partyTypes' && partiesFile.data.value"
        :data="partiesFile.data.value"
      />

      <SpendingSection
        v-else-if="section === 'spending' && categoriesFile.data.value"
        :categories="categoriesFile.data.value"
        :allocation-tags="tagsFile.data.value"
        :transfer-types="transferTypesFile.data.value"
      />

      <DocumentsSection
        v-else-if="section === 'documents' && partiesFile.data.value"
        :data="partiesFile.data.value"
        :document-tags="documentTagsFile.data.value"
      />
    </template>
  </main>
</template>

<style scoped>
.master-data-view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;

  padding: 1rem 1.5rem 2rem;
}

.state-message {
  padding: 1rem 0;

  color: var(--text-soft);
}

.state-message.error {
  color: var(--negative);
}
</style>
