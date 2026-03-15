<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue"

import { useAppParameters } from "@/composables/useAppParameters"
import { useParties } from "@/composables/useParties"
import { useDocumentTags } from "@/composables/useDocumentTags"

/* =========================
   Emits
========================= */

const emit = defineEmits(["close"])

/* =========================
   App parameters
========================= */

const { appParameters } = useAppParameters()

const folders = computed(() =>
  (appParameters.value?.archiveFolders ?? [])
)

/* =========================
   Parties
========================= */

const partiesStore = useParties()

const parties = computed(() =>
  partiesStore.parties.value
)

/* =========================
   Tags
========================= */

const tagsStore = useDocumentTags()

const tags = computed(() =>
  tagsStore.tags.value
)

/* =========================
   Types
========================= */

interface ArchiveDocument {
  tocid: number
  folder: string
  partyID: number

  documentDate: string
  dtaDate: string | null

  info1: string
  info2: string

  refAmount: number

  tags?: number[]
}

/* =========================
   Props
========================= */

const props = defineProps<{
  doc: ArchiveDocument
}>()

/* =========================
   Local editable state
========================= */

const localDoc = ref<ArchiveDocument>({ ...props.doc })

watch(
  () => props.doc,
  d => {
    localDoc.value = { ...d }
    selectedTags.value = d.tags ?? []
  }
)

/* =========================
   Tags selection
========================= */

const selectedTags = ref<number[]>(props.doc.tags ?? [])

function toggleTag(id: number) {

  const i = selectedTags.value.indexOf(id)

  if (i >= 0)
    selectedTags.value.splice(i, 1)
  else
    selectedTags.value.push(id)

}

/* =========================
   Lifecycle
========================= */

onMounted(async () => {

  await tagsStore.load()
  await partiesStore.load()

})

</script>

<template>

<div class="overlay" @click="emit('close')"></div>

<div class="sheet">

  <header class="sheet-header">
    <h2>Document classification</h2>

    <button class="close-btn" @click="emit('close')">
      ✕
    </button>
  </header>

  <!-- Folder -->

  <div class="field">
    <label>Folder</label>

    <select v-model="localDoc.folder">

      <option
        v-for="f in folders"
        :key="f.id"
        :value="f.source"
      >
        {{ f.label }}
      </option>

    </select>
  </div>

  <!-- Relation -->

  <div class="field">
    <label>Relation</label>

    <select v-model="localDoc.partyID">

      <option
        v-for="p in parties"
        :key="p.id"
        :value="p.id"
      >
        {{ p.label }}
      </option>

    </select>
  </div>

  <!-- Document date -->

  <div class="field">
    <label>Document date</label>

    <input
      type="date"
      v-model="localDoc.documentDate"
    >
  </div>

  <!-- DTA date -->

  <div class="field">
    <label>DTA date</label>

    <input
      type="date"
      v-model="localDoc.dtaDate"
    >
  </div>

  <!-- Description -->

  <div class="field">
    <label>Description</label>

    <input v-model="localDoc.info1">
  </div>

  <!-- Additional info -->

  <div class="field">
    <label>Additional info</label>

    <input v-model="localDoc.info2">
  </div>

  <!-- Amount -->

  <div class="field">
    <label>Reference amount</label>

    <input
      type="number"
      step="0.01"
      v-model="localDoc.refAmount"
    >
  </div>

  <!-- Tags -->

  <div class="tags">

    <button
      v-for="t in tags"
      :key="t.id"
      :class="{ active: selectedTags.includes(t.id) }"
      @click="toggleTag(t.id)"
    >
      {{ t.tagName }}
    </button>

  </div>

</div>

</template>

<style scoped>

/* =========================
   Overlay
========================= */

.overlay {

  position: fixed;
  inset: 0;

  background: rgba(0,0,0,0.35);

  z-index: 999;

}

/* =========================
   Sheet
========================= */

.sheet {

  position: fixed;

  top: 50%;
  left: 50%;

  transform: translate(-50%, -50%);

  width: 520px;
  max-width: 90vw;

  background: var(--surface, white);

  padding: 20px;

  border-radius: 14px;

  box-shadow: 0 15px 40px rgba(0,0,0,0.25);

  z-index: 1000;

}

/* =========================
   Header
========================= */

.sheet-header {

  display: flex;
  justify-content: space-between;
  align-items: center;

  margin-bottom: 12px;

}

.close-btn {

  border: none;
  background: transparent;

  font-size: 18px;
  cursor: pointer;

}

/* =========================
   Fields
========================= */

.field {

  margin-bottom: 12px;

  display: flex;
  flex-direction: column;

}

.field label {

  font-size: 0.9rem;
  color: #666;

  margin-bottom: 2px;

}

/* =========================
   Tags
========================= */

.tags {

  margin-top: 8px;

  display: flex;
  flex-wrap: wrap;

  gap: 8px;

}

.tags button {

  border-radius: 8px;

  padding: 6px 10px;

  border: 1px solid #ccc;

  background: white;

  cursor: pointer;

}

.tags button.active {

  border: 2px solid #444;

  background: #f3f3f3;

}

</style>