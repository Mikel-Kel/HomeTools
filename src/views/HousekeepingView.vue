<script setup lang="ts">
import { ref } from "vue";

import PageHeader from "@/components/PageHeader.vue";
import HousekeepingRun from "@/components/housekeeping/HousekeepingRun.vue";
import HousekeepingLogs from "@/components/housekeeping/HousekeepingLogs.vue";

/* =========================
   Tabs
========================= */

/*
  Run  : choix des étapes et lancement d’un housekeeping manuel.
  Logs : journaux des exécutions, de nuit comme manuelles.
*/
type HousekeepingTab =
  | "run"
  | "logs";

const activeTab =
  ref<HousekeepingTab>("run");
</script>

<template>
  <PageHeader
    title="Housekeeping"
    icon="pages_warning"
  />

  <div class="housekeeping-view">
    <div class="tabs">
      <button
        type="button"
        class="tab-btn"
        :class="{ active: activeTab === 'run' }"
        @click="activeTab = 'run'"
      >
        Run
      </button>

      <button
        type="button"
        class="tab-btn"
        :class="{ active: activeTab === 'logs' }"
        @click="activeTab = 'logs'"
      >
        Logs
      </button>
    </div>

    <!--
      Les deux onglets restent montés : une demande en cours
      continue d’être suivie pendant la consultation des journaux.
    -->
    <HousekeepingRun v-show="activeTab === 'run'" />

    <HousekeepingLogs v-show="activeTab === 'logs'" />
  </div>
</template>

<style scoped>
.housekeeping-view {
  padding: 1rem;
  background: var(--bg);
  color: var(--text);
}

/*
  Onglets de page : texte souligné sur toute la largeur, pour
  ne pas les confondre avec les boutons arrondis du contenu.
*/
.tabs {
  display: flex;
  gap: 1.5rem;

  margin-bottom: 1.25rem;

  border-bottom: 1px solid var(--border);
}

.tab-btn {
  margin-bottom: -1px;
  padding: 0.5rem 0.25rem;

  border: none;
  border-bottom: 3px solid transparent;

  background: transparent;
  color: var(--text-soft);

  font-size: var(--font-size-md);
  font-weight: 700;

  cursor: pointer;
}

.tab-btn:hover {
  color: var(--text);
}

.tab-btn.active {
  border-bottom-color: var(--primary);
  color: var(--primary);
}
</style>
