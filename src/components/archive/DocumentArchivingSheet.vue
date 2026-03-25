<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue"

import { useAppBootstrap } from "@/composables/useAppBootstrap"
const { loadSettings } = useAppBootstrap()

import { useAppParameters } from "@/composables/useAppParameters"
import { useParties } from "@/composables/useParties"
import DateChip from "@/components/DateChip.vue"
import { useDocumentTags } from "@/composables/useDocumentTags"
import { useAmountInput } from "@/composables/useAmountInput"

/* =========================
   Emits
========================= */
const emit = defineEmits(["save","close"])

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
const { appParameters } = useAppParameters()
const partiesStore = useParties()
const tagsStore = useDocumentTags()

/* =========================
   Reactive state
========================= */
const localDoc = ref<ArchiveDocument>({ ...props.doc })
const selectedTags = ref<number[]>([...(props.doc.tagIDs ?? [])])

const relationSearch = ref("")
const relationOpen = ref(false)

/*const docDateInput = ref<HTMLInputElement | null>(null)
const dtaDateInput = ref<HTMLInputElement | null>(null)
*/

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
const {
  input: amountInput,
  onFocus: onAmountFocus,
  onInput: onAmountInput,
  onBlur: onAmountBlur
} = useAmountInput(
  computed({
    get: () => localDoc.value.refAmount,
    set: (v) => {
      localDoc.value.refAmount = v ?? 0
    }
  })
)

/* ---------- Relation filtering ---------- */
const filteredParties = computed(() => {
  const q = relationSearch.value.trim().toLowerCase()

  if (!q) return parties.value.slice(0, 15)

  return parties.value
    .filter(p => p.label.toLowerCase().includes(q))
    .slice(0, 15)
})

/* =========================
   Dirty state
========================= */
const isDirty = computed(() => {
  const docChanged =
    JSON.stringify(localDoc.value) !== JSON.stringify(props.doc)

  const tagsChanged =
    JSON.stringify(selectedTags.value.sort()) !==
    JSON.stringify((props.doc.tagIDs ?? []).slice().sort())

  return docChanged || tagsChanged
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

    if (folder === billsFolderSource.value) {

      if (!localDoc.value.dtaDate) {

        const dta = computeNextDTADate()

        localDoc.value = {
          ...localDoc.value,
          dtaDate: dta
        }
      }

    } else {

      localDoc.value = {
        ...localDoc.value,
        dtaDate: null,
        refAmount: 0
      }

    }
  },
  { immediate: true } // 👈 ⭐ LA CLÉ
)

/* =========================
   Actions
========================= */

/* Dates */
function adjustToBusinessDay(date: Date): Date {
  const d = new Date(date)

  const day = d.getDay()

  // samedi → vendredi
  if (day === 6) {
    d.setDate(d.getDate() - 1)
  }

  // dimanche → vendredi
  if (day === 0) {
    d.setDate(d.getDate() - 2)
  }

  return d
}

function computeNextDTADate(): string {

  const today = new Date()

  const baseToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  )

  const candidates: Date[] = []

  for (let offset = 0; offset <= 1; offset++) {

    const base = new Date(
      today.getFullYear(),
      today.getMonth() + offset,
      1
    )

    const y = base.getFullYear()
    const m = base.getMonth()

    candidates.push(new Date(y, m, 15))
    candidates.push(new Date(y, m + 1, 0))
  }

  const future = candidates
    .filter(d => d >= baseToday)
    .sort((a, b) => a.getTime() - b.getTime())

  const selected =
    future.length ? adjustToBusinessDay(future[0]) : baseToday

  // 🔥 FORCER format ISO sûr
  const yyyy = selected.getFullYear()
  const mm = String(selected.getMonth() + 1).padStart(2, "0")
  const dd = String(selected.getDate()).padStart(2, "0")

  return `${yyyy}-${mm}-${dd}`
}

/*function openPicker(el: HTMLInputElement | null) {
  if (!el) return

  try {
    if (typeof el.showPicker === "function") {
      el.showPicker()
    } else {
      el.focus()
      el.click() // 👈 bonus iOS
    }
  } catch {
    el.focus()
  }
}

function openDocDatePicker() {
  openPicker(docDateInput.value)
}

function openDTADatePicker() {
  openPicker(dtaDateInput.value)
}
*/ 

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
  await loadSettings()
})

function onCancel() {
  localDoc.value = { ...props.doc }
  selectedTags.value = [...(props.doc.tagIDs ?? [])]

  emit("close")
}

function onSave() {
  emit("save", {
    ...localDoc.value,
    tagIDs: [...selectedTags.value]
  })

  emit("close")
}
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
          ref="relationInput"
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
      <DateChip v-model="localDoc.documentDate" />
      <DateChip
        v-if="isBillsFolder"
        v-model="localDoc.dtaDate"
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
      :value="amountInput"
      @input="onAmountInput(($event.target as HTMLInputElement).value)"
      @focus="onAmountFocus($event)"
      @blur="onAmountBlur"
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

  <!-- Actions -->
  <div class="actions-bar">
    <button class="btn cancel" @click="onCancel">
      Cancel
    </button>

    <button
      class="btn save"
      :disabled="!isDirty"
      @click="onSave"
    >
      Save
    </button>
  </div>

</div>
</template>

<style scoped>

/* Overlay */
.overlay {
position: fixed;
inset: 0;
background: var(--overlay);
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
background: var(--surface);
padding: 22px;
border-radius: 14px;
box-shadow: var(--shadow-lg);
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
  background: var(--primary-soft);
  color:var(--text)
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
color: var(--text-soft);
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
border: 1px solid var(--border);
background: var(--surface-soft);
color:var(--text);
font-size: 0.75rem;
font-weight: 600;
opacity: 0.7;
cursor: pointer;
white-space: nowrap;
}

.chip.active {
opacity: 1;
background: var(--primary-soft);
color:var(--primary);
border-color: var(--primary);
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
  min-width: 0;
  padding: 6px 8px 6px 28px;
  box-sizing: border-box;

  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 6px;

  /* 🔥 CRITIQUE Safari */
  -webkit-text-fill-color: var(--text);
  appearance: none;
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

  background: var(--surface-soft);
  color: var(--text);
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
  color: var(--text);
}

/* Dates */
.dates-row {
display: flex;
gap: 10px;
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
border: 1px solid var(--border);
border-radius: 6px;
background: var(--surface-soft);
color:var(--text)
}
.amount-input {
  flex: 0 0 40px;
  max-width: 90px;
  padding: 6px 8px;

  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 6px;

  text-align: right;
  font-variant-numeric: tabular-nums;

  /* 🔥 Safari */
  -webkit-text-fill-color: var(--text);
  appearance: none;
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
border: 1px solid var(--border);
background: var(--surface-soft);
color: var(--text-soft);
cursor: pointer;
}

.tags button.active {
border: 2px solid var(--primary);
color:var(--primary);
background: var(--primary-soft);
}

.actions-bar {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.btn {
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
}

/* Cancel */
.btn.cancel {
  background: var(--surface-soft);
  color: var(--text);
}

/* Save */
.btn.save {
background: var(--primary);
color: var(--text);
}

.btn.save:disabled {
  opacity: 0.4;
  cursor: default;
}
</style>