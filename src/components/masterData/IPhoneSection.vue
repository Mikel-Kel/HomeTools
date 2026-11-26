<script setup lang="ts">
import SegmentedControl from "@/components/ui/SegmentedControl.vue";
import CardsSection from "@/components/masterData/CardsSection.vue";
import OwnerSubCategoriesSection from "@/components/masterData/OwnerSubCategoriesSection.vue";

import type { BankingCards } from "@/contracts/bankingCards";
import type { Category } from "@/contracts/categories";

import { usePersistentRef } from "@/composables/usePersistentRef";

/* =========================
   Section « iPhone » de la page Master data

   Saisie des dépenses depuis l'iPhone (capacité mobileExpense,
   ../Backend/docs/mobile-expense-contract.md) : les cartes
   proposées et les sous-catégories de chaque propriétaire,
   toutes deux lues dans bankingCards.json.
========================= */

defineProps<{
  data: BankingCards;
  categories: Category[];

  /* Devises acceptées par le Mac. */
  currencies: string[];
}>();

type IPhoneFamily =
  | "cards"
  | "subCategories";

const familyOptions: {
  value: IPhoneFamily;
  label: string;
}[] = [
  { value: "cards", label: "Cards" },
  { value: "subCategories", label: "Sub-categories" },
];

const family =
  usePersistentRef<IPhoneFamily>("masterData.iphone.family", "cards");

/* Famille mémorisée qui n'existe plus : la première. */
if (!familyOptions.some(option => option.value === family.value)) {
  family.value = "cards";
}
</script>

<template>
  <OwnerSubCategoriesSection
    v-if="family === 'subCategories'"
    :data="data"
    :categories="categories"
  >
    <template #title>
      <SegmentedControl
        v-model="family"
        :options="familyOptions"
      />
    </template>
  </OwnerSubCategoriesSection>

  <CardsSection
    v-else
    :data="data"
    :currencies="currencies"
  >
    <template #title>
      <SegmentedControl
        v-model="family"
        :options="familyOptions"
      />
    </template>
  </CardsSection>
</template>
