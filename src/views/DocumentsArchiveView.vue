<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue"
import PageHeader from "@/components/PageHeader.vue"

import { useDrive } from "@/composables/useDrive"
import { useRouter } from "vue-router"

import { useAppBootstrap } from "@/composables/useAppBootstrap"
const { loadSettings } = useAppBootstrap()

import { loadJSONFromFolder } from "@/services/driveAdapter"
import { useDriveJsonFile } from "@/composables/useDriveJsonFile"
import { useDriveWatcher } from "@/composables/useDriveWatcher" 

import { useParties } from "@/composables/useParties"
import { useArchiveFolders } from "@/composables/archives/useArchiveFolders"
import { useTourismFolders } from "@/composables/archives/useTourismFolders"
import { useVariousFolders } from "@/composables/archives/useVariousFolders"

import { formatDate } from "@/utils/dateFormat"
import { formatAmount } from "@/utils/amountFormat"

import ArchiveDocumentSheet from "@/components/archive/DocumentArchivingSheet.vue"

import { useDocumentTags } from "@/composables/archives/useDocumentTags"
import type { DocumentTag } from "@/composables/archives/useDocumentTags"

const tagsStore = useDocumentTags()

/* =========================
   Types
========================= */

interface ArchiveItem {
  tocid: number
  folder: string
  documentDate: string
  dtaDate: string | null
  info1: string
  info2: string
  indicatorDTA: number
  physicalName: string
  partyID: number
  refAmount: number
  googleFileId: string
  tagIDs?:number[]
}

interface ArchiveFile {
  version: number
  generatedAt: string
  count: number
  items: ArchiveItem[]
}

interface Party {
  id: number
  label: string
}

interface PartyFile {
  version: number
  updatedAt: string
  parties: Party[]
}

interface ArchiveFolderConfig {
  id: number
  source: string
  label: string
  order: number
}

interface FolderView {
  source: string
  label: string
  order: number
}

/* =========================
   Drive
========================= */
const router = useRouter()
const { driveStatus } = useDrive()

const folderLabelToSourceMap = computed(() => {
  const map = new Map<string, string>()

  for (const f of archiveFoldersStore.folders.value) {
    map.set(f.label, f.source)
  }

  return map
})

const indexLastModified = ref<string | null>(null)

/* =========================
   State
========================= */
const loading = ref(false)
const error = ref<string | null>(null)

const archive = ref<ArchiveItem[]>([])
const partiesStore = useParties()
const archiveFoldersStore = useArchiveFolders()
const tourismStore = useTourismFolders()
const variousStore = useVariousFolders()

const filtersOpen = ref(true)

const selectedFolder = ref<string | null>(null)

type SubFolder = {
  id: number
  label: string
  seqNb?: number
}

const selectedFolderConfig = computed(() =>
  archiveFoldersStore.folders.value.find(
    f => f.source === selectedFolder.value
  )
)

const subFolders = computed<SubFolder[]>(() => {
  const label = selectedFolderConfig.value?.label
  if (label === "Tourism") {
    return tourismStore.folders.value
  }
  if (label === "Various") {
    return variousStore.folders.value
  }
  return []
})

const selectedSubFolder = ref<number | null>(null)

const selectedDTADate = ref<string | null>(null)
const selectedTags = ref<number[]>([])  

const searchText = ref("")

/* =========================
   Party map
========================= */
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

/* =========================
   Visibility rules
========================= */
const isPayDateVisible = computed(
  () => selectedFolder.value === billsFolderSource.value
)

const isBillsSelected = computed(
  () => selectedFolder.value === billsFolderSource.value
)

/* =========================
   Drive session watcher
========================= */
watch(driveStatus, status => {
  if (status !== "CONNECTED") {
    router.replace({ name: "authentication" })
  }
})

/* =========================
   Folder watcher
========================= */
watch(selectedFolder, val => {
  selectedSubFolder.value = null  // 👈 AJOUT
  if (val === billsFolderSource.value) {
    selectedQuarterOffset.value = 0
    selectDefaultPayDateForQuarter()
  } else {
    selectedDTADate.value = null
  }
})

/* =========================
   Platform detection
========================= */
function isRealMacDesktop() {
  const ua = navigator.userAgent
  const isMac = ua.includes("Macintosh")
  const isTouch = navigator.maxTouchPoints > 1
  return isMac && !isTouch
}

/* =========================
   Open document
========================= */
function openDocument(item: ArchiveItem) {
  if (isRealMacDesktop()) {
    const url =
      `hometools://open?file=${encodeURIComponent(item.physicalName)}`
    window.location.href = url
    return
  }
  if (item.googleFileId) {
    const driveUrl =
      `https://drive.google.com/file/d/${item.googleFileId}/view`
    window.open(driveUrl, "_blank", "noopener")
  }
}

/* =========================
   Load archive
========================= */
async function loadArchive() {

  if (driveStatus.value !== "CONNECTED") return
  loading.value = true
  error.value = null
  try {
    // 1️⃣ index
    const index = await loadJSONFromFolder<any>(
      "archive",
      "index.json"
    )
    if (!index) throw new Error("Index not loaded")
    const years: number[] = index.years ?? []
    let allItems: ArchiveItem[] = []
    // 2️⃣ toFile (A Classer)
    const toFile = await loadJSONFromFolder<any>(
      "archive",
      "toFile.json"
    )
    if (toFile?.items) {
      const mapped = toFile.items.map((i: any) => ({
        ...i,
        folder: "A Classer"
      }))
      allItems.push(...mapped)
    }
    // 3️⃣ yearly files
    for (const year of years) {
      const data = await loadJSONFromFolder<any>(
        "archive",
        `${year}.json`
      )
      if (!data?.groups) continue
      for (const [groupName, group] of Object.entries(data.groups)) {
        const items = (group as any).items ?? []
        const mapped = items.map((i: any) => ({
          ...i,
          folder:
            folderLabelToSourceMap.value.get(groupName)
            ?? groupName // fallback sécurité
        }))    
        allItems.push(...mapped)
      }
    }

    archive.value = allItems
    if (selectedFolder.value === billsFolderSource.value) {
      selectDefaultPayDateForQuarter()
    }

  } catch (err: any) {

    error.value = err.message ?? "Failed to load archive"

  } finally {

    loading.value = false
  }
}

async function smartReload(index: any) {

  const foldersUpdated: string[] =
    index.foldersUpdated ?? []

  if (!foldersUpdated.length) {
    console.log("📦 full reload")
    await loadArchive()
    return
  }

  console.log("📡 smart reload:", foldersUpdated)

  let updatedItems: ArchiveItem[] = []

  for (const f of foldersUpdated) {

    // 🟥 TO FILE
    if (f === "toFile") {

      const toFile = await loadJSONFromFolder<any>(
        "archive",
        "toFile.json"
      )

      if (toFile?.items) {

        const mapped = toFile.items.map((i: any) => ({
          ...i,
          folder: "A Classer"
        }))

        updatedItems.push(...mapped)
      }
    }

    // 🟩 YEAR
    else if (/^\d{4}$/.test(f)) {

      const data = await loadJSONFromFolder<any>(
        "archive",
        `${f}.json`
      )

      if (!data?.groups) continue

      for (const [groupName, group] of Object.entries(data.groups)) {

        const items = (group as any).items ?? []

        const mapped = items.map((i: any) => ({
          ...i,
          folder:
            folderLabelToSourceMap.value.get(groupName)
            ?? groupName
        }))

        updatedItems.push(...mapped)
      }
    }
  }

  // 🧹 replace uniquement les dossiers impactés
  archive.value = [
    ...archive.value.filter(item => {

      return !foldersUpdated.some(f => {

        if (f === "toFile")
          return item.folder === "A Classer"

        if (/^\d{4}$/.test(f))
          return item.documentDate.startsWith(f)

        return false
      })
    }),
    ...updatedItems
  ]

  console.log("✅ smart reload done")
}

/* =========================
   Folder configuration
========================= */
const folderConfigMap = computed(() => {
  const map = new Map<string, { label: string; order: number }>()

  for (const f of archiveFoldersStore.folders.value) {
    map.set(f.source, {
      label: f.label,
      order: f.order
    })
  }

  return map
})

const archiveFolders = computed<FolderView[]>(() => {

  const unique = [...new Set(archive.value.map(i => i.folder))]

  return unique
    .map((f): FolderView => {

      const cfg = folderConfigMap.value.get(f)

      if (!cfg) {
        console.warn("❌ NO MATCH FOR:", f)
      }

      return {
        source: f,
        label: cfg?.label ?? f,
        order: cfg?.order ?? 999
      }
    })
    .sort((a, b) => a.order - b.order)
})

const billsFolderSource = computed(() => {
  const configs =
    (archiveFoldersStore.folders.value as ArchiveFolderConfig[]) ?? []
  const bills = configs.find(f => f.label === "Bills")
  return bills?.source ?? null
})

const subFolderScrollRef = ref<HTMLElement | null>(null)

const canScrollLeft = ref(false)
const canScrollRight = ref(false)

function updateScrollState() {
  const el = subFolderScrollRef.value
  if (!el) return

  canScrollLeft.value = el.scrollLeft > 0
  canScrollRight.value =
    el.scrollLeft + el.clientWidth < el.scrollWidth - 1
}

function scrollSubFolders(direction: number) {
  const el = subFolderScrollRef.value
  if (!el) return

  const scrollAmount = el.clientWidth * 0.7

  el.scrollBy({
    left: direction * scrollAmount,
    behavior: "smooth"
  })

  // ⏳ attendre la fin du scroll
  setTimeout(updateScrollState, 250)
}

/* update quand données changent */
watch(subFolders, () => {
  setTimeout(updateScrollState, 0)
})

/* update au mount */
onMounted(() => {
  setTimeout(updateScrollState, 0)
})

/* =========================
   Quarter logic
========================= */

const selectedQuarterOffset = ref(0)

function getQuarterKey(dateStr: string) {

  const [y, m] = dateStr.split("-").map(Number)

  const quarter = Math.floor((m - 1) / 3) + 1

  return `${y} Q${quarter}`
}

function getCurrentQuarterKey() {

  const now = new Date()

  const q = Math.floor(now.getMonth() / 3) + 1

  return `${now.getFullYear()} Q${q}`
}

const payDatesByQuarter = computed(() => {

  const map = new Map<string, string[]>()

  for (const item of archive.value) {

    if (!item.dtaDate) continue

    const key = getQuarterKey(item.dtaDate)

    if (!map.has(key)) map.set(key, [])

    map.get(key)!.push(item.dtaDate)
  }

  for (const [k, arr] of map) {

    const unique = [...new Set(arr)]

    unique.sort((a, b) => b.localeCompare(a))

    map.set(k, unique)
  }

  return map
})

const availableQuarters = computed(() =>
  [...payDatesByQuarter.value.keys()].sort().reverse()
)

const activeQuarterIndex = computed(() => {

  if (!availableQuarters.value.length) return -1

  const idx =
    availableQuarters.value.indexOf(getCurrentQuarterKey())

  return idx === -1 ? 0 : idx
})

const activeQuarterKey = computed(() => {

  if (!availableQuarters.value.length) return null

  const base = activeQuarterIndex.value

  const shifted = base + selectedQuarterOffset.value

  if (shifted < 0 || shifted >= availableQuarters.value.length)
    return availableQuarters.value[base]

  return availableQuarters.value[shifted]

})

const payDatesInActiveQuarter = computed(() => {

  if (!activeQuarterKey.value) return []

  return payDatesByQuarter.value.get(activeQuarterKey.value) ?? []
})

watch(activeQuarterKey, () => {
  selectDefaultPayDateForQuarter()
})

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function selectDefaultPayDateForQuarter() {

  const quarter = activeQuarterKey.value

  if (!quarter) return

  const dates = payDatesByQuarter.value.get(quarter) ?? []

  if (!dates.length) return

  if (quarter === getCurrentQuarterKey()) {

    const asc = [...dates].sort((a, b) =>
      a.localeCompare(b)
    )

    const next = asc.find(d => d >= todayISO())

    selectedDTADate.value =
      next ?? asc[asc.length - 1]

  } else {

    selectedDTADate.value = dates[0]

  }
}

function toggleFilterTag(id: number) {
  const i = selectedTags.value.indexOf(id)
  if (i >= 0)
    selectedTags.value.splice(i, 1)
  else
    selectedTags.value.push(id)
}

/* =========================
   Filtering
========================= */
function resetFilters() {

  selectedFolder.value = defaultFolder.value
  selectedSubFolder.value = null
  selectedDTADate.value = null
  selectedTags.value = []
  searchText.value = ""
  selectedQuarterOffset.value = 0
}

const defaultFolder = computed(() => {
  const configs =
    (archiveFoldersStore.folders.value as ArchiveFolderConfig[]) ?? []
  const sorted = [...configs].sort((a, b) => a.order - b.order)
  return sorted[0]?.source ?? null
})

const filteredItems = computed(() => {

  return archive.value
    .filter(item => {

      if (
        selectedFolder.value &&
        item.folder !== selectedFolder.value
      )
        return false

      if (selectedSubFolder.value) {
        if (item.partyID !== selectedSubFolder.value) {
          return false
        }
      }

      if (
        isPayDateVisible.value &&
        selectedDTADate.value &&
        item.dtaDate !== selectedDTADate.value
      )
        return false

      if (searchText.value.trim()) {

        const t = searchText.value.trim().toLowerCase()

        const party =
          getPartyLabel(item.partyID).toLowerCase()

        const info1 = item.info1?.toLowerCase() ?? ""

        const info2 = item.info2?.toLowerCase() ?? ""

        if (
          !party.includes(t) &&
          !info1.includes(t) &&
          !info2.includes(t)
        )
          return false
      }

      // TAG FILTER
      if (selectedTags.value.length) {
        const itemTags = item.tagIDs ?? []
        const hasMatch = selectedTags.value.some(tagId =>
          itemTags.includes(tagId)
        )
        if (!hasMatch) return false
      }

      return true

    })
    .sort((a, b) =>
      b.documentDate.localeCompare(a.documentDate)
    )
})

const resultCount = computed(
  () => filteredItems.value.length
)

/* =========================
   Classification sheet
========================= */

const selectedItem = ref<ArchiveItem | null>(null)

function openClassification(item: ArchiveItem) {
  selectedItem.value = item
}

function closeClassification() {
  selectedItem.value = null
}

/* =========================
   Save classification
========================= */

function buildEventFileName(tocid: number): string {

  const now = new Date()

  const YYYY = now.getFullYear()
  const MM = String(now.getMonth() + 1).padStart(2, "0")
  const DD = String(now.getDate()).padStart(2, "0")

  const HH = String(now.getHours()).padStart(2, "0")
  const mm = String(now.getMinutes()).padStart(2, "0")

  return `TOC_${YYYY}${MM}${DD}${HH}${mm}_${tocid}.json`
}


function formatPartyID(partyID: number): string {
  return "P" + String(partyID).padStart(5, "0")
}


function buildPhysicalName(item: ArchiveItem): string {

  const docDate = item.documentDate

  const dta =
    item.dtaDate
      ? `-DTA${item.dtaDate.replace(/-/g, "")}`
      : ""

  const if1 =
    item.info1
      ? `-IF1${item.info1}`
      : ""

  const if2 =
    item.info2
      ? `-IF2${item.info2}`
      : ""

  const tags =
    item.tagIDs?.length
      ? `-TAG${item.tagIDs.join("_")}`
      : ""

  const amount =
    item.refAmount
      ? `-AMT${Math.round(item.refAmount * 100)}`
      : ""

  const ext = ".pdf"

  // 🟥 CASE: TO FILE (ROOT)
  if (item.folder === "A Classer") {
    const relationLabel =
      getPartyLabel(item.partyID) || `${item.partyID}`
    return `${docDate}-${relationLabel}${if1}${if2}${tags}${amount}${ext}`
  }

  // 🟩 NORMAL CASE
  const year = item.documentDate.slice(0, 4)
  const relation = formatPartyID(item.partyID)
  return `${year}/${item.folder}/${relation}/${docDate}${dta}${if1}${if2}${tags}${amount}${ext}`
}


async function saveClassification(updated: ArchiveItem) {

  const processedFilePhysicalName = updated.physicalName

  try {
    // =========================
    // 1. Optimistic UI
    // =========================
    const idx = archive.value.findIndex(
      x => x.tocid === updated.tocid
    )
    if (idx !== -1) {
      archive.value[idx] = { ...updated }
    }

    // =========================
    // 2. Build physicalName
    // =========================
    const newPhysicalName = buildPhysicalName(updated)

    // =========================
    // 3. Build event
    // =========================
    const event = {
      eventType: "ARCHIVE_UPDATED",
      version: 1,
      timestamp: new Date().toISOString(),
      processedFile: processedFilePhysicalName,

      archiveMetadata: {
        tocid: updated.tocid,
        googleFileId: updated.googleFileId,
        newPhysicalName,
        folder: updated.folder,
        partyID: updated.partyID,
        documentDate: updated.documentDate,
        dtaDate: updated.dtaDate,
        info1: updated.info1,
        info2: updated.info2,
        refAmount: updated.refAmount,
        tagIDs: updated.tagIDs ?? []
      }
    }

    // =========================
    // 4. File name
    // =========================
    const fileName = buildEventFileName(updated.tocid)

    // =========================
    // 5. Write via composable
    // =========================
    const { save } = useDriveJsonFile(
      "events",
      fileName
    )

    await save(event)
    await loadArchive()

  } catch (e) {

    console.error("Save failed", e)
  }
}


async function deleteDocument(payload: { tocid: number }) {

  try {

    const fileName = buildEventFileName(payload.tocid)

    const event = {
      eventType: "ARCHIVE_DELETED",
      version: 1,
      timestamp: new Date().toISOString(),

      archiveMetadata: {
        tocid: payload.tocid
      }
    }

    const { save } = useDriveJsonFile(
      "events",
      fileName
    )

    await save(event)

    // ❌ PAS de reload ici !
    // 👉 ton watcher index.json va s'en charger

  } catch (e) {

    console.error("Delete failed", e)

  }
}

function rowClick(e: MouseEvent, item: ArchiveItem) {
  const el = e.target as HTMLElement
  if (el.closest(".classify-btn")) return
  openDocument(item)
}

const tagMap = computed(() => {

  const map = new Map<number, DocumentTag>()

  tagsStore.tags.value.forEach(t => {
    map.set(t.id, t)
  })

  return map
})

const tooltip = ref<{
  text: string
  x: number
  y: number
} | null>(null)

let tooltipTimer: ReturnType<typeof setTimeout> | null = null

function showTagTooltip(e: MouseEvent, tagId: number) {
  const tag = tagMap.value.get(tagId)
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
   Formatting
========================= */
function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function highlight(text: string | null | undefined) {

  if (!text) return ""

  const query = searchText.value?.trim()

  if (!query) return text

  const safeQuery = escapeRegExp(query)

  const regex = new RegExp(`(${safeQuery})`, "gi")

  return text.replace(regex, `<mark>$1</mark>`)
}

const headerCountLabel = computed(() => {

  const n = resultCount.value

  return `${n} document${n !== 1 ? "s" : ""}`
})

/* =========================
   Init
========================= */
watch(
  driveStatus,
  async (status) => {
    if (status !== "CONNECTED") return
    await loadSettings()
    await loadArchive()
  },
  { immediate: true }
)

useDriveWatcher({
  folderId: "archive",
  fileName: "index.json",
  lastKnownModified: indexLastModified,
  onChanged: async () => {
    console.log("📡 index.json changed")
    const index = await loadJSONFromFolder<any>(
      "archive",
      "index.json"
    )
    if (!index) return
    // ⏳ très important (latence backend)
    await new Promise(r => setTimeout(r, 200))
    await smartReload(index)
  }
})

onMounted(() => {
  selectedFolder.value = defaultFolder.value
/*  const configs =
    (archiveFoldersStore.folders.value as ArchiveFolderConfig[]) ?? []

  if (configs.length) {
    const sorted = [...configs].sort((a, b) => a.order - b.order)
    selectedFolder.value = sorted[0].source
  }*/
})
</script>

<template>
  <!-- =========================
      STICKY STACK
  ========================= -->
  <div class="sticky-stack">
    <PageHeader title="Documents archives" icon="bookshelf" />
    <div v-if="driveStatus !== 'CONNECTED'" class="archives-view muted">
      Drive session not available.
    </div>
    <div v-else>  
      <section class="filters">
        <header
          class="filters-header clickable"
          @click="filtersOpen = !filtersOpen"
        >
          <span class="arrow">
            {{ filtersOpen ? "▼" : "►" }}
          </span>

          <span class="filters-title">Filters</span>

          <button
            v-if="filtersOpen"
            class="reset-button"
            @click.stop="resetFilters"
          >
            Reset
          </button>
        </header>
        <div v-if="filtersOpen" class="filters-body">
          <!-- Folder -->
          <div class="filter-row with-label">
            <span class="filter-label">Documents</span>

            <div class="chip-line">
              <button
                class="chip"
                :class="{ active: selectedFolder === null }"
                @click="selectedFolder = null"
              >
                All
              </button>

              <button
                v-for="f in archiveFolders"
                :key="f.source"
                class="chip"
                :class="{ active: selectedFolder === f.source }"
                @click="selectedFolder = f.source"
              >
                {{ f.label }}
              </button>
            </div>
          </div>
          <!-- Sub folders -->
          <div
            v-if="subFolders.length"
            class="filter-row with-label subfolder-row"
          >
            <span class="filter-label">Type</span>

              <div class="chip-scroll-wrapper subfolder-layout">

              <!-- ✅ FIXE (ne scroll pas) -->
              <div class="chip-fixed">
                <button
                  class="chip"
                  :class="{ active: selectedSubFolder === null }"
                  @click="selectedSubFolder = null"
                >
                  All
                </button>

                <button
                  v-if="canScrollLeft"
                  class="scroll-btn inside"
                  @click="scrollSubFolders(-1)"
                >
                  ‹
                </button>
              </div>

              <!-- ✅ SCROLLABLE UNIQUEMENT -->
              <div
                class="chip-scroll"
                ref="subFolderScrollRef"
                @scroll="updateScrollState"
              >
                <button
                  v-for="f in subFolders"
                  :key="f.id"
                  class="chip"
                  :class="{ active: selectedSubFolder === f.id }"
                  @click="selectedSubFolder = f.id"
                >
                  {{ f.label }}
                </button>
              </div>

              <!-- 👉 droite -->
              <button
                v-if="canScrollRight"
                class="scroll-btn right"
                @click="scrollSubFolders(1)"
              >
                ›
              </button>

            </div>
          </div>
          <!-- Tags -->
          <div
            v-if="tagsStore.tags.value.length"
            class="filter-row with-label"
          >
            <span class="filter-label">Tags</span>
            <div class="chip-line">
              <!-- All -->
              <button
                class="chip"
                :class="{ active: selectedTags.length === 0 }"
                @click="selectedTags = []"
              >
                None
              </button>               
              <!-- Tags -->
              <div
                v-for="t in tagsStore.tags.value"
                :key="t.id"
                class="tag-dot"
                :class="{ active: selectedTags.includes(t.id) }"
                :style="{ backgroundColor: t.color }"
                @click="toggleFilterTag(t.id)"
                @mouseenter="showTagTooltip($event, t.id)"
                @mouseleave="hideTagTooltip"
              ></div>

            </div>
          </div>
          <!-- Pay Date -->
          <div
            v-if="isPayDateVisible"
            class="filter-row paydate-row"
          >
            <span class="filter-label">
              Pay date
            </span>

            <div class="quarter-capsule">
              <span class="arrow-nav" @click="selectedQuarterOffset--">‹</span>
              <span class="quarter-title">
                {{ activeQuarterKey }}
              </span>
              <span class="arrow-nav" @click="selectedQuarterOffset++">›</span>
            </div>

            <div class="chip-scroll">
              <button
                v-for="d in payDatesInActiveQuarter"
                :key="d"
                class="chip"
                :class="{ active: selectedDTADate === d }"
                @click="selectedDTADate = d"
              >
                {{ formatDate(d,"text") }}
              </button>
            </div>
          </div>
          <!-- Search -->
          <div class="filter-row with-label">
            <span class="filter-label">Search</span>
            <input
              v-model="searchText"
              type="text"
              placeholder="Search info..."
            />
          </div>
        </div>
      </section>

      <!-- Counter with separators -->
      <div class="archive-counter-wrapper">
        <div class="archive-separator"></div>

        <div class="archive-counter">
          <span class="status-pill">
            {{ headerCountLabel }}
          </span>
        </div>

        <div class="archive-separator"></div>
      </div>

    </div>

    <!-- =========================
        SCROLLABLE TABLE AREA
    ========================= -->
    <div class="archives-table-wrapper">
      <table v-if="!loading && !error" class="archive-table">
        <colgroup>
          <col class="col-action" style="width: 35px"/>
          <col class="col-date" style="width: 110px"/>
          <col class="col-party" />
          <col class="col-info1" />
          <col class="col-info2" />
          <col v-if="isBillsSelected" class="col-dta" style="width: 125px"/>
          <col v-if="isBillsSelected" class="col-amount" />
        </colgroup>

        <thead>
          <tr>
            <th class="col-action"></th>
            <th class="col-date">Date</th>
            <th class="col-party">Party</th>
            <th class="col-info1">Info1</th>
            <th class="col-info2">Info2</th>
            <th v-if="isBillsSelected" class="col-dta">DTA</th>
            <th v-if="isBillsSelected" class="col-amount">Amount</th>
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="item in filteredItems"
            :key="item.tocid"
            class="clickable-row"
            @click="rowClick($event, item)"
          >
            <td class="col-action">
              <button
                class="classify-btn"
                @click.stop="openClassification(item)"
              >
                📂
              </button>
            </td>            
            <td class="col-date">{{ formatDate(item.documentDate, "text") }}</td>
            <td class="col-party" v-html="highlight(getPartyLabel(item.partyID))"></td>
            <td class="col-info1" v-html="highlight(item.info1)"></td>
            <td class="col-info2">
              <div class="info2-cell">
                <span
                  class="info2-text"
                  v-html="highlight(item.info2)"
                ></span>
              <span
                v-if="item.tagIDs?.length"
                class="tag-squares"
              >
                <span
                  v-for="tagId in item.tagIDs"
                  :key="tagId"
                  class="tag-square"
                  :style="{ backgroundColor: tagMap.get(tagId)?.color ?? '#ccc' }"
                  @mouseenter="showTagTooltip($event, tagId)"
                  @mouseleave="hideTagTooltip"
                ></span>
              </span>
              </div>
            </td>
            <td v-if="isBillsSelected" class="col-dta">
              <span
                v-if="item.indicatorDTA === 1"
                class="dta-badge"
              >
                {{ formatDate(item.dtaDate, "text") }}
              </span>
            </td>
            <td v-if="isBillsSelected" class="col-amount">
              {{ formatAmount(item.refAmount) }}
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="loading" class="archives-view muted">
        Loading…
      </div>

      <div v-else-if="error" class="archives-view error">
        {{ error }}
      </div>

    </div>
  </div>
  <ArchiveDocumentSheet
    v-if="selectedItem"
    :doc="selectedItem"
    @close="closeClassification"
    @save="saveClassification"
    @delete="deleteDocument"

  />
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

/* =========================================================
   BASE LAYOUT
========================================================= */

.sticky-stack {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  padding-bottom: 4px;
  backdrop-filter: blur(6px);

  /* 🔥 FIX DARK MODE */
  background: color-mix(in srgb, var(--bg) 92%, transparent);

  --sticky-offset: 0px;
}
/* =========================================================
   FILTER HEADER (avec reset)
========================================================= */
.filters-header {
  padding: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filters-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-soft);
}

/* Reset button (identique Spending) */
.reset-button {
  padding: 2px 20px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface-soft);
  color: var(--text-soft);
  font-size: var(--font-size-xs);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.reset-button:hover {
  background: var(--primary-soft);
  border-color: var(--primary);
  color: var(--primary);
}

/* =========================================================
   FILTERS
========================================================= */

.filters-body {
  padding: 6px 12px 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 🔥 STRUCTURE UNIFIÉE (Documents + Type alignés) */
.filter-row.with-label {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr);
  align-items: center;
  gap: 0.75rem;
}

.filter-label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-soft);
}

/* =========================================================
   CHIPS
========================================================= */

.chip {
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 0.75rem;
  font-weight: 600;
  opacity: 0.7;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.chip:hover {
  opacity: 0.9;
}

.chip.active {
  opacity: 1;
  background: var(--primary-soft);
  border-color: var(--primary);
  color: var(--primary);
}

/* ligne simple (Documents) */
.chip-line {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}

/* =========================================================
   SUBFOLDERS (clean + stable)
========================================================= */

.subfolder-layout {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

/* partie fixe (All + ←) */
.chip-fixed {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* partie scrollable */
.chip-scroll {
  display: flex;
  gap: 6px;
  overflow-x: hidden;
  scroll-behavior: smooth;
  min-width: 0;
}

/* bouton droite */
.scroll-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 18px;
  opacity: 0.5;
}

.scroll-btn:hover {
  opacity: 1;
}

/* bouton gauche intégré */
.scroll-btn.inside {
  margin-left: 2px;
}

/* =========================================================
   TAG FILTERS (aligned like chips)
========================================================= */

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

.tag-dot.active {
  opacity: 1;
  border: 2px solid var(--primary);
  transform: scale(1.15);
}

.tag-dot {
  width: 18px;
  height: 18px;
  border-radius: 5px;
  border: 1px solid var(--border);
  cursor: pointer;
  opacity: 0.75;
  transition: all 0.15s ease;

  display: inline-flex;
}

.chip + .tag-dot {
  margin-left: 4px;
}

/* =========================================================
   PAY DATE
========================================================= */

.paydate-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: nowrap;
}

.quarter-capsule {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--primary);
  background: var(--primary-soft);
  color: var(--primary);
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.arrow-nav {
  opacity: 0.6;
  cursor: pointer;
  padding: 0 2px;
  transition: opacity 0.15s;
}

.arrow-nav:hover {
  opacity: 1;
}

.chip-scroll {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  flex: 1;
}

/* =========================================================
   COUNTER
========================================================= */

.archive-counter-wrapper {
  margin-top: 4px;
}

.archive-separator {
  height: 1px;
  background: var(--border);
}

.archive-counter {
  display: flex;
  justify-content: center;
  padding: 4px 0;
}

.status-pill {
  padding: 2px 10px;
  border-radius: 999px;
  border: 1px solid var(--primary);
  background: var(--primary-soft);
  color: var(--primary);
  font-size: 0.7rem;
  font-weight: 600;
}

/* =========================================================
   TABLE WRAPPER
========================================================= */

.archives-table-wrapper {
  height: calc(100vh - 220px);
  overflow-y: auto;
  padding: 0 1.5rem 1.5rem 1.5rem;
  scrollbar-gutter: stable;
}

/* =========================================================
   TABLE
========================================================= */

.archive-table {
  width: 100%;
  table-layout: fixed;
  font-size: 0.85rem;
}

.archive-table col.col-party  { width: auto; }
.archive-table col.col-info1  { width: auto; }
.archive-table col.col-info2  { width: auto; }
.archive-table col.col-dta    { width: 100px; }
.archive-table col.col-amount { width: 80px; }

.archive-table thead th {
  position: sticky;
  top: var(--sticky-offset);
  z-index: 50;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  font-weight: 700;

  /* 🔥 FIX lisibilité dark */
  background: color-mix(in srgb, var(--bg) 96%, transparent);
}

.archive-table th,
.archive-table td {
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* alignements */

.archive-table th.col-date,
.archive-table td.col-date,
.archive-table th.col-dta,
.archive-table td.col-dta {
  text-align: center;
}

.archive-table th.col-party,
.archive-table td.col-party,
.archive-table th.col-info1,
.archive-table td.col-info1,
.archive-table th.col-info2,
.archive-table td.col-info2 {
  text-align: left;
}

.archive-table th.col-amount,
.archive-table td.col-amount {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* =========================================================
   ROWS
========================================================= */

.clickable-row {
  cursor: pointer;
  transition: background 0.15s ease;
}

.clickable-row:hover {
  background: var(--primary-soft);
}

/* =========================================================
   CELLS
========================================================= */

.col-action {
  width: 30px;
  text-align: center;
}

.classify-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 16px;
  opacity: 0.7;
}

.classify-btn:hover {
  opacity: 1;
}

.dta-badge {
  padding: 2px 6px;
  border-radius: 6px;
  background: var(--primary-soft);
  color: var(--primary);
  font-size: 0.75rem;
}

/* =========================================================
   TAGS
========================================================= */

.info2-cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.info2-text {
  min-width: 0;
  flex: 1 1 auto;
}

.tag-squares {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.tag-square {
  width: 11px;
  height: 11px;
  border-radius: 2px;
  border: 1px solid var(--border);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.1); /* 🔥 FIX */
  cursor: pointer;
}

/* =========================================================
   TOOLTIP
========================================================= */

.tag-tooltip {
  position: fixed;
  transform: translate(-50%, -100%);
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--surface);
  color: var(--text); /* 🔥 FIX */
  font-size: 0.75rem;
  white-space: nowrap;
  pointer-events: none;
  z-index: 3000;
  box-shadow: var(--shadow-sm); /* 🔥 FIX */
}

/* =========================================================
   MISC
========================================================= */

mark {
  background: var(--primary-soft);
  color: var(--primary);
  padding: 0 2px;
  border-radius: 3px;
}

.muted {
  opacity: 0.6;
}

.error {
  color: var(--negative);
}

</style>