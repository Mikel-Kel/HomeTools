<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue"

import { useAppBootstrap } from "@/composables/useAppBootstrap"
const { loadSettings } = useAppBootstrap()
import { useAppParameters } from "@/composables/useAppParameters"

import { useParties } from "@/composables/useParties"
import { isVisibleParty } from "@/contracts/parties"
import ChipSelector from "@/components/ChipSelector.vue"
import { useTourismFolders } from "@/composables/archives/useTourismFolders"
import { useVariousFolders } from "@/composables/archives/useVariousFolders"

import DateChip from "@/components/DateChip.vue"
import { useDocumentTags } from "@/composables/archives/useDocumentTags"
import { useAmountInput } from "@/composables/useAmountInput"
import { confirmDialog } from "@/services/dialog/appDialog"
import ArchiveSuggestions from "@/components/archive/ArchiveSuggestions.vue"
import { matchPartiesInText, matchPartyByIban } from "@/services/archive/archivePartyMatch"
import { TO_FILE_FOLDER, type ArchiveQrBill } from "@/contracts/archive"
import type {
  ArchiveSuggestionSource,
  ArchiveSuggestionTarget
} from "@/composables/archives/useArchiveSuggestions"

/* =========================
   Emits
========================= */
const emit = defineEmits(["save","delete","close"])

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
  refAmount: number | null
  tagIDs?: number[]
  physicalName?: string
  /* QR-facture lue par le Mac au dépôt (« A Classer »). */
  qrBill?: ArchiveQrBill | null
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
  /* Suggestions de Description et d'Additional info (historique des classements). */
  suggest?: ArchiveSuggestionSource
}>()

/* =========================
   Stores
========================= */
const { appParameters } = useAppParameters()
const partiesStore = useParties()
const tourismStore = useTourismFolders()
const variousStore = useVariousFolders()
const tagsStore = useDocumentTags()

/* =========================
   Reactive state
========================= */
const localDoc = ref<ArchiveDocument>({ ...props.doc })
const selectedTags = ref<number[]>([...(props.doc.tagIDs ?? [])])

const relationSearch = ref("")
const relationOpen = ref(false)

const relationState = ref<{
  normal: number | null
  tourism: number | null
  various: number | null
}>({
  normal: props.doc.partyID ?? null,
  tourism: null,
  various: null
})

const activeRelation = computed<number | null>({
  get() {
    if (selectedFolderLabel.value === "Tourism") {
      return relationState.value.tourism
    }
    if (selectedFolderLabel.value === "Various") {
      return relationState.value.various
    }
    return relationState.value.normal
  },
  set(v) {
    if (selectedFolderLabel.value === "Tourism") {
      relationState.value.tourism = v
    } else if (selectedFolderLabel.value === "Various") {
      relationState.value.various = v
    } else {
      relationState.value.normal = v
    }
  }
})

/* =========================
   Computed
========================= */
const folders = computed(() =>
  appParameters.value?.archiveFolders ?? []
)

/* Environnement sans archiveFolders : aucun classement possible */
const hasFolders = computed(() => folders.value.length > 0)

const folderItems = computed(() =>
  folders.value.map(f => ({
    id: f.source,
    label: f.label
  }))
)

/* Parties réservées (-1 N/A, 0 To assign) jamais proposées */
const parties = computed(() =>
  partiesStore.parties.value.filter(isVisibleParty)
)

const relationItems = computed(() => {

  if (selectedFolderLabel.value === "Tourism") {
    return tourismStore.folders.value.map(f => ({
      id: f.id,
      label: f.label
    }))
  }

  if (selectedFolderLabel.value === "Various") {
    return variousStore.folders.value.map(f => ({
      id: f.id,
      label: f.label
    }))
  }

  return []
})

function selectParty(p: any) {
  activeRelation.value = p.id
  relationSearch.value = p.label
  relationOpen.value = false
}

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

const isDTAValid = computed(() => {
  if (!isBillsFolder.value) return true
  return !!localDoc.value.dtaDate?.trim()
})

const isDocumentDateValid = computed(() => {
  if (!localDoc.value.documentDate) return true
  const docDate = new Date(localDoc.value.documentDate)
  const maxFuture = new Date()
  maxFuture.setFullYear(maxFuture.getFullYear() + 1)
  maxFuture.setHours(23, 59, 59, 999)
  return docDate <= maxFuture
})

const isValid = computed(() =>
  hasFolders.value &&
  isDTAValid.value &&
  isDocumentDateValid.value
)

/* ---------- Party map ---------- */
const partyMap = computed(() => {
  const map = new Map<number, string>()
  for (const p of partiesStore.parties.value) {
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
const selectedFolderLabel = computed(() => {
  const found = folders.value.find(f => f.source === localDoc.value.folder)
  return found?.label ?? null
})

const isSpecialRelationMode = computed(() =>
  selectedFolderLabel.value === "Tourism" ||
  selectedFolderLabel.value === "Various"
)

const filteredParties = computed(() => {
  const q = relationSearch.value.trim().toLowerCase()

  if (!q) return parties.value.slice(0, 15)

  return parties.value
    .filter(p => p.label.toLowerCase().includes(q))
    .slice(0, 15)
})

/* ---------- Suggestions ---------- */
/* Document tel qu'il est saisi : dossier, relation et date choisis. */
const suggestionTarget = computed<ArchiveSuggestionTarget | null>(() =>
  activeRelation.value
    ? {
        tocid: localDoc.value.tocid,
        folder: localDoc.value.folder,
        partyID: activeRelation.value,
        documentDate: localDoc.value.documentDate
      }
    : null
)

const descriptionSuggestions = computed(() =>
  props.suggest && suggestionTarget.value
    ? props.suggest.descriptionsFor(suggestionTarget.value)
    : []
)

/* Recalculées selon la Description saisie ou choisie. */
const additionalInfoSuggestions = computed(() =>
  props.suggest && suggestionTarget.value
    ? props.suggest.additionalInfosFor(suggestionTarget.value, localDoc.value.info1 ?? "")
    : []
)

/* ---------- Pré-remplissage (documents de « A Classer ») ---------- */
const isToFileDocument = computed(() =>
  props.doc.folder === TO_FILE_FOLDER
)

/*
  Texte tiré d'un nom de fichier libre : document de
  « A Classer » sans relation, dont le Mac a mis le nom
  dans la Description.
*/
const fileNameText = computed(() =>
  isToFileDocument.value && !props.doc.partyID
    ? props.doc.info1 ?? ""
    : ""
)

/*
  Dossier proposé : Bills pour un document qui a une
  QR-facture, sinon le dossier habituel de la relation
  choisie (hors Tourism et Various, dont la relation est un
  sous-dossier).
*/
const suggestedFolder = computed(() => {
  if (props.doc.qrBill && billsFolderSource.value) return billsFolderSource.value

  const partyID = relationState.value.normal
  if (!props.suggest || !partyID) return null

  return props.suggest
    .foldersFor({
      tocid: localDoc.value.tocid,
      folder: localDoc.value.folder,
      partyID,
      documentDate: localDoc.value.documentDate
    })
    .find(source => {
      const label = folders.value.find(f => f.source === source)?.label
      return (
        source !== TO_FILE_FOLDER &&
        !!label &&
        label !== "Tourism" &&
        label !== "Various"
      )
    }) ?? null
})

/* Dernier dossier pré-rempli : remplaçable, contrairement à un choix. */
let prefilledFolder: string | null = null

function prefillFolder(source: string | null) {
  const current = localDoc.value.folder
  if (
    !isToFileDocument.value ||
    !source ||
    (current !== TO_FILE_FOLDER && current !== prefilledFolder)
  ) return
  localDoc.value.folder = source
  prefilledFolder = source
}

/* Dernières valeurs pré-remplies : remplaçables, contrairement à une saisie. */
const prefilled: Record<"info1" | "info2", string | null> = {
  info1: null,
  info2: null
}

function isReplaceable(field: "info1" | "info2"): boolean {
  const value = localDoc.value[field] ?? ""
  return (
    !value.trim() ||
    value === prefilled[field] ||
    (field === "info1" && !!fileNameText.value && value === fileNameText.value)
  )
}

/* Champ vide, texte du nom de fichier ou pré-rempli : première suggestion. */
function prefill(field: "info1" | "info2", text: string | undefined) {
  if (!isToFileDocument.value || !text || !isReplaceable(field)) return
  localDoc.value[field] = text
  prefilled[field] = text
}

/*
  Relation déduite de l'IBAN du créancier de la QR-facture
  (alias « IBAN <iban> »), sinon de son nom, sinon du nom de
  fichier (libellé ou alias d'une partie : « wingo-… »
  → la partie qui a l'alias Wingo), une seule fois, si aucune
  relation n'est choisie.
*/
let relationGuessed = false

function guessRelation() {
  if (
    relationGuessed ||
    !fileNameText.value ||
    isSpecialRelationMode.value ||
    relationState.value.normal ||
    !partiesStore.parties.value.length
  ) return

  relationGuessed = true

  const byIban = props.doc.qrBill?.creditorIban
    ? matchPartyByIban(props.doc.qrBill.creditorIban, partiesStore.parties.value)
    : null
  if (byIban) {
    selectParty(byIban)
    return
  }

  for (const text of [props.doc.qrBill?.creditorName ?? "", fileNameText.value]) {
    const party = text && matchPartiesInText(text, partiesStore.parties.value)[0]
    if (party) {
      selectParty(party)
      return
    }
  }
}

/* ---------- QR-facture (documents de « A Classer ») ---------- */
const qrBill = computed(() =>
  isToFileDocument.value ? props.doc.qrBill ?? null : null
)

/*
  Date de la QR-facture comme date du document, sauf si le
  Mac l'a tirée du nom du fichier (« wingo-2026-10-31-… »).
*/
function prefillBillDate() {
  const billDate = qrBill.value?.billDate
  const current = props.doc.documentDate ?? ""
  const name = props.doc.physicalName ?? ""
  const dateFromName =
    !!current && (name.includes(current) || name.includes(current.replace(/-/g, "")))

  if (billDate && !dateFromName && localDoc.value.documentDate === current) {
    localDoc.value.documentDate = billDate
  }
}

/* Montant de la QR-facture, dans Bills, si le champ est vide. */
function prefillAmount() {
  const amount = qrBill.value?.amount
  if (isBillsFolder.value && amount != null && !localDoc.value.refAmount) {
    localDoc.value.refAmount = amount
  }
}

/* Montant affiché égal à celui de la QR-facture : indice « from QR-bill ». */
const amountFromQrBill = computed(() =>
  qrBill.value?.amount != null && localDoc.value.refAmount === qrBill.value.amount
)

/* ---------- Tags ---------- */
const tooltip = ref<{
  text: string
  x: number
  y: number
} | null>(null)

let tooltipTimer: ReturnType<typeof setTimeout> | null = null

function showTagTooltip(e: MouseEvent, tagId: number) {
  const tag = tags.value.find(t => t.id === tagId)
  if (!tag) return

  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()

  tooltip.value = {
    text: tag.tagName,
    x: rect.left + rect.width / 2,
    y: rect.top - 8
  }

  if (tooltipTimer) clearTimeout(tooltipTimer)

  tooltipTimer = setTimeout(() => {
    tooltip.value = null
    tooltipTimer = null
  }, 2000)
}

function hideTagTooltip() {
  if (tooltipTimer) {
    clearTimeout(tooltipTimer)
    tooltipTimer = null
  }
  tooltip.value = null
}

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

    relationState.value = {
      normal: d.partyID ?? null,
      tourism: null,
      various: null
    }

    const folderLabel =
      folders.value.find(f => f.source === d.folder)?.label ?? null

    if (folderLabel === "Tourism") {
      relationState.value.tourism = d.partyID ?? null
    } else if (folderLabel === "Various") {
      relationState.value.various = d.partyID ?? null
    } else {
      relationState.value.normal = d.partyID ?? null
    }
  },
  { immediate: true }
)

/* Parties loaded → update label */
watch(
  parties,
  () => {
    guessRelation()
    if (!activeRelation.value) return
    const p = parties.value.find(x => x.id === activeRelation.value)
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
        localDoc.value.dtaDate = computeNextDTADate()
      }
    } else {
      localDoc.value.dtaDate = null
      localDoc.value.refAmount = 0
    }
  },
  { immediate: true }
)

/*
  Pré-remplissage : après la copie du document (props.doc),
  qui l'effacerait. La date et le dossier d'abord : les
  suggestions en dépendent ; le montant après la remise à
  zéro du changement de dossier.
*/
prefillBillDate()

watch(
  isBillsFolder,
  () => prefillAmount(),
  { immediate: true }
)

watch(
  suggestedFolder,
  source => prefillFolder(source),
  { immediate: true }
)

watch(
  () => descriptionSuggestions.value[0]?.text,
  text => prefill("info1", text),
  { immediate: true }
)

watch(
  () => additionalInfoSuggestions.value[0]?.text,
  text => prefill("info2", text),
  { immediate: true }
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

/*
  Prochaine date de paiement : le 15 ou le dernier jour du
  mois, ramené au vendredi s'il tombe un week-end ; une date
  ramenée avant aujourd'hui est écartée (samedi 15 → fin du
  mois, pas vendredi 14).
*/
function computeNextDTADate(): string {

  const today = new Date()

  const baseToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  )

  const candidates: Date[] = []

  for (let offset = 0; offset <= 1; offset++) {
    const y = today.getFullYear()
    const m = today.getMonth() + offset

    candidates.push(adjustToBusinessDay(new Date(y, m, 15)))
    candidates.push(adjustToBusinessDay(new Date(y, m + 1, 0)))
  }

  const selected =
    candidates.find(d => d >= baseToday) ?? baseToday

  const yyyy = selected.getFullYear()
  const mm = String(selected.getMonth() + 1).padStart(2, "0")
  const dd = String(selected.getDate()).padStart(2, "0")

  return `${yyyy}-${mm}-${dd}`
}

/* Tags */
function toggleTag(id: number) {
  const i = selectedTags.value.indexOf(id)
  if (i >= 0)
    selectedTags.value.splice(i, 1)
  else
    selectedTags.value.push(id)
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
  const partyID = activeRelation.value
  if (!partyID || !hasFolders.value) return
  if (isBillsFolder.value && !localDoc.value.dtaDate?.trim()) return
  emit("save", {
    ...localDoc.value,
    partyID, // ✅ injecté ici seulement
    tagIDs: [...selectedTags.value]
  })
  emit("close")
}

async function onDelete() {
  const ok = await confirmDialog({
    title: "Delete this document?",
    message: "This action cannot be undone.",
    confirmLabel: "Delete",
    destructive: true
  })
  if (!ok) return
  emit("delete", {
    tocid: localDoc.value.tocid
  })
  emit("close")
}

</script>

<template>
<div class="overlay" @click="emit('close')"></div>
<div class="sheet">
  <!-- Header -->
  <header class="sheet-header">
    <div class="sheet-title-block">
      <span class="sheet-icon">📂</span>
      <div class="sheet-title-texts">
        <h2>Document classification</h2>
        <div class="sheet-subtitle">
          {{(getPartyLabel(activeRelation ?? 0)) + " - " + (localDoc.info1 || "New classification") +
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
    <p v-if="!hasFolders" class="no-folders">
      No archive folders configured for this environment
    </p>
    <ChipSelector
      v-else
      label="Folder"
      :items="folderItems"
      v-model="localDoc.folder"
      :showAll="false"
      :alignWithContent="true"
    />
  </div>
  <!-- Relation -->
  <div class="row relation-field">
    <!-- MODE SPECIAL -->
    <div v-if="isSpecialRelationMode" class="relation-chips">
      <ChipSelector
        :key="selectedFolderLabel ?? 'normal'"
        label="Sub-folder"
        :items="relationItems"
        v-model="activeRelation"
        :showAll="false"
        :alignWithContent="true"
      />
    </div>
    <!-- MODE NORMAL -->
    <div v-else class="relation-input-row">
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
        <div v-if="relationOpen" class="relation-dropdown">
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
  </div> 
  <!-- Document date -->
  <div class="row">
    <span class="label">Document date</span>
    <DateChip v-model="localDoc.documentDate" />
  </div>
  <div
    v-if="!isDocumentDateValid"
    class="field-error"
  >
    Document date cannot be more than 1 year in the future
  </div>
  <!-- Payment date -->
  <div v-if="isBillsFolder" class="row">
    <span class="label">Payment date</span>
    <DateChip v-model="localDoc.dtaDate" />
  </div>
  <div
    v-if="!isDTAValid"
    class="field-error"
  >
    Payment date is required
  </div>
  <!-- Description -->
  <div class="row input-row">
    <span class="label">Description</span>
    <input
      class="text-input"
      v-model="localDoc.info1"
    />
  </div>
  <ArchiveSuggestions
    :suggestions="descriptionSuggestions"
    :current="localDoc.info1 ?? ''"
    @apply="localDoc.info1 = $event"
  />
  <!-- Additional info -->
  <div class="row input-row">
    <span class="label">Additional info</span>
    <input
      class="text-input"
      v-model="localDoc.info2"
    />
  </div>
  <ArchiveSuggestions
    :suggestions="additionalInfoSuggestions"
    :current="localDoc.info2 ?? ''"
    @apply="localDoc.info2 = $event"
  />
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
    <span
      v-if="qrBill && qrBill.currency !== 'CHF'"
      class="amount-currency"
    >
      {{ qrBill.currency }}
    </span>
    <span
      v-if="amountFromQrBill"
      class="amount-source"
      :title="qrBill?.creditorIban"
    >
      (from QR-bill{{ qrBill?.creditorName ? " · " + qrBill.creditorName : "" }})
    </span>
  </div>
  <!-- Tags -->
  <div class="row tags-row">
    <span class="label">Tag(s)</span>
    <div class="tags">
      <div
        v-for="t in tags"
        :key="t.id"
        class="tag-dot"
        :class="{ active: selectedTags.includes(t.id) }"
        :style="{ backgroundColor: t.color }"
        @click="toggleTag(t.id)"
        @mouseenter="showTagTooltip($event, t.id)"
        @mouseleave="hideTagTooltip"
      ></div>
    </div>
  </div>
  <!-- Actions -->
  <div class="actions-bar">
    <button class="btn cancel" @click="onCancel">
      Cancel
    </button>

    <!-- 🟥 DELETE -->
    <button
      class="btn delete"
      @click="onDelete"
    >
      Delete
    </button>

    <button
      class="btn save"
      :disabled="!isDirty || !isValid || !activeRelation"
      @click="onSave"
    >
      Save
    </button>
  </div>
  <!-- Tooltips -->
  </div>
  <div
    v-if="tooltip"
    class="tag-tooltip"
    :style="{
      left: tooltip.x + 'px',
      top: tooltip.y + 'px'
    }"
  >
    {{ tooltip.text }}
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

.no-folders {
margin: 0;
color: var(--warning);
font-size: 0.9rem;
}

.label {
width: 110px;
flex-shrink: 0;
font-size: 0.9rem;
color: var(--text-soft);
}

/* Relation */
.relation-input-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 0px;
}

.relation-select {
  position: relative;
  flex: 1;
  min-width: 0;
}

.relation-input-wrapper {
  position: relative;
  width: 100%;
}

.relation-input-wrapper input {
  width: 100%;
  box-sizing: border-box;

  padding: 6px 8px 6px 28px;

  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 6px;

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

/* Dropdown */
.relation-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;

  background: var(--surface-soft);
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
.amount-currency {
  font-size: 0.85rem;
  font-weight: 600;
}

.amount-source {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  color: var(--text-soft);
  font-size: 0.8rem;
  font-style: italic;
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

.field-error {
  margin-left: 110px;
  margin-top: -6px;
  margin-bottom: 8px;
  font-size: 0.75rem;
  color: var(--negative);
}

/* Tags */
/* =========================================================
   TAGS (DOT STYLE)
========================================================= */

.tags {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-dot {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 1px solid var(--border);
  cursor: pointer;
  opacity: 0.7;
  transition: all 0.15s ease;
}

.tag-dot:hover {
  opacity: 1;
  transform: scale(1.1);
}

/* sélection */
.tag-dot.active {
  opacity: 1;
  border: 2px solid var(--primary);
}

.tag-tooltip {
  position: fixed;
  transform: translate(-50%, -100%);
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.75rem;
  white-space: nowrap;
  pointer-events: none;
  z-index: 3000;
  box-shadow: var(--shadow-sm);
}

.tags button {
border-radius: 8px;
padding: 6px 10px;
font-size: var(--font-size-xs);
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

.btn.delete {
  background: color-mix(in srgb, var(--negative) 15%, transparent);
  color: var(--negative);
  border: 1px solid var(--negative);
}

.btn.delete:hover {
  background: var(--negative);
  color: white;
}
</style>