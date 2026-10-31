<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from "vue";

import PageHeader from "@/components/PageHeader.vue";
import SegmentedControl from "@/components/ui/SegmentedControl.vue";
import CategoriesSection from "@/components/masterData/CategoriesSection.vue";
import PartiesSection from "@/components/masterData/PartiesSection.vue";
import PartyTypesSection from "@/components/masterData/PartyTypesSection.vue";
import TagsSection from "@/components/masterData/TagsSection.vue";

import { useRemoteJson } from "@/composables/useRemoteJson";
import { useCategories } from "@/composables/useCategories";
import { useParties } from "@/composables/useParties";
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
  | "categories"
  | "tags";

const sectionOptions: {
  value: MasterDataSection;
  label: string;
}[] = [
  { value: "parties", label: "Parties" },
  { value: "partyTypes", label: "Party types" },
  { value: "categories", label: "Categories" },
  { value: "tags", label: "Tags" },
];

const section =
  usePersistentRef<MasterDataSection>("masterData.section", "parties");

const categoriesStore =
  useCategories();

const partiesStore =
  useParties();

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

/* Chargé à la première ouverture d'une section des parties. */
const partiesWanted =
  ref(false);

watch(
  section,

  value => {
    if (value === "parties" || value === "partyTypes") {
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

/* Chargé à la première ouverture de la section des tags. */
const tagsWanted =
  ref(false);

watch(
  section,

  value => {
    if (value === "tags") {
      tagsWanted.value = true;
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
    file: () => (tagsWanted.value ? DOCUMENT_TAGS_FILE : null),
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
    section.value === "categories"
      ? categoriesFile
      : section.value === "tags"
        ? (documentTagsFile.error.value ? documentTagsFile : tagsFile)
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
      <CategoriesSection
        v-if="section === 'categories' && categoriesFile.data.value"
        :categories="categoriesFile.data.value"
      />

      <PartiesSection
        v-else-if="section === 'parties' && partiesFile.data.value"
        :data="partiesFile.data.value"
      />

      <PartyTypesSection
        v-else-if="section === 'partyTypes' && partiesFile.data.value"
        :data="partiesFile.data.value"
      />

      <TagsSection
        v-else-if="section === 'tags' && tagsFile.data.value"
        :allocation-tags="tagsFile.data.value"
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
