<script setup lang="ts">
import PageHeader from "@/components/PageHeader.vue";
</script>

<template>
  <PageHeader title="Event Log" icon="pages_warning" />

  <div class="event-log-view">
    <div class="wip-box">
      <div class="wip-title">Work in progress</div>
      <div class="wip-text">
        The event log is not available yet.<br />
        This feature will be enabled in a future release.
      </div>
    </div>
  </div>
</template>

<style scoped>
.event-log-view {
  padding: 1.5rem;
  background: var(--bg);
  color: var(--text);

  display: flex;
  justify-content: center;
  align-items: center;
}

/* Carte centrale */
.wip-box {
  max-width: 380px;
  padding: 1.25rem 1.5rem;

  border-radius: 14px;
  background: var(--primary-soft);
  border: 1px solid var(--border);

  text-align: center;
}

/* Titre */
.wip-title {
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  color: var(--primary);
}

/* Texte */
.wip-text {
  font-size: 0.85rem;
  opacity: 0.8;
  line-height: 1.4;
}
</style>