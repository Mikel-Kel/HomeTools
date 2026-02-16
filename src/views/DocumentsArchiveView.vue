<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import PageHeader from "@/components/PageHeader.vue";

import { useDrive } from "@/composables/useDrive";
import { useAppParameters } from "@/composables/useAppParameters";
import { loadJSONFromFolder } from "@/services/google/driveRepository";

/* =========================
   Types
========================= */
interface ArchiveItem {
  tocid: number;
  folder: string;
  documentDate: string;
  dtaDate: string | null;
  info1: string;
  info2: string;
  indicatorDTA: number;
  physicalName: string;
  partyID: number;
  refAmount: number;
  googleFileId: string;
}

interface ArchiveFile {
  version: number;
  generatedAt: string;
  count: number;
  items: ArchiveItem[];
}

interface ArchiveFolderConfig {
  id: number;
  source: string;
  label: string;
  order: number;
}

interface FolderView {
  source: string;
  label: string;
  order: number;
}

/* =========================
   Drive & Parameters
========================= */
const { driveState } = useDrive();
const { appParameters } = useAppParameters();

/* =========================
   Constants
========================= */
const BILLS_FOLDER = "Factures";

/* =========================
   State
========================= */
const loading = ref(false);
const error = ref<string | null>(null);
const archive = ref<ArchiveItem[]>([]);

const filtersOpen = ref(true);
const selectedFolder = ref<string | null>(null);
const selectedDTADate = ref<string | null>(null);
const searchText = ref("");

/* =========================
   DTA activation rule
========================= */
const isPayDateVisible = computed(() => {
  return selectedFolder.value === BILLS_FOLDER;
});

/* =========================
   Watch rules
========================= */

// Si on change de famille → désactiver Pay date
watch(selectedFolder, (val) => {
  if (val !== BILLS_FOLDER) {
    selectedDTADate.value = null;
  }
});

// Si on choisit une pay date → forcer famille Bills
watch(selectedDTADate, (val) => {
  if (val && selectedFolder.value !== BILLS_FOLDER) {
    selectedFolder.value = BILLS_FOLDER;
  }
});

/* =========================
   Platform detection
========================= */
function isRealMacDesktop(): boolean {
  const ua = navigator.userAgent;
  const isMacUA = ua.includes("Macintosh");
  const isTouch = navigator.maxTouchPoints > 1;
  return isMacUA && !isTouch;
}

/* =========================
   Open document
========================= */
function openDocument(item: ArchiveItem) {
  if (isRealMacDesktop()) {
    const url =
      `hometools://open?file=${encodeURIComponent(item.physicalName)}`;
    window.location.href = url;
    return;
  }

  if (item.googleFileId) {
    const driveUrl =
      `https://drive.google.com/file/d/${item.googleFileId}/view`;
    window.open(driveUrl, "_blank", "noopener");
  }
}

/* =========================
   Load
========================= */
async function loadArchive() {
  if (!driveState.value) return;

  loading.value = true;
  error.value = null;

  try {
    const folderId = driveState.value.folders.archive;
    const raw = await loadJSONFromFolder<ArchiveFile>(
      folderId,
      "archivetoc.json"
    );

    if (!raw) return;

    archive.value = raw.items ?? [];
    selectDefaultPayDateForQuarter();
  } catch (err: any) {
    error.value = err.message ?? "Failed to load archive";
  } finally {
    loading.value = false;
  }
}

/* =========================
   Folder config map
========================= */
const folderConfigMap = computed(() => {
  const map = new Map<string, { label: string; order: number }>();
  const configs =
    (appParameters.value?.archiveFolders as ArchiveFolderConfig[]) ?? [];

  for (const f of configs) {
    map.set(f.source, { label: f.label, order: f.order });
  }
  return map;
});

const folders = computed<FolderView[]>(() => {
  const unique = [...new Set(archive.value.map(i => i.folder))];

  return unique
    .map((f): FolderView => {
      const cfg = folderConfigMap.value.get(f);
      return {
        source: f,
        label: cfg?.label ?? f,
        order: cfg?.order ?? 999
      };
    })
    .sort((a, b) => a.order - b.order);
});

/* =========================
   Quarter logic
========================= */
const selectedQuarterOffset = ref(0);

function getQuarterKey(dateStr: string) {
  const [y, m] = dateStr.split("-").map(Number);
  const quarter = Math.floor((m - 1) / 3) + 1;
  return `${y} Q${quarter}`;
}

function getCurrentQuarterKey() {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) + 1;
  return `${now.getFullYear()} Q${q}`;
}

const payDatesByQuarter = computed(() => {
  const map = new Map<string, string[]>();

  for (const item of archive.value) {
    if (!item.dtaDate) continue;

    const key = getQuarterKey(item.dtaDate);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item.dtaDate);
  }

  for (const [k, arr] of map) {
    const unique = [...new Set(arr)];
    unique.sort((a, b) => b.localeCompare(a));
    map.set(k, unique);
  }

  return map;
});

const availableQuarters = computed(() =>
  [...payDatesByQuarter.value.keys()].sort().reverse()
);

const activeQuarterIndex = computed(() => {
  if (!availableQuarters.value.length) return -1;
  const idx = availableQuarters.value.indexOf(getCurrentQuarterKey());
  return idx === -1 ? 0 : idx;
});

const activeQuarterKey = computed(() => {
  if (!availableQuarters.value.length) return null;

  const base = activeQuarterIndex.value;
  const shifted = base + selectedQuarterOffset.value;

  if (shifted < 0 || shifted >= availableQuarters.value.length)
    return availableQuarters.value[base];

  return availableQuarters.value[shifted];
});

const payDatesInActiveQuarter = computed(() => {
  if (!activeQuarterKey.value) return [];
  return payDatesByQuarter.value.get(activeQuarterKey.value) ?? [];
});

watch(activeQuarterKey, () => {
  selectDefaultPayDateForQuarter();
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function selectDefaultPayDateForQuarter() {
  const quarter = activeQuarterKey.value;
  if (!quarter) return;

  const dates =
    payDatesByQuarter.value.get(quarter) ?? [];

  if (!dates.length) return;

  if (quarter === getCurrentQuarterKey()) {
    const asc = [...dates].sort((a, b) =>
      a.localeCompare(b)
    );
    const next = asc.find(d => d >= todayISO());
    selectedDTADate.value =
      next ?? asc[asc.length - 1];
  } else {
    selectedDTADate.value = dates[0];
  }
}

/* =========================
   Filtering
========================= */
const filteredItems = computed(() => {
  return archive.value
    .filter(item => {
      if (selectedFolder.value && item.folder !== selectedFolder.value)
        return false;

      if (
        isPayDateVisible.value &&
        selectedDTADate.value &&
        item.dtaDate !== selectedDTADate.value
      )
        return false;

      if (searchText.value) {
        const t = searchText.value.toLowerCase();
        const match =
          item.info1?.toLowerCase().includes(t) ||
          item.info2?.toLowerCase().includes(t) ||
          item.physicalName?.toLowerCase().includes(t);
        if (!match) return false;
      }

      return true;
    })
    .sort((a, b) =>
      b.documentDate.localeCompare(a.documentDate)
    );
});

const resultCount = computed(() => filteredItems.value.length);

/* =========================
   Formatting
========================= */
function formatDate(d: string | null) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y.slice(2)}`;
}

function formatAmount(a: number) {
  return a.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

onMounted(loadArchive);
</script>

<template>
  <PageHeader title="Documents archives" icon="bookshelf" />

  <div class="sticky-stack">

    <section class="filters">
      <header
        class="filters-header clickable"
        @click="filtersOpen = !filtersOpen"
      >
        <span class="arrow">
          {{ filtersOpen ? "▼" : "►" }}
        </span>
        <h2>Filters</h2>
      </header>

      <div v-if="filtersOpen" class="filters-body">

        <!-- Folder -->
        <div class="filter-row with-label">
          <span class="filter-label">Documents</span>

          <button
            class="chip"
            :class="{ active: selectedFolder === null }"
            @click="selectedFolder = null"
          >
            All
          </button>

          <button
            v-for="f in folders"
            :key="f.source"
            class="chip"
            :class="{ active: selectedFolder === f.source }"
            @click="selectedFolder = f.source"
          >
            {{ f.label }}
          </button>
        </div>

        <!-- Pay Date visible uniquement pour Bills -->
        <div
          v-if="isPayDateVisible"
          class="filter-row paydate-row"
        >

          <span class="filter-label">
            Pay date
          </span>

          <div class="quarter-capsule">
            <span
              class="arrow-nav"
              @click="selectedQuarterOffset--"
            >‹</span>

            <span class="quarter-title">
              {{ activeQuarterKey }}
            </span>

            <span
              class="arrow-nav"
              @click="selectedQuarterOffset++"
            >›</span>
          </div>

          <div class="chip-scroll">
            <button
              v-for="d in payDatesInActiveQuarter"
              :key="d"
              class="chip"
              :class="{ active: selectedDTADate === d }"
              @click="selectedDTADate = d"
            >
              {{ formatDate(d) }}
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

    <div class="archive-separator"></div>

    <div class="archive-counter">
      {{ resultCount }} document<span v-if="resultCount !== 1">s</span>
    </div>
  </div>

  <div class="archives-view">
    <div v-if="loading" class="muted">Loading…</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <table v-else class="archive-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Folder</th>
          <th>Info1</th>
          <th>Info2</th>
          <th>DTA</th>
          <th class="amount">Amount</th>
        </tr>
      </thead>

      <tbody>
        <tr
          v-for="item in filteredItems"
          :key="item.tocid"
          class="clickable-row"
          @click="openDocument(item)"
        >
          <td>{{ formatDate(item.documentDate) }}</td>
          <td>{{ item.folder }}</td>
          <td>{{ item.info1 }}</td>
          <td>{{ item.info2 }}</td>
          <td>
            <span
              v-if="item.indicatorDTA === 1"
              class="dta-badge"
            >
              {{ formatDate(item.dtaDate) }}
            </span>
          </td>
          <td class="amount">
            {{ formatAmount(item.refAmount) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.archives-view {
  padding: 1.5rem;
  background: var(--bg);
  color: var(--text);
}

.sticky-stack {
  position: sticky;
  top: 0;
  z-index: 200;
  background: var(--bg);
}

.filters-body {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-row.with-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.filter-label {
  width: 90px;
  font-size: 0.85rem;
  font-weight: 500;
  opacity: 0.8;
}

.chip {
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 0.75rem;
  font-weight: 600;
  opacity: 0.7;
  cursor: pointer;
  white-space: nowrap;
}

.chip.active {
  opacity: 1;
  background: var(--primary-soft);
  border-color: var(--primary);
}

/* DTA scroll area */
.chip-scroll {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  overflow-y: hidden;
  max-width: 100%;
  scrollbar-width: none;
}

.chip-scroll::-webkit-scrollbar {
  display: none;
}

.archive-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.archive-table th,
.archive-table td {
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--border);
}

.amount {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.clickable-row {
  cursor: pointer;
}

.clickable-row:hover {
  background: var(--primary-soft);
}

.dta-badge {
  padding: 2px 6px;
  border-radius: 6px;
  background: var(--primary-soft);
  font-size: 0.75rem;
}

.paydate-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: nowrap;
}


/* Capsule trimestre = même base que .chip */
.quarter-capsule {
  display: inline-flex;
  align-items: center;
  gap: 6px;

  padding: 6px 10px;
  border-radius: 999px;

  font-size: var(--font-size-xs);
  font-weight: 600;

  border: 1px solid var(--border);
  background: var(--primary-soft);
}

/* Flèches identiques aux chips */
.arrow-nav {
  opacity: 0.6;
  cursor: pointer;
  user-select: none;
  padding: 0 2px;
}

.arrow-nav:hover {
  opacity: 1;
}

/* Libellé trimestre */
.quarter-title {
  font-weight: 600;
}

.chip-scroll {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  overflow-y: hidden;
  flex: 1;
  scrollbar-width: none;
}

.chip-scroll::-webkit-scrollbar {
  display: none;
}
</style>