<script setup lang="ts">
import {
  ref,
  watch,
} from "vue";

import PageHeader from "@/components/PageHeader.vue";
import SegmentedControl from "@/components/ui/SegmentedControl.vue";
import CategoriesSection from "@/components/masterData/CategoriesSection.vue";

import { useRemoteJson } from "@/composables/useRemoteJson";
import { useCategories } from "@/composables/useCategories";

import {
  CATEGORIES_FILE,
  CATEGORIES_FOLDER,
  readCategories,
} from "@/contracts/categories";

/* =========================
   Données de base (Master data)

   Une section par type de données de base ; modifications
   envoyées au Mac par événements, données relues dès que
   le backend republie leur export.
========================= */

type MasterDataSection =
  | "categories";

const sectionOptions: {
  value: MasterDataSection;
  label: string;
}[] = [
  { value: "categories", label: "Categories" },
];

const section =
  ref<MasterDataSection>("categories");

const categoriesStore =
  useCategories();

const categoriesFile =
  useRemoteJson({
    folder: CATEGORIES_FOLDER,
    file: CATEGORIES_FILE,
    read: readCategories,
  });

/*
  Les autres pages lisent les catégories dans le store :
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
</script>

<template>
  <PageHeader
    title="Master data"
    icon="process"
  />

  <div
    v-if="categoriesFile.error.value"
    class="state-message error"
  >
    {{ categoriesFile.error.value }}
  </div>

  <div
    v-else-if="!categoriesFile.data.value"
    class="state-message"
  >
    Loading master data…
  </div>

  <main
    v-else
    class="master-data-view"
  >
    <section class="filters">
      <SegmentedControl
        v-model="section"
        :options="sectionOptions"
      />
    </section>

    <CategoriesSection
      v-if="section === 'categories'"
      :categories="categoriesFile.data.value"
    />
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
  padding: 2rem 1.5rem;

  color: var(--text-soft);
}

.state-message.error {
  color: var(--negative);
}
</style>
