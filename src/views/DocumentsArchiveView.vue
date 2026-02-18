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

interface Party {
  id: number;
  label: string;
}

interface PartyFile {
  version: number;
  updatedAt: string;
  parties: Party[];
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
const parties = ref<Party[]>([]);

const filtersOpen = ref(true);
const selectedFolder = ref<string | null>(null);
const selectedDTADate = ref<string | null>(null);
const searchText = ref("");

/* =========================
   Party Map (NEW)
========================= */
const partyMap = computed(() => {
  const map = new Map<number, string>();
  for (const p of parties.value) {
    map.set(p.id, p.label);
  }
  return map;
});

function getPartyLabel(partyID: number): string {
  return partyMap.value.get(partyID) ?? `#${partyID}`;
}

/* =========================
   DTA activation rule
========================= */
const isPayDateVisible = computed(() => {
  return selectedFolder.value === BILLS_FOLDER;
});

const isBillsSelected = computed(() => {
  return selectedFolder.value === BILLS_FOLDER;
});

/* =========================
   Watch rules
========================= */

watch(selectedFolder, (val) => {
  if (val !== BILLS_FOLDER) {
    selectedDTADate.value = null;
    return;
  }

  selectedQuarterOffset.value = 0;
  selectDefaultPayDateForQuarter();
});

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

async function loadParty() {
  if (!driveState.value) return;

  try {
    const folderId = driveState.value.folders.settings;

    const raw = await loadJSONFromFolder<PartyFile>(
      folderId,
      "party.json"
    );

    if (!raw) return;

    parties.value = raw.parties ?? [];
  } catch (err: any) {
    console.error("Failed to load party.json", err);
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

      if (searchText.value.trim()) {
        const t = searchText.value.trim().toLowerCase();

        const partyLabel = getPartyLabel(item.partyID).toLowerCase();
        const info1 = item.info1?.toLowerCase() ?? "";
        const info2 = item.info2?.toLowerCase() ?? "";

        const match =
          partyLabel.includes(t) ||
          info1.includes(t) ||
          info2.includes(t);

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

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlight(text: string | null | undefined): string {
  if (!text) return "";

  const query = searchText.value?.trim();
  if (!query) return text;

  const safeQuery = escapeRegExp(query);
  const regex = new RegExp(`(${safeQuery})`, "gi");

  return text.replace(regex, `<mark>$1</mark>`);
}

const headerCountLabel = computed(() => {
  const n = resultCount.value;
  return `${n} document${n !== 1 ? "s" : ""}`;
});

/* =========================
   Init
========================= */
onMounted(async () => {
  await loadArchive();
  await loadParty();
});
</script>

<template>
  <PageHeader title="Documents archives" icon="bookshelf" />

  <!-- =========================
       STICKY STACK
  ========================= -->
  <div class="sticky-stack">

    <section class="filters">
      <header
        class="filters-header clickable"
        @click="filtersOpen = !filtersOpen"
      >
        <span class="arrow">
          {{ filtersOpen ? "▼" : "►" }}
        </span>
        <span class="filters-title">Filters</span>
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

      <thead>
        <tr>
          <th>Date</th>
          <th>Party</th>
          <th>Info1</th>
          <th>Info2</th>
          <th v-if="isBillsSelected">DTA</th>
          <th v-if="isBillsSelected" class="amount">Amount</th>
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
          <td v-html="highlight(getPartyLabel(item.partyID))"></td>
          <td v-html="highlight(item.info1)"></td>
          <td v-html="highlight(item.info2)"></td>
          <td v-if="isBillsSelected">
            <span
              v-if="item.indicatorDTA === 1"
              class="dta-badge"
            >
              {{ formatDate(item.dtaDate) }}
            </span>
          </td>
          <td v-if="isBillsSelected" class="amount">
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
</template>

<style scoped>
/* =========================================================
   BASE LAYOUT
========================================================= */

.sticky-stack {
  position: sticky;
  top: 0;
  z-index: 200;
  background: var(--bg);
}

/* =========================================================
   FILTERS
========================================================= */

.filters-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-soft);
}

.filters-body {
  padding: 6px 12px 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
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

/* =========================================================
   CHIPS
========================================================= */

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
   COUNTER (NO GREY BAND)
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
  background: transparent;
  color: var(--primary);
  font-size: 0.7rem;
  font-weight: 600;
}

/* =========================================================
   TABLE WRAPPER (KEY FIX)
========================================================= */

.archives-table-wrapper {
  height: calc(100vh - 220px); /* adapte si nécessaire */
  overflow-y: auto;
  padding: 0 1.5rem 1.5rem 1rem;
}

/* =========================================================
   TABLE
========================================================= */

.archive-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.archive-table thead th {
  position: sticky;
  top: 0;
  background: var(--bg);
  z-index: 50;
  border-bottom: 1px solid var(--border);
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
mark {
  background: var(--primary-soft);
  color: var(--primary);
  padding: 0 2px;
  border-radius: 3px;
}

/* =========================================================
   STATES
========================================================= */

.muted {
  opacity: 0.6;
}

.error {
  color: var(--danger);
}
</style>