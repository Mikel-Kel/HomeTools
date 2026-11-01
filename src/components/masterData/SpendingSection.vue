<script setup lang="ts">
import { computed } from "vue";

import SegmentedControl from "@/components/ui/SegmentedControl.vue";
import CategoriesSection from "@/components/masterData/CategoriesSection.vue";
import TagsPanel from "@/components/masterData/TagsPanel.vue";

import type { Category } from "@/contracts/categories";
import { ACC_TAG_TYPE, type AllocationTag } from "@/contracts/allocationTags";

import { fromAllocationTag } from "@/components/masterData/tagItems";

import { usePersistentRef } from "@/composables/usePersistentRef";

/* =========================
   Section « Spending » de la page Master data

   Données de base des mouvements : les catégories et
   sous-catégories, et les tags (Acc).
========================= */

const props = defineProps<{
  categories: Category[];

  /* null : fichier pas encore chargé. */
  allocationTags: AllocationTag[] | null;
}>();

type SpendingFamily =
  | "categories"
  | "tags";

const familyOptions: {
  value: SpendingFamily;
  label: string;
}[] = [
  { value: "categories", label: "Categories" },
  { value: "tags", label: "Tags" },
];

const family =
  usePersistentRef<SpendingFamily>("masterData.spending.family", "categories");

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
