<script setup lang="ts">
import {
  computed,
  ref,
  watch,
} from "vue";

import PageHeader from "@/components/PageHeader.vue";
import SegmentedControl from "@/components/ui/SegmentedControl.vue";
import PartyDataSection from "@/components/masterData/PartyDataSection.vue";
import SpendingSection from "@/components/masterData/SpendingSection.vue";
import DocumentsSection from "@/components/masterData/DocumentsSection.vue";
import WineSection from "@/components/masterData/WineSection.vue";
import PortfolioSection from "@/components/masterData/PortfolioSection.vue";

import { useRemoteJson } from "@/composables/useRemoteJson";
import { useCategories } from "@/composables/useCategories";
import { useParties } from "@/composables/useParties";
import { useTransferTypes } from "@/composables/useTransferTypes";
import { useAllocationTags } from "@/composables/allocations/useAllocationTags";
import { useDocumentTags } from "@/composables/archives/useDocumentTags";

import {
  ALLOCATION_RULES_FILE,
  ALLOCATION_RULES_FOLDER,
  readAllocationRules,
} from "@/contracts/allocationRules";

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
  PARTIES_TO_IDENTIFY_FILE,
  PARTIES_TO_IDENTIFY_FOLDER,
  readPartiesToIdentify,
} from "@/contracts/partiesToIdentify";

import {
  readWineCellar,
  WINE_CELLAR_FILE,
  WINE_CELLAR_FOLDER,
} from "@/contracts/wineCellar";

import {
  PORTFOLIO_FILE,
  PORTFOLIO_FOLDER,
  readPortfolio,
} from "@/contracts/portfolio";

import { hasCapability } from "@/services/environment/environmentState";

import {
  readTransferTypes,
  TRANSFER_TYPES_FILE,
  TRANSFER_TYPES_FOLDER,
} from "@/contracts/transferTypes";

import { usePersistentRef } from "@/composables/usePersistentRef";

/* =========================
   Données de base (Master data)

   Une section par domaine, chacune avec ses sous-menus ;
   modifications envoyées au Mac par événements, données
   relues dès que le backend republie leur export.
   - Parties : existantes, à identifier, types de partie ;
   - Spending : catégories, tags, types d'opération et
     règles d'allocation (libellés des parties) ;
   - Documents : dossiers Tourism et Various, tags ;
   - Portfolio : titres du portefeuille ;
   - Wine cellar : données de base de la cave, avec la
     capacité wineCellar seulement.
========================= */

type MasterDataSection =
  | "parties"
  | "spending"
  | "documents"
  | "portfolio"
  | "wine";

const sectionOptions: {
  value: MasterDataSection;
  label: string;
}[] = [
  { value: "parties", label: "Parties" },
  { value: "spending", label: "Spending" },
  { value: "documents", label: "Documents" },
  { value: "portfolio", label: "Portfolio" },
  ...(hasCapability("wineCellar")
    ? [{ value: "wine" as const, label: "Wine cellar" }]
    : []),
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
      value === "spending" ||
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

/*
  Contreparties à identifier : chargées à la première
  ouverture de la section. Fichier absent (pas encore
  publié) : section vide, sans erreur.
*/
const toIdentifyWanted =
  ref(false);

watch(
  section,

  value => {
    if (value === "parties") {
      toIdentifyWanted.value = true;
    }
  },

  {
    immediate: true,
  }
);

const toIdentifyFile =
  useRemoteJson({
    folder: PARTIES_TO_IDENTIFY_FOLDER,
    file: () => (toIdentifyWanted.value ? PARTIES_TO_IDENTIFY_FILE : null),
    read: readPartiesToIdentify,
    optional: true,
  });

/* Types d'opération (famille de « Spending », libellés des règles) : chargés à la première ouverture de la section. */
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

/*
  Règles d'allocation (famille de « Spending ») : chargées à
  la première ouverture de la section. Fichier absent (pas encore publié) : section
  vide, sans erreur.
*/
const rulesWanted =
  ref(false);

watch(
  section,

  value => {
    if (value === "spending") {
      rulesWanted.value = true;
    }
  },

  {
    immediate: true,
  }
);

const rulesFile =
  useRemoteJson({
    folder: ALLOCATION_RULES_FOLDER,
    file: () => (rulesWanted.value ? ALLOCATION_RULES_FILE : null),
    read: readAllocationRules,
    optional: true,
  });

/* Cave à vins (section « Wine cellar ») : chargée à la première ouverture de la section. */
const cellarWanted =
  ref(false);

watch(
  section,

  value => {
    if (value === "wine") {
      cellarWanted.value = true;
    }
  },

  {
    immediate: true,
  }
);

const cellarFile =
  useRemoteJson({
    folder: WINE_CELLAR_FOLDER,
    file: () => (cellarWanted.value ? WINE_CELLAR_FILE : null),
    read: readWineCellar,
  });

/* Portefeuille (section « Portfolio ») : chargé à la première ouverture de la section. */
const portfolioWanted =
  ref(false);

watch(
  section,

  value => {
    if (value === "portfolio") {
      portfolioWanted.value = true;
    }
  },

  {
    immediate: true,
  }
);

const portfolioFile =
  useRemoteJson({
    folder: PORTFOLIO_FOLDER,
    file: () => (portfolioWanted.value ? PORTFOLIO_FILE : null),
    read: readPortfolio,
  });

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
      ? [tagsFile, transferTypesFile, rulesFile, partiesFile]
          .find(file => file.error.value) ?? categoriesFile
      : section.value === "documents" && documentTagsFile.error.value
        ? documentTagsFile
        : section.value === "parties" && toIdentifyFile.error.value
          ? toIdentifyFile
          : section.value === "wine"
            ? cellarFile
            : section.value === "portfolio"
              ? portfolioFile
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
      <PartyDataSection
        v-if="section === 'parties' && partiesFile.data.value"
        :data="partiesFile.data.value"
        :to-identify="toIdentifyFile.data.value"
        :to-identify-loading="toIdentifyFile.loading.value"
      />

      <SpendingSection
        v-else-if="section === 'spending' && categoriesFile.data.value"
        :categories="categoriesFile.data.value"
        :allocation-tags="tagsFile.data.value"
        :transfer-types="transferTypesFile.data.value"
        :rules="rulesFile.data.value"
        :rules-loading="rulesFile.loading.value"
        :parties="partiesFile.data.value"
      />

      <DocumentsSection
        v-else-if="section === 'documents' && partiesFile.data.value"
        :data="partiesFile.data.value"
        :document-tags="documentTagsFile.data.value"
      />

      <PortfolioSection
        v-else-if="section === 'portfolio' && portfolioFile.data.value"
        :portfolio="portfolioFile.data.value"
      />

      <WineSection
        v-else-if="section === 'wine' && cellarFile.data.value"
        :cellar="cellarFile.data.value"
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
