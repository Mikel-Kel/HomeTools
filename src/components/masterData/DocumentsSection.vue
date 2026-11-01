<script setup lang="ts">
import { computed } from "vue";

import SegmentedControl from "@/components/ui/SegmentedControl.vue";
import FoldersPanel from "@/components/masterData/FoldersPanel.vue";
import TagsPanel from "@/components/masterData/TagsPanel.vue";

import {
  TOURISM_FOLDER_TYPE_ID,
  VARIOUS_FOLDER_TYPE_ID,
  type PartiesData,
} from "@/contracts/parties";

import { DOC_TAG_TYPE, type DocumentTag } from "@/contracts/documentTags";

import { fromDocumentTag } from "@/components/masterData/tagItems";

import { usePersistentRef } from "@/composables/usePersistentRef";

/* =========================
   Section « Documents » de la page Master data

   Données de base des archives : les sous-dossiers des
   dossiers Tourism et Various (parties des types -2 et -1)
   et les tags des documents (Doc).
========================= */

const props = defineProps<{
  data: PartiesData;

  /* null : fichier pas encore chargé. */
  documentTags: DocumentTag[] | null;
}>();

type DocumentsFamily =
  | "tourism"
  | "various"
  | "tags";

const familyOptions: {
  value: DocumentsFamily;
  label: string;
}[] = [
  { value: "tourism", label: "Tourism" },
  { value: "various", label: "Various" },
  { value: "tags", label: "Tags" },
];

const family =
  usePersistentRef<DocumentsFamily>("masterData.documents.family", "tourism");

const tags =
  computed(() =>
    props.documentTags?.map(fromDocumentTag) ?? null
  );
</script>

<template>
  <TagsPanel
    v-if="family === 'tags'"
    :tag-type="DOC_TAG_TYPE"
    :tags="tags"
  >
    <template #title>
      <SegmentedControl
        v-model="family"
        :options="familyOptions"
      />
    </template>
  </TagsPanel>

  <!-- Clé par dossier : changer de dossier ferme fiche et réordonnancement. -->
  <FoldersPanel
    v-else
    :key="family"
    :data="data"
    :type-id="family === 'tourism' ? TOURISM_FOLDER_TYPE_ID : VARIOUS_FOLDER_TYPE_ID"
  >
    <template #title>
      <SegmentedControl
        v-model="family"
        :options="familyOptions"
      />
    </template>
  </FoldersPanel>
</template>
