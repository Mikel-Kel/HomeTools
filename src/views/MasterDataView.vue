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

import { useRemoteJson } from "@/composables/useRemoteJson";
import { useCategories } from "@/composables/useCategories";
import { useParties } from "@/composables/useParties";

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

/* =========================
   Données de base (Master data)

   Une section par type de données de base ; modifications
   envoyées au Mac par événements, données relues dès que
   le backend republie leur export.
========================= */

type MasterDataSection =
  | "parties"
  | "partyTypes"
  | "categories";

const sectionOptions: {
  value: MasterDataSection;
  label: string;
}[] = [
  { value: "parties", label: "Parties" },
  { value: "partyTypes", label: "Party types" },
  { value: "categories", label: "Categories" },
];

const section =
  ref<MasterDataSection>("parties");

const categoriesStore =
  useCategories();

const partiesStore =
  useParties();

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

const current =
  computed(() =>
    section.value === "categories"
      ? categoriesFile
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
