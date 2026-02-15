<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import PageHeader from "@/components/PageHeader.vue";

import { useDrive } from "@/composables/useDrive";
import { loadJSONFromFolder } from "@/services/google/driveRepository";

/* =========================
   Types (REAL JSON STRUCTURE)
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

/* =========================
   Drive
========================= */
const { driveState } = useDrive();

/* =========================
   State
========================= */
const loading = ref(false);
const error = ref<string | null>(null);
const archive = ref<ArchiveItem[]>([]);

/* =========================
   Filters
========================= */
const filtersOpen = ref(true);
const selectedFolder = ref<string | null>(null);
const searchText = ref("");
const withDTAOnly = ref(false);

/* =========================
   Load from Drive
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
  } catch (err: any) {
    error.value = err.message ?? "Failed to load archive";
  } finally {
    loading.value = false;
  }
}

/* =========================
   Derived folder list
========================= */
const folders = computed(() =>
  [...new Set(archive.value.map(i => i.folder))].sort()
);

/* =========================
   Filtering logic
========================= */
const filteredItems = computed(() => {
  return archive.value
    .filter(item => {
      if (
        selectedFolder.value &&
        item.folder !== selectedFolder.value
      )
        return false;

      if (withDTAOnly.value && item.indicatorDTA !== 1)
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

const resultCount = computed(
  () => filteredItems.value.length
);

/* =========================
   Formatting helpers
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

/* =========================
   Lifecycle
========================= */
onMounted(loadArchive);
</script>

<template>
  <PageHeader title="Documents archives" icon="bookshelf" />

  <!-- =========================
      STICKY STACK (Filters)
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
        <h2>Filters</h2>
      </header>

      <div v-if="filtersOpen" class="filters-body">

        <!-- Folder Chips -->
        <div class="filter-row with-label">
          <span class="filter-label">Folder</span>

          <button
            class="chip"
            :class="{ active: selectedFolder === null }"
            @click="selectedFolder = null"
          >
            All
          </button>

          <button
            v-for="f in folders"
            :key="f"
            class="chip"
            :class="{ active: selectedFolder === f }"
            @click="selectedFolder = f"
          >
            {{ f }}
          </button>
        </div>

        <!-- DTA Filter -->
        <div class="filter-row with-label">
          <span class="filter-label">DTA</span>

          <button
            class="chip"
            :class="{ active: !withDTAOnly }"
            @click="withDTAOnly = false"
          >
            All
          </button>

          <button
            class="chip"
            :class="{ active: withDTAOnly }"
            @click="withDTAOnly = true"
          >
            With DTA
          </button>
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

  <!-- =========================
      CONTENT
  ========================= -->
  <div class="archives-view">

    <div v-if="loading" class="muted">
      Loading…
    </div>

    <div v-else-if="error" class="error">
      {{ error }}
    </div>

    <table
      v-else
      class="archive-table"
    >
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

/* =========================================================
   STICKY STACK
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
.filters {
  font-size: var(--font-size-sm);
  background: var(--bg);
}

.filters-header {
  padding: 0.5rem 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filters-header h2 {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-soft);
}

.clickable {
  cursor: pointer;
}

.arrow {
  font-size: 0.75rem;
  opacity: 0.6;
}

.filters-body {
  padding: 8px 12px 12px 12px;
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
  width: 80px;
  font-size: 0.85rem;
  font-weight: 500;
  opacity: 0.8;
}

/* Chips */
.chip {
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: var(--font-size-xs);
  font-weight: 600;
  opacity: 0.7;
  cursor: pointer;
}

.chip.active {
  opacity: 1;
  background: var(--primary-soft);
  border-color: var(--primary);
}

/* Search input */
.filter-row input {
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-soft);
  color: var(--text);
  font-size: 0.85rem;
}

/* =========================================================
   SEPARATOR & COUNTER
========================================================= */
.archive-separator {
  height: 1px;
  background: var(--border);
}

.archive-counter {
  padding: 6px 12px;
  font-size: 0.8rem;
  opacity: 0.6;
}

/* =========================================================
   TABLE
========================================================= */
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

.archive-table th {
  text-align: left;
  font-weight: 600;
}

.amount {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.dta-badge {
  padding: 2px 6px;
  border-radius: 6px;
  background: var(--primary-soft);
  font-size: 0.75rem;
}

.muted {
  opacity: 0.6;
}

.error {
  color: var(--danger);
}
</style>