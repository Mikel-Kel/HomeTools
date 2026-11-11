<script setup lang="ts">
import { computed } from "vue";

import SegmentedControl from "@/components/ui/SegmentedControl.vue";
import CategoriesSection from "@/components/masterData/CategoriesSection.vue";
import TagsPanel from "@/components/masterData/TagsPanel.vue";
import TransferTypesSection from "@/components/masterData/TransferTypesSection.vue";

import type { Category } from "@/contracts/categories";
import { ACC_TAG_TYPE, type AllocationTag } from "@/contracts/allocationTags";
import type { TransferTypesData } from "@/contracts/transferTypes";

import { fromAllocationTag } from "@/components/masterData/tagItems";

import { usePersistentRef } from "@/composables/usePersistentRef";

/* =========================
   Section « Spending » de la page Master data

   Données de base des mouvements : les catégories et
   sous-catégories, les tags (Acc) et les types d'opération
   bancaire.
========================= */

const props = defineProps<{
  categories: Category[];

  /* null : fichier pas encore chargé. */
  allocationTags: AllocationTag[] | null;

  /* null : fichier pas encore chargé. */
  transferTypes: TransferTypesData | null;
}>();

type SpendingFamily =
  | "categories"
  | "tags"
  | "transferTypes";

const familyOptions: {
  value: SpendingFamily;
  label: string;
}[] = [
  { value: "categories", label: "Categories" },
  { value: "tags", label: "Tags" },
  { value: "transferTypes", label: "Transfer types" },
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
