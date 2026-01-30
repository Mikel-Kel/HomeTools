<script setup lang="ts">
import PageHeader from "@/components/PageHeader.vue";
</script>

<template>
  <PageHeader title="Documents archives" icon="folder" />

  <div class="archives-view">
    <div class="wip-box">
      <div class="wip-title">Work in progress</div>
      <div class="wip-text">
        This section is not available yet.<br />
        It will be implemented in a future release.
      </div>
    </div>
  </div>
</template>

<style scoped>
.archives-view {
  padding: 1.5rem;
  background: var(--bg);
  color: var(--text);

  display: flex;
  justify-content: center;
  align-items: center;
}

.wip-box {
  max-width: 360px;
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
</style>