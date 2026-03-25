<script setup lang="ts">

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

  /* 🔥 FIX → utilise le token global */
  background: var(--overlay);

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

  /* 🔥 petit plus premium */
  box-shadow: var(--shadow-lg);
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
  color: var(--text); /* 🔥 FIX */
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

  background: var(--surface);
  color: var(--text);

  border: 1px solid transparent; /* 🔥 évite jump au hover */
  cursor: pointer;

  transition: all 0.15s ease;
}

/* hover desktop */
.sheet-item:hover {
  background: var(--surface-soft);
}

/* actif */
.sheet-item.active {
  background: var(--primary-soft);
  color: var(--primary);
  font-weight: 700;
  border-color: var(--primary);
}

.sheet-item + .sheet-item {
  margin-top: 0.25rem;
}

/* bouton cancel */
.sheet-cancel {
  margin-top: 0.75rem;
  padding: 0.75rem;
  border-radius: 12px;

  background: var(--surface-soft);
  color: var(--text);

  border: 1px solid var(--border);

  font-weight: 600;
  cursor: pointer;

  transition: all 0.15s ease;
}

.sheet-cancel:hover {
  background: var(--primary-soft);
  color: var(--primary);
  border-color: var(--primary);
}
</style>