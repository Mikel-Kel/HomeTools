<script setup lang="ts">
import {
  computed,
  onMounted,
  ref,
} from "vue";

import PageHeader from "@/components/PageHeader.vue";

import {
  loadJSONFromFolder,
} from "@/services/driveAdapter";

import {
  formatDate,
} from "@/utils/dateFormat";

/* =========================
   Data contract

   Published by housekeeping.applescript
   (via publishToObjectStorage.applescript)
   to the "diagnostics" folder.

   Deliberately flat, no subfolder: the Local Drive
   backend resolves names via the File System Access
   API, whose getFileHandle() rejects any "/" in the
   name - it can only walk one directory level at a
   time.

   diagnostics/housekeepingLogIndex.json
     {
       "runs": [
         { "date": "2026-08-27", "summary": "green", "lineCount": 142 },
         ...
       ]
     }

   diagnostics/housekeepingLog-{date}.json
     {
       "date": "2026-08-27",
       "job": "Housekeeping",
       "summary": "green",
       "lines": [
         { "time": "23:10:02", "level": "INFO", "text": "Housekeeping started" },
         ...
       ]
     }

   "summary" tolerates either the red/yellow/green
   wording used by the nightly health check or
   ok/warning/error; both are normalized below.
========================= */

const LOGS_FOLDER = "diagnostics";
const INDEX_FILE = "housekeepingLogIndex.json";

function runFile(date: string): string {
  return `housekeepingLog-${date}.json`;
}

/* =========================
   Types
========================= */

type HealthLevel =
  | "ok"
  | "warning"
  | "error";

type LineLevel =
  | "info"
  | "ok"
  | "warning"
  | "error";

interface RunSummary {
  date: string;
  summary: HealthLevel;
  lineCount: number;
}

interface LogLine {
  time: string | null;
  level: LineLevel;
  text: string;
}

interface Run {
  date: string;
  job: string;
  summary: HealthLevel;
  lines: LogLine[];
}

/* =========================
   Normalization
========================= */

function normalizeHealth(
  value: unknown
): HealthLevel {
  const token =
    String(value ?? "")
      .trim()
      .toLowerCase();

  if (
    token === "red" ||
    token === "error"
  ) {
    return "error";
  }

  if (
    token === "yellow" ||
    token === "warning"
  ) {
    return "warning";
  }

  return "ok";
}

function normalizeLineLevel(
  value: unknown
): LineLevel {
  const token =
    String(value ?? "")
      .trim()
      .toUpperCase();

  switch (token) {
    case "OK":
      return "ok";

    case "WARN":
      return "warning";

    case "ERR":
      return "error";

    default:
      return "info";
  }
}

function normalizeRunSummary(
  raw: any
): RunSummary | null {
  const date =
    typeof raw?.date === "string"
      ? raw.date
      : null;

  if (!date) {
    return null;
  }

  return {
    date,

    summary:
      normalizeHealth(
        raw.summary
      ),

    lineCount:
      Number.isFinite(
        Number(raw.lineCount)
      )
        ? Number(raw.lineCount)
        : 0,
  };
}

function normalizeRun(
  raw: any,
  fallbackDate: string
): Run {
  return {
    date:
      typeof raw?.date === "string"
        ? raw.date
        : fallbackDate,

    job:
      typeof raw?.job === "string"
        ? raw.job
        : "Housekeeping",

    summary:
      normalizeHealth(
        raw?.summary
      ),

    lines:
      (
        Array.isArray(raw?.lines)
          ? raw.lines
          : []
      ).map(
        (line: any): LogLine => ({
          time:
            typeof line?.time === "string"
              ? line.time
              : null,

          level:
            normalizeLineLevel(
              line?.level
            ),

          text:
            String(
              line?.text ?? ""
            ),
        })
      ),
  };
}

/* =========================
   State
========================= */

const availableRuns =
  ref<RunSummary[]>([]);

const selectedDate =
  ref<string | null>(null);

const currentRun =
  ref<Run | null>(null);

const loadingIndex =
  ref(false);

const loadingRun =
  ref(false);

const indexError =
  ref<string | null>(null);

const runError =
  ref<string | null>(null);

const hasRuns = computed(() =>
  availableRuns.value.length > 0
);

/* =========================
   Loading
========================= */

async function loadIndex() {
  loadingIndex.value = true;
  indexError.value = null;

  try {
    const data =
      await loadJSONFromFolder<any>(
        LOGS_FOLDER,
        INDEX_FILE
      );

    const runs =
      (
        data?.runs ?? []
      )
        .map(normalizeRunSummary)
        .filter(
          (
            run: RunSummary | null
          ): run is RunSummary =>
            run !== null
        )
        .sort(
          (a: RunSummary, b: RunSummary) =>
            b.date.localeCompare(a.date)
        );

    availableRuns.value = runs;

    if (runs.length) {
      await selectRun(runs[0].date);
    }

  } catch (err) {
    console.error(
      "Failed to load housekeeping log index:",
      err
    );

    availableRuns.value = [];

    indexError.value =
      err instanceof Error
        ? err.message
        : String(err);

  } finally {
    loadingIndex.value = false;
  }
}

async function selectRun(date: string) {
  selectedDate.value = date;

  loadingRun.value = true;
  runError.value = null;
  currentRun.value = null;

  try {
    const data =
      await loadJSONFromFolder<any>(
        LOGS_FOLDER,
        runFile(date)
      );

    currentRun.value =
      normalizeRun(data, date);

  } catch (err) {
    console.error(
      `Failed to load housekeeping log for ${date}:`,
      err
    );

    runError.value =
      err instanceof Error
        ? err.message
        : String(err);

  } finally {
    loadingRun.value = false;
  }
}

function handleDateChange(
  event: Event
) {
  const date =
    (event.target as HTMLSelectElement)
      .value;

  if (date) {
    selectRun(date);
  }
}

onMounted(async () => {
  await loadIndex();
});

/* =========================
   Formatting
========================= */

function healthLabel(
  level: HealthLevel
): string {
  switch (level) {
    case "ok":
      return "OK";

    case "warning":
      return "Warning";

    case "error":
      return "Error";
  }
}
</script>

<template>
  <PageHeader
    title="Activity logs"
    icon="pages_warning"
  />

  <div class="event-log-view">
    <!-- =========================
         Loading / errors
    ========================== -->

    <div
      v-if="loadingIndex"
      class="state-message"
    >
      Loading logs…
    </div>

    <div
      v-else-if="indexError"
      class="state-message error"
    >
      {{ indexError }}
    </div>

    <!-- =========================
         Empty state
    ========================== -->

    <div
      v-else-if="!hasRuns"
      class="wip-box"
    >
      <div class="wip-title">
        No logs yet
      </div>

      <div class="wip-text">
        No housekeeping run has been
        published yet.<br />
        Check back after the next
        nightly run.
      </div>
    </div>

    <!-- =========================
         Runs
    ========================== -->

    <div v-else class="log-content">
      <div class="log-toolbar">
        <label class="run-selector">
          <span class="run-selector-label">
            Run
          </span>

          <select
            :value="selectedDate"
            @change="handleDateChange"
          >
            <option
              v-for="run in availableRuns"
              :key="run.date"
              :value="run.date"
            >
              {{
                formatDate(
                  run.date,
                  "text"
                )
              }}
              ({{ healthLabel(run.summary) }})
            </option>
          </select>
        </label>

        <div
          v-if="currentRun"
          class="run-health"
          :class="currentRun.summary"
        >
          <span class="status-dot"
            :class="currentRun.summary"
          ></span>

          <span>
            {{ healthLabel(currentRun.summary) }}
          </span>
        </div>
      </div>

      <div
        v-if="loadingRun"
        class="state-message"
      >
        Loading run…
      </div>

      <div
        v-else-if="runError"
        class="state-message error"
      >
        {{ runError }}
      </div>

      <div
        v-else-if="currentRun"
        class="log-lines"
      >
        <div
          v-for="(line, index) in currentRun.lines"
          :key="index"
          class="log-line"
        >
          <span
            class="status-dot"
            :class="line.level"
          ></span>

          <span
            v-if="line.time"
            class="log-time"
          >
            {{ line.time }}
          </span>

          <span class="log-text">
            {{ line.text }}
          </span>
        </div>

        <div
          v-if="!currentRun.lines.length"
          class="state-message"
        >
          This run has no log lines.
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.event-log-view {
  padding: 1rem;
  background: var(--bg);
  color: var(--text);
}

/* =========================================================
   States
========================================================= */

.state-message {
  padding: 0.75rem 1rem;

  border: 1px solid var(--border);
  border-radius: 8px;

  background: var(--surface);
  color: var(--text-soft);
}

.state-message.error {
  color: var(--negative);
}

/* =========================================================
   Empty state
========================================================= */

.wip-box {
  max-width: 380px;
  margin: 2rem auto 0;
  padding: 1.25rem 1.5rem;

  border-radius: 14px;
  background: var(--primary-soft);
  border: 1px solid var(--border);

  text-align: center;
}

.wip-title {
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  color: var(--primary);
}

.wip-text {
  font-size: 0.85rem;
  opacity: 0.8;
  line-height: 1.4;
}

/* =========================================================
   Toolbar
========================================================= */

.log-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;

  margin-bottom: 1rem;
}

.run-selector {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.run-selector-label {
  font-size: var(--font-size-sm);
  color: var(--text-soft);
}

.run-selector select {
  padding: 6px 10px;

  border: 1px solid var(--border);
  border-radius: 8px;

  background: var(--surface);
  color: var(--text);

  font-size: var(--font-size-sm);
}

.run-health {
  display: flex;
  align-items: center;
  gap: 8px;

  font-size: var(--font-size-sm);
  font-weight: 600;
}

.run-health.ok {
  color: var(--positive);
}

.run-health.warning {
  color: var(--warning);
}

.run-health.error {
  color: var(--negative);
}

/* =========================================================
   Log lines
========================================================= */

.log-lines {
  border: 1px solid var(--border);
  border-radius: 10px;

  background: var(--surface);

  max-height: 65vh;
  overflow-y: auto;
}

.log-line {
  display: flex;
  align-items: flex-start;
  gap: 10px;

  padding: 6px 14px;

  border-bottom: 1px solid var(--border);

  font-size: 0.85rem;
  font-family:
    ui-monospace,
    SFMono-Regular,
    Menlo,
    monospace;
}

.log-line:last-child {
  border-bottom: none;
}

.log-time {
  flex-shrink: 0;

  color: var(--text-muted);
}

.log-text {
  color: var(--text);
  white-space: pre-wrap;
  word-break: break-word;
}

/* =========================================================
   Status dot (shared with Home)
========================================================= */

.status-dot {
  flex-shrink: 0;
  margin-top: 5px;

  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot.ok {
  background: var(--positive);
}

.status-dot.warning {
  background: var(--warning);
}

.status-dot.error {
  background: var(--negative);
}

.status-dot.info {
  background: var(--text-muted);
}

/* =========================================================
   Mobile
========================================================= */

@media (max-width: 700px) {
  .log-toolbar {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
