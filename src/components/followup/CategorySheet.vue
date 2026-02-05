<script setup lang="ts">
import { computed } from "vue";

interface Category {
  id: string;
  label: string;
}

const props = defineProps<{
  open: boolean;
  categories: Category[];
  modelValue: string; // "*" ou CategoryID
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: string): void;
  (e: "close"): void;
}>();

function select(id: string) {
  emit("update:modelValue", id);
  emit("close");
}
</script>

<template>
  <div v-if="open" class="sheet-overlay" @click.self="emit('close')">
    <div class="sheet">

      <div class="sheet-handle" />

      <div class="sheet-title">
        Select category
      </div>

      <div class="sheet-list">
        <!-- All categories -->
        <button
          class="sheet-item"
          :class="{ active: modelValue === '*' }"
          @click="select('*')"
        >
          All categories
        </button>

        <!-- Categories -->
        <button
          v-for="c in categories"
          :key="c.id"
          class="sheet-item"
          :class="{ active: modelValue === c.id }"
          @click="select(c.id)"
        >
          {{ c.label }}
        </button>
      </div>

      <button class="sheet-cancel" @click="emit('close')">
        Cancel
      </button>
    </div>
  </div>
</template>

<style scoped>
.sheet-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 1000;

  display: flex;
  justify-content: center;
  align-items: flex-end;
}

.sheet {
  width: 100%;
  max-width: 520px;
  background: var(--surface);
  border-radius: 16px 16px 0 0;
  padding: 0.75rem 0.75rem 1rem;
}

/* poignée iOS */
.sheet-handle {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: var(--border);
  margin: 0 auto 0.5rem;
}

.sheet-title {
  text-align: center;
  font-weight: 700;
  margin-bottom: 0.75rem;
}

.sheet-list {
  display: flex;
  flex-direction: column;
}

.sheet-item {
  padding: 0.75rem;
  border-radius: 10px;
  text-align: left;
  font-size: 1rem;
  background: none;
  border: none;
}

.sheet-item.active {
  background: var(--primary-soft);
  font-weight: 700;
}

.sheet-item + .sheet-item {
  margin-top: 0.25rem;
}

.sheet-cancel {
  margin-top: 0.75rem;
  padding: 0.75rem;
  border-radius: 12px;
  background: var(--surface-soft);
  border: none;
  font-weight: 600;
}
</style>