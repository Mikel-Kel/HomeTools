<script setup lang="ts">
import { computed } from "vue";

import SegmentedControl from "@/components/ui/SegmentedControl.vue";
import CategoriesSection from "@/components/masterData/CategoriesSection.vue";
import TagsPanel from "@/components/masterData/TagsPanel.vue";
import TransferTypesSection from "@/components/masterData/TransferTypesSection.vue";
import RulesSection from "@/components/masterData/RulesSection.vue";

import type { AllocationRulesData } from "@/contracts/allocationRules";
import {
  trackedCategories,
  type Category,
} from "@/contracts/categories";
import type { PartiesData } from "@/contracts/parties";
import { ACC_TAG_TYPE, type AllocationTag } from "@/contracts/allocationTags";
import type { TransferTypesData } from "@/contracts/transferTypes";

import { fromAllocationTag } from "@/components/masterData/tagItems";

import { usePersistentRef } from "@/composables/usePersistentRef";

/* =========================
   Section « Spending » de la page Master data

   Données de base des mouvements : les catégories et
   sous-catégories, les tags (Acc), les types d'opération
   bancaire et les règles d'allocation.
========================= */

const props = defineProps<{
  categories: Category[];

  /* null : fichier pas encore chargé. */
  allocationTags: AllocationTag[] | null;

  /* null : fichier pas encore chargé. */
  transferTypes: TransferTypesData | null;

  /* null : pas encore publié ou en chargement. */
  rules: AllocationRulesData | null;
  rulesLoading: boolean;

  /* null : fichier pas encore chargé (libellés des règles). */
  parties: PartiesData | null;
}>();

type SpendingFamily =
  | "categories"
  | "tags"
  | "transferTypes"
  | "rules";

const familyOptions: {
  value: SpendingFamily;
  label: string;
}[] = [
  { value: "categories", label: "Categories" },
  { value: "tags", label: "Tags" },
  { value: "transferTypes", label: "Transfer types" },
  { value: "rules", label: "Rules" },
];

const family =
  usePersistentRef<SpendingFamily>("masterData.spending.family", "categories");

/* Famille mémorisée qui n'existe plus : la première. */
if (!familyOptions.some(option => option.value === family.value)) {
  family.value = "categories";
}

const tags =
  computed(() =>
    props.allocationTags?.map(fromAllocationTag) ?? null
  );

/* Règles d'allocation : jamais de catégorie hors suivi. */
const ruleCategories =
  computed(() =>
    trackedCategories(props.categories)
  );
</script>

<template>
  <TagsPanel
    v-if="family === 'tags'"
    :tag-type="ACC_TAG_TYPE"
    :tags="tags"
  >
    <template #title>
      <SegmentedControl
        v-model="family"
        :options="familyOptions"
      />
    </template>
  </TagsPanel>

  <TransferTypesSection
    v-else-if="family === 'transferTypes'"
    :data="transferTypes"
  >
    <template #title>
      <SegmentedControl
        v-model="family"
        :options="familyOptions"
      />
    </template>
  </TransferTypesSection>

  <RulesSection
    v-else-if="family === 'rules'"
    :rules="rules"
    :loading="rulesLoading"
    :parties="parties"
    :categories="ruleCategories"
    :allocation-tags="allocationTags"
    :transfer-types="transferTypes"
  >
    <template #title>
      <SegmentedControl
        v-model="family"
        :options="familyOptions"
      />
    </template>
  </RulesSection>

  <CategoriesSection
    v-else
    :categories="categories"
  >
    <template #title>
      <SegmentedControl
        v-model="family"
        :options="familyOptions"
      />
    </template>
  </CategoriesSection>
</template>
