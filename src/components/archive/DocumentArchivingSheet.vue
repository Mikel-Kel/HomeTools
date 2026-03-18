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
  tagIDs?: number[]
}

interface ArchiveFolderConfig {
  id: number
  source: string
  label: string
  order: number
}

/* =========================
   Props
========================= */
const props = defineProps<{
  doc: ArchiveDocument
}>()

/* =========================
   Stores
========================= */
const { appParameters, load } = useAppParameters()
const partiesStore = useParties()
const tagsStore = useDocumentTags()

/* =========================
   Reactive state
========================= */
const localDoc = ref<ArchiveDocument>({ ...props.doc })
const selectedTags = ref<number[]>([...(props.doc.tagIDs ?? [])])

const relationSearch = ref("")
const relationOpen = ref(false)

const docDateInput = ref<HTMLInputElement | null>(null)
const dtaDateInput = ref<HTMLInputElement | null>(null)

/* =========================
   Computed
========================= */
const folders = computed(() =>
  appParameters.value?.archiveFolders ?? []
)

const parties = computed(() =>
  partiesStore.parties.value
)

const tags = computed(() =>
  tagsStore.tags.value
)

const billsFolderSource = computed(() => {
  const configs =
    (appParameters.value?.archiveFolders as ArchiveFolderConfig[]) ?? []
  const bills = configs.find(f => f.label === "Bills")
  return bills?.source ?? null
})

const isBillsFolder = computed(() =>
  localDoc.value.folder === billsFolderSource.value
)

/* ---------- Party map ---------- */
const partyMap = computed(() => {
  const map = new Map<number, string>()
  for (const p of parties.value) {
    map.set(p.id, p.label)
  }
  return map
})

function getPartyLabel(partyID: number) {
  return partyMap.value.get(partyID) ?? `#${partyID}`
}

/* ---------- Amount ---------- */
const amountDisplay = computed<string>({
  get: () => {
    const v = localDoc.value.refAmount
    return v != null ? v.toFixed(2) : ""
  },
  set: (raw: string) => {
    const normalized =
      raw.replace(/\s/g, "").replace(",", ".")
    const n = Number(normalized)
    if (Number.isFinite(n)) {
      localDoc.value.refAmount = n
    }
  }
})

/* ---------- Relation filtering ---------- */
const filteredParties = computed(() => {
  const q = relationSearch.value.trim().toLowerCase()

  if (!q) return parties.value.slice(0, 15)

  return parties.value
    .filter(p => p.label.toLowerCase().includes(q))
    .slice(0, 15)
})

/* =========================
   Watchers
========================= */

/* Props → local sync */
watch(
  () => props.doc,
  (d) => {
    localDoc.value = { ...d }
    selectedTags.value = [...(d.tagIDs ?? [])]
  },
  { immediate: true }
)

/* Parties loaded → update label */
watch(
  parties,
  () => {
    const p = parties.value.find(
      x => x.id === localDoc.value.partyID
    )
    if (p) relationSearch.value = p.label
  },
  { immediate: true }
)

/* Folder change → reset Bills fields */
watch(
  () => localDoc.value.folder,
  (folder) => {
    if (folder !== billsFolderSource.value) {
      localDoc.value.dtaDate = null
      localDoc.value.refAmount = 0
    }
  }
)

/* =========================
   Actions
========================= */

/* Dates */
function openDocDatePicker() {
  docDateInput.value?.showPicker()
}

function openDTADatePicker() {
  dtaDateInput.value?.showPicker()
}

/* Tags */
function toggleTag(id: number) {
  const i = selectedTags.value.indexOf(id)
  if (i >= 0)
    selectedTags.value.splice(i, 1)
  else
    selectedTags.value.push(id)
}

/* Relation */
function selectParty(p: any) {
  localDoc.value.partyID = p.id
  relationSearch.value = p.label
  relationOpen.value = false
}

function closeRelationDropdown() {
  setTimeout(() => {
    relationOpen.value = false
  }, 150)
}

/* =========================
   Lifecycle
========================= */
onMounted(async () => {
  await load()
  await tagsStore.load()
  await partiesStore.load()
})
</script>

<template>
<div class="overlay" @click="emit('close')"></div>
<div class="sheet">

  <header class="sheet-header">
    <div class="sheet-title-block">
      <span class="sheet-icon">📂</span>
      <div class="sheet-title-texts">
        <h2>Document classification</h2>
        <div class="sheet-subtitle">
          {{(getPartyLabel(localDoc.partyID)) + " - " + (localDoc.info1 || "New classification") +
            (localDoc.info2 ? " " + localDoc.info2 : "")
          }}
        </div>
      </div>
    </div>

    <button class="close-btn" @click="emit('close')" aria-label="Close">
      ✕
    </button>
  </header>

  <!-- Folder -->
  <div class="row folder-row">
    <span class="label">Folder</span>
    <div class="folder-chips">
    <button
      v-for="f in folders"
      :key="f.id"
      class="chip"
      :class="{ active: localDoc.folder === f.source }"
      @click="localDoc.folder = f.source"
      >
      {{ f.label }}
      </button>
    </div>
  </div>

  <!-- Relation -->
  <div class="row relation-field">
    <span class="label">Relation</span>
    <div class="relation-select">
      <div class="relation-input-wrapper">
        <span class="search-icon">🔍</span>
        <input
          v-model="relationSearch"
          type="text"
          placeholder="Search relation..."
          @focus="relationOpen = true"
          @input="relationOpen = true"
          @blur="closeRelationDropdown"
        />
      </div>
      <div
        v-if="relationOpen"
        class="relation-dropdown"
      >
        <div
          v-for="p in filteredParties"
          :key="p.id"
          class="relation-item"
          @click="selectParty(p)"
        >
          {{ p.label }}
        </div>
      </div>
    </div>
  </div>

  <!-- Dates -->
  <div class="row">
    <span class="label">Dates</span>
    <div class="dates-row">
      <span
        class="date-chip clickable"
        @click="openDocDatePicker"
        >
        {{ localDoc.documentDate }}
      </span>
      <input
        ref="docDateInput"
        type="date"
        v-model="localDoc.documentDate"
        class="hidden-date-input"
      />
      <span
        v-if="isBillsFolder"
        class="date-chip clickable"
        @click="openDTADatePicker"
        >
        {{ localDoc.dtaDate }}
      </span>
      <input
        v-if="isBillsFolder"
          ref="dtaDateInput"
          type="date"
          v-model="localDoc.dtaDate"
          class="hidden-date-input"
        />
    </div>
  </div>

  <!-- Description -->
  <div class="row input-row">
    <span class="label">Description</span>
    <input
      class="text-input"
      v-model="localDoc.info1"
    />
  </div>

  <!-- Additional info -->
  <div class="row input-row">
    <span class="label">Additional info</span>
    <input
      class="text-input"
      v-model="localDoc.info2"
    />
  </div>

  <!-- Reference amount -->
  <div v-if="isBillsFolder" class="row input-row">
    <span class="label">Amount</span>
    <input
      v-model="amountDisplay"
      type="text"
      inputmode="decimal"
      class="amount-input"
    />
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

/* Overlay */
.overlay {
position: fixed;
inset: 0;
background: rgba(0,0,0,0.35);
z-index: 999;
}

/* Sheet */
.sheet {
position: fixed;
top: 50%;
left: 50%;
transform: translate(-50%, -50%);
width: 560px;
max-width: 92vw;
background: var(--surface, white);
padding: 22px;
border-radius: 14px;
box-shadow: 0 15px 40px rgba(0,0,0,0.25);
z-index: 1000;
}

.sheet-icon {
  font-size: 48px;
  line-height: 1;
}

/* Header */
.sheet-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 18px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border, #ddd);
}

.sheet-title-block {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}

.sheet-title-texts {
  min-width: 0;
}

.sheet-title-texts h2 {
  margin: 0;
  font-size: 1.05rem;
  line-height: 1.2;
}

.sheet-subtitle {
  margin-top: 2px;
  font-size: 0.78rem;
  color: var(--text-soft, #666);
}

.close-btn {
  border: none;
  background: transparent;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 6px;
}

.close-btn:hover {
  background: var(--primary-soft, #eef3ff);
}

/* Rows */
.row {
display: flex;
align-items: center;
gap: 12px;
margin-bottom: 14px;
}

.label {
width: 110px;
flex-shrink: 0;
font-size: 0.9rem;
color: #666;
}

/* Folder chips */
.folder-chips {
display: flex;
flex-wrap: wrap;
gap: 6px;
}

.chip {
padding: 6px 10px;
border-radius: 999px;
border: 1px solid var(--border,#ccc);
background: var(--surface,white);
font-size: 0.75rem;
font-weight: 600;
opacity: 0.7;
cursor: pointer;
white-space: nowrap;
}

.chip.active {
opacity: 1;
background: var(--primary-soft,#eef3ff);
border-color: var(--primary,#4c6fff);
}

/* Relation */
.relation-field {
  align-items: center;
}

.relation-select {
  position: relative;
  flex: 1;
  min-width: 0;      /* IMPORTANT */
}

.relation-input-wrapper {
  position: relative;
  width: 100%;
  min-width: 0;      /* IMPORTANT */
}

.relation-input-wrapper input {
  width: 100%;
  min-width: 0;      /* IMPORTANT */
  padding: 6px 8px 6px 28px;
  box-sizing: border-box;
}

.search-icon {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 13px;
  opacity: 0.6;
}

/* dropdown */
.relation-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;

  background: white;
  border: 1px solid var(--border);
  border-radius: 6px;

  max-height: 200px;
  overflow-y: auto;

  margin-top: 3px;
  z-index: 2000;
}

.relation-item {
  padding: 6px 8px;
  cursor: pointer;
}

.relation-item:hover {
  background: var(--primary-soft);
}

/* Dates */
.dates-row {
display: flex;
gap: 10px;
}

.date-chip {
padding: 6px 10px;
border-radius: 999px;
border: 1px solid var(--border,#ccc);
background: var(--surface,white);
font-size: 0.8rem;
font-weight: 600;
}

.date-chip.clickable {
cursor: pointer;
}

.date-chip.clickable:hover {
background: var(--primary-soft);
}

.hidden-date-input {
position: absolute;
opacity: 0;
pointer-events: none;
}

/* =========================
Inputs
========================= */
.input-row {
align-items: center;
}

.text-input {
flex: 1;
min-width: 0;
padding: 6px 8px;
border: 1px solid var(--border,#ccc);
border-radius: 6px;
background: var(--surface,white);
}

.amount-input {
flex: 0 0 40px;
max-width: 90px;
padding: 6px 8px;
border: 1px solid var(--border,#ccc);
border-radius: 6px;
text-align: right;
font-variant-numeric: tabular-nums;
}

/* Tags */
.tags {
margin-top: 16px;
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