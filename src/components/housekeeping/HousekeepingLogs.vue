<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  ref,
  watch,
} from "vue";

import ChipSelector from "@/components/ChipSelector.vue";

import {
  loadJSONFromFolder,
} from "@/services/driveAdapter";

import {
  useDriveWatcher,
} from "@/composables/useDriveWatcher";

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
         { "time": "23:10:02", "job": "CLEAN-UP", "level": "INFO", "text": "Housekeeping started" },
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
  job: string;
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

          job:
            typeof line?.job === "string"
              ? line.job.trim()
              : "",

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

    /*
      Lors d’un rechargement, le jour consulté reste
      sélectionné s’il existe encore.
    */
    const date =
      runs.find(
        (run: RunSummary) =>
          run.date ===
          selectedDate.value
      )?.date ??
      runs[0]?.date;

    if (date) {
      await selectRun(date);
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

/*
  L’index est réécrit à la fin de chaque housekeeping, de nuit
  comme manuel : les journaux se mettent à jour d’eux-mêmes.
*/
const indexRemoteState =
  ref<string | null>(null);

/*
  Le premier contrôle du watcher ne fait que mémoriser l’état
  du fichier, déjà chargé à l’ouverture.
*/
let indexStateKnown =
  false;

useDriveWatcher({
  folderId:
    LOGS_FOLDER,

  fileName:
    INDEX_FILE,

  lastKnownState:
    indexRemoteState,

  onChanged:
    async () => {
      if (!indexStateKnown) {
        indexStateKnown =
          true;

        return;
      }

      if (loadingIndex.value) {
        return;
      }

      await loadIndex();
    },
});

/* =========================
   Filters
========================= */

/*
  all      : toutes les lignes ;
  problems : avertissements et erreurs ;
  errors   : erreurs seulement.
*/
type LevelFilter =
  | "all"
  | "problems"
  | "errors";

const levelFilter =
  ref<LevelFilter>("all");

const jobFilter =
  ref<string[]>([]);

const hideRoutine =
  ref(true);

/*
  Lignes de routine, sans intérêt quand tout va bien :
  enchaînement des événements et publications. Les
  succès métier (imports, exports) restent affichés.
*/
const ROUTINE_TEXT_PATTERNS = [
  /process completed$/,
  /^Event import (started|completed)$/,
  /^No event files found$/,
  /^Publication completed\b/,
  /^Archives publication completed$/,
  /^Control event processed\b/,
  /^Pull completed\b/,
];

function isProblem(
  line: LogLine
): boolean {
  return (
    line.level === "warning" ||
    line.level === "error"
  );
}

function isRoutine(
  line: LogLine
): boolean {
  return (
    !isProblem(line) &&
    ROUTINE_TEXT_PATTERNS.some(
      pattern =>
        pattern.test(line.text)
    )
  );
}

const allLines =
  computed(() =>
    currentRun.value?.lines ?? []
  );

/* =========================
   Executions
========================= */

/*
  Une exécution du housekeeping s’étend de sa ligne
  d’ouverture à sa ligne de fin (job CLEAN-UP). Les jobs
  déclenchés par les événements restent dans l’activité
  de la journée, même pendant une exécution.
*/
const RUN_START = {
  night: /^Early morning housekeeping started\b/,
  manual: /^Manual housekeeping started\b/,
};

const RUN_END =
  /^(Daily housekeeping completed|Manual housekeeping completed|Housekeeping completed with errors)\b/;

const RUN_JOB = "CLEAN-UP";

const EVENT_JOBS =
  new Set([
    "EVNT-MGT",
    "S3-PULL",
    "PUSH_ALL",
    "CARD24",
    "BANK-IMP",
    "DWNL-DST",
  ]);

const DAY_ACTIVITY = "day";

interface Execution {
  id: string;
  label: string;
}

const lineExecutions =
  computed(() => {
    const executions: Execution[] = [];
    const lineRunIds: string[] = [];

    let openRunId: string | null = null;

    for (const line of allLines.value) {
      if (line.job === RUN_JOB) {
        const kind =
          RUN_START.night.test(line.text)
            ? "night"
            : RUN_START.manual.test(line.text)
              ? "manual"
              : null;

        if (kind) {
          openRunId =
            `${kind}-${executions.length}`;

          executions.push({
            id: openRunId,
            label:
              `${kind === "night" ? "Night" : "Manual"}` +
              (line.time ? ` ${line.time.slice(0, 5)}` : ""),
          });
        }
      }

      lineRunIds.push(
        openRunId &&
        !EVENT_JOBS.has(line.job)
          ? openRunId
          : DAY_ACTIVITY
      );

      if (
        line.job === RUN_JOB &&
        RUN_END.test(line.text)
      ) {
        openRunId = null;
      }
    }

    return {
      executions,
      lineRunIds,
    };
  });

/*
  all | identifiant d’exécution | day
*/
const runFilter =
  ref<string>("all");

const runItems =
  computed(() => {
    const items =
      lineExecutions.value.executions.map(
        execution => ({
          id: execution.id,
          label: execution.label,
        })
      );

    if (
      lineExecutions.value.lineRunIds.includes(
        DAY_ACTIVITY
      )
    ) {
      items.push({
        id: DAY_ACTIVITY,
        label: "Daytime activity",
      });
    }

    return items;
  });

watch(
  runItems,

  items => {
    if (
      runFilter.value !== "all" &&
      !items.some(
        item =>
          item.id ===
          runFilter.value
      )
    ) {
      runFilter.value = "all";
    }
  }
);

const levelCounts =
  computed(() => ({
    error:
      allLines.value.filter(
        line =>
          line.level === "error"
      ).length,

    warning:
      allLines.value.filter(
        line =>
          line.level === "warning"
      ).length,
  }));

const jobItems =
  computed(() => {
    const counts =
      new Map<string, number>();

    for (const line of allLines.value) {
      if (line.job) {
        counts.set(
          line.job,
          (counts.get(line.job) ?? 0) + 1
        );
      }
    }

    return [...counts.entries()]
      .sort(
        (a, b) =>
          b[1] - a[1] ||
          a[0].localeCompare(b[0])
      )
      .map(
        ([job]) => ({
          id: job,
          label: job,
        })
      );
  });

const visibleLines =
  computed(() => {
    const jobs =
      new Set(jobFilter.value);

    const runIds =
      lineExecutions.value.lineRunIds;

    return allLines.value.filter(
      (line, index) => {
        if (
          runFilter.value !== "all" &&
          runIds[index] !== runFilter.value
        ) {
          return false;
        }

        if (
          levelFilter.value === "errors" &&
          line.level !== "error"
        ) {
          return false;
        }

        if (
          levelFilter.value === "problems" &&
          !isProblem(line)
        ) {
          return false;
        }

        if (
          jobs.size &&
          !jobs.has(line.job)
        ) {
          return false;
        }

        return !(
          hideRoutine.value &&
          isRoutine(line)
        );
      }
    );
  });

const filtersActive =
  computed(() =>
    levelFilter.value !== "all" ||
    runFilter.value !== "all" ||
    jobFilter.value.length > 0 ||
    !hideRoutine.value
  );

function resetFilters() {
  levelFilter.value = "all";
  runFilter.value = "all";
  jobFilter.value = [];
  hideRoutine.value = true;
}

/*
  Un job absent du jour affiché n’est plus proposé : il
  est retiré du filtre.
*/
watch(
  jobItems,

  items => {
    const available =
      new Set(
        items.map(
          item => item.id
        )
      );

    jobFilter.value =
      jobFilter.value.filter(
        job =>
          available.has(job)
      );
  }
);

/* =========================
   Problem navigation
========================= */

const linesContainer =
  ref<HTMLElement | null>(null);

/*
  Positions des problèmes parmi les lignes affichées.
*/
const problemPositions =
  computed(() =>
    visibleLines.value
      .map(
        (line, position) =>
          isProblem(line)
            ? position
            : -1
      )
      .filter(
        position =>
          position >= 0
      )
  );

const currentProblem =
  ref(-1);

watch(
  problemPositions,

  () => {
    currentProblem.value = -1;
  }
);

const activeLinePosition =
  computed(() =>
    currentProblem.value >= 0
      ? problemPositions.value[
          currentProblem.value
        ]
      : -1
  );

async function goToProblem(
  step: 1 | -1
) {
  const count =
    problemPositions.value.length;

  if (!count) {
    return;
  }

  currentProblem.value =
    currentProblem.value < 0
      ? (step === 1 ? 0 : count - 1)
      : (currentProblem.value + step + count) % count;

  await nextTick();

  linesContainer.value
    ?.querySelector(
      `[data-position="${activeLinePosition.value}"]`
    )
    ?.scrollIntoView({
      block: "center",
      behavior: "smooth",
    });
}

/* =========================
   Formatting
========================= */
</script>

<template>
  <div class="housekeeping-logs">
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
            Day
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
            </option>
          </select>
        </label>

        <span
          v-if="currentRun"
          class="level-counts"
        >
          <span
            class="count-badge error"
            :class="{ none: !levelCounts.error }"
          >
            {{ levelCounts.error }} ERR
          </span>

          <span
            class="count-badge warning"
            :class="{ none: !levelCounts.warning }"
          >
            {{ levelCounts.warning }} WARN
          </span>
        </span>
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

      <template v-else-if="currentRun">
        <!-- Filters -->

        <div class="log-filters">
          <div class="filter-row">
            <div class="level-filter">
              <button
                v-for="option in [
                  { id: 'all', label: 'All lines' },
                  { id: 'problems', label: 'Warnings & errors' },
                  { id: 'errors', label: 'Errors only' },
                ]"
                :key="option.id"
                type="button"
                class="filter-btn"
                :class="{ active: levelFilter === option.id }"
                @click="levelFilter = option.id as LevelFilter"
              >
                {{ option.label }}
              </button>
            </div>

            <label class="routine-toggle">
              <input
                v-model="hideRoutine"
                type="checkbox"
              />

              Hide routine lines
            </label>

            <div
              class="problem-nav"
              :class="{ disabled: !problemPositions.length }"
            >
              <button
                type="button"
                class="nav-btn"
                :disabled="!problemPositions.length"
                title="Previous problem"
                @click="goToProblem(-1)"
              >
                ◀
              </button>

              <span class="nav-position">
                {{
                  problemPositions.length
                    ? `${currentProblem >= 0 ? currentProblem + 1 : "–"} / ${problemPositions.length}`
                    : "No problem"
                }}
              </span>

              <button
                type="button"
                class="nav-btn"
                :disabled="!problemPositions.length"
                title="Next problem"
                @click="goToProblem(1)"
              >
                ▶
              </button>
            </div>

            <button
              v-if="filtersActive"
              type="button"
              class="reset-btn"
              @click="resetFilters"
            >
              Reset
            </button>
          </div>

          <ChipSelector
            v-if="runItems.length > 1"
            :model-value="
              runFilter === 'all'
                ? null
                : runFilter
            "
            label="Run"
            :items="runItems"
            :show-all="true"
            :align-with-content="false"
            @update:model-value="
              runFilter = $event ?? 'all'
            "
          />

          <ChipSelector
            v-if="jobItems.length > 1"
            v-model="jobFilter"
            label="Job"
            :items="jobItems"
            :multiple="true"
            :show-all="true"
            :align-with-content="false"
          />
        </div>

        <div
          ref="linesContainer"
          class="log-lines"
        >
          <div
            v-for="(line, position) in visibleLines"
            :key="position"
            :data-position="position"
            class="log-line"
            :class="{ active: position === activeLinePosition }"
          >
            <span
              class="status-dot"
              :class="line.level"
            ></span>

            <span
              v-if="line.job"
              class="log-job"
            >
              {{ line.job }}
            </span>

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
            v-if="!allLines.length"
            class="state-message"
          >
            This run has no log lines.
          </div>

          <div
            v-else-if="!visibleLines.length"
            class="state-message"
          >
            No line matches the filters.
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.housekeeping-logs {
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
  justify-content: flex-start;
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

/* =========================================================
   Log lines
========================================================= */

/* =========================================================
   Filters
========================================================= */

.log-filters {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  margin-bottom: 0.75rem;
}

.filter-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem 1.25rem;
}

.level-filter {
  display: inline-flex;
  gap: 0.25rem;
}

.filter-btn,
.reset-btn {
  padding: 4px 12px;

  border-radius: 999px;
  border: 1px solid var(--border);

  background: var(--surface-soft);
  color: var(--text-soft);

  font-size: var(--font-size-xs);
  font-weight: 600;

  cursor: pointer;
}

.filter-btn.active {
  border-color: var(--primary);

  background: var(--primary-soft);
  color: var(--primary);
}

.reset-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.level-counts {
  display: inline-flex;
  gap: 0.4rem;
}

.count-badge {
  padding: 1px 8px;

  border-radius: 999px;

  font-size: var(--font-size-xs);
  font-weight: 700;
}

.count-badge.error {
  background: color-mix(in srgb, var(--negative) 15%, transparent);
  color: var(--negative);
}

.count-badge.warning {
  background: color-mix(in srgb, var(--warning) 18%, transparent);
  color: var(--warning);
}

.count-badge.none {
  opacity: 0.45;
}

.routine-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;

  font-size: var(--font-size-xs);
  color: var(--text-soft);

  cursor: pointer;
}

.problem-nav {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.problem-nav.disabled {
  opacity: 0.5;
}

.nav-btn {
  width: 28px;
  height: 24px;

  border-radius: 6px;
  border: 1px solid var(--border);

  background: var(--surface);
  color: var(--text-soft);

  font-size: 0.7rem;

  cursor: pointer;
}

.nav-btn:disabled {
  cursor: default;
}

.nav-position {
  min-width: 4.5em;

  font-size: var(--font-size-xs);
  color: var(--text-soft);
  text-align: center;
}

.log-line.active {
  background: var(--primary-soft);
  box-shadow: inset 3px 0 0 var(--primary);
}

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

.log-job {
  flex-shrink: 0;

  /* 8 caractères + letter-spacing + padding horizontal */
  min-width: calc(8ch + 0.16em + 12px);
  padding: 0 6px;
  text-align: center;
  border-radius: 4px;

  background: var(--primary-soft);
  color: var(--primary);

  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
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
