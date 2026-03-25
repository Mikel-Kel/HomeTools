<script setup lang="ts">
import { computed, ref } from "vue"
import { formatDate } from "@/utils/dateFormat"

const model = defineModel<string | null>()

const props = defineProps<{
  placeholder?: string
}>()

const displayDate = computed(() => {
  if (!model.value) return props.placeholder ?? "Select date"
  return formatDate(model.value, "compact")
})

const inputRef = ref<HTMLInputElement | null>(null);

function openPicker() {
  const el = inputRef.value;
  if (!el) return;
  try {
    if (typeof el.showPicker === "function") {
      el.showPicker();
    } else {
      el.focus();
      el.click();
    }
  } catch {
    el.focus();
  }
}
</script>

<template>
  <div class="date-wrapper" @click="openPicker">
    <span class="date-chip">
      {{ displayDate }}
    </span>

    <input
      ref="inputRef"
      type="date"
      v-model="model"
      class="hidden-date-input"
    />
  </div>
</template>

<style scoped>
.date-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.date-chip {
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: var(--font-size-xs);
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.hidden-date-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  width: 0;
  height: 0;
  cursor: none;
}
</style>