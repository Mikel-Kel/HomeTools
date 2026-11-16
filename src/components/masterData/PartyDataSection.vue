<script setup lang="ts">
import SegmentedControl from "@/components/ui/SegmentedControl.vue";
import PartiesSection from "@/components/masterData/PartiesSection.vue";
import PartiesToIdentifySection from "@/components/masterData/PartiesToIdentifySection.vue";
import PartyTypesSection from "@/components/masterData/PartyTypesSection.vue";

import type { PartiesData } from "@/contracts/parties";
import type { PartiesToIdentifyData } from "@/contracts/partiesToIdentify";

import { usePersistentRef } from "@/composables/usePersistentRef";

/* =========================
   Section « Parties » de la page Master data

   Les parties existantes (Actual), les contreparties à
   identifier et les types de partie.
========================= */

defineProps<{
  data: PartiesData;

  /* null : liste pas encore publiée (ou en chargement). */
  toIdentify: PartiesToIdentifyData | null;
  toIdentifyLoading: boolean;
}>();

type PartiesFamily =
  | "actual"
  | "toIdentify"
  | "partyTypes";

const familyOptions: {
  value: PartiesFamily;
  label: string;
}[] = [
  { value: "actual", label: "Actual" },
  { value: "toIdentify", label: "To identify" },
  { value: "partyTypes", label: "Party types" },
];

const family =
  usePersistentRef<PartiesFamily>("masterData.parties.family", "actual");

/* Famille mémorisée qui n'existe plus : la première. */
if (!familyOptions.some(option => option.value === family.value)) {
  family.value = "actual";
}
</script>

<template>
  <PartiesToIdentifySection
    v-if="family === 'toIdentify'"
    :data="toIdentify"
    :loading="toIdentifyLoading"
    :parties="data"
  >
    <template #title>
      <SegmentedControl
        v-model="family"
        :options="familyOptions"
      />
    </template>
  </PartiesToIdentifySection>

  <PartyTypesSection
    v-else-if="family === 'partyTypes'"
    :data="data"
  >
    <template #title>
      <SegmentedControl
        v-model="family"
        :options="familyOptions"
      />
    </template>
  </PartyTypesSection>

  <PartiesSection
    v-else
    :data="data"
  >
    <template #title>
      <SegmentedControl
        v-model="family"
        :options="familyOptions"
      />
    </template>
  </PartiesSection>
</template>
