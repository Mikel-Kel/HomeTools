<script setup lang="ts">
import {
  computed,
  ref,
} from "vue";

/* =========================
   Saisie libre avec suggestions

   Remplace <datalist>, qui ne propose que les valeurs
   contenant le texte déjà saisi : un champ rempli ne
   montrerait que sa propre valeur.
   - au focus : toutes les suggestions (la valeur déjà
     présente ne filtre pas : elle peut ne plus convenir,
     ex. la région après un changement de pays) ;
   - pendant la frappe : celles qui contiennent le texte
     (casse et accents ignorés), toutes s'il est vide ou égal
     à une suggestion.
   Clavier : ↑ ↓ pour choisir, Entrée pour reprendre, Échap
   pour fermer la liste (sans fermer la fiche qui contient
   le champ).
========================= */

const props = defineProps<{
  modelValue: string;
  suggestions: string[];
  maxlength?: number;
  placeholder?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

/* Suggestions affichées au plus (liste défilante). */
const MAX_SUGGESTIONS = 50;

function fold(
  text: string
): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

const open =
  ref(false);

const highlighted =
  ref(-1);

/* Texte tapé depuis le focus : la liste est filtrée. */
const typing =
  ref(false);

const filtered =
  computed(() => {
    const text =
      fold(props.modelValue);

    const exact =
      props.suggestions.some(value => fold(value) === text);

    return (
      !typing.value || !text || exact
        ? props.suggestions
        : props.suggestions.filter(value => fold(value).includes(text))
    ).slice(0, MAX_SUGGESTIONS);
  });

function show() {
  open.value = true;
  highlighted.value = -1;
}

function onFocus() {
  typing.value = false;

  show();
}

function hide() {
  open.value = false;
  highlighted.value = -1;
}

function onInput(
  event: Event
) {
  emit(
    "update:modelValue",
    (event.target as HTMLInputElement).value
  );

  typing.value = true;

  show();
}

function pick(
  value: string
) {
  emit("update:modelValue", value);

  typing.value = false;

  hide();
}

function onKeydown(
  event: KeyboardEvent
) {
  const count =
    filtered.value.length;

  switch (event.key) {
    case "ArrowDown":
      event.preventDefault();

      if (!open.value) {
        show();
      }

      highlighted.value =
        count ? (highlighted.value + 1) % count : -1;
      break;

    case "ArrowUp":
      event.preventDefault();

      highlighted.value =
        count ? (highlighted.value - 1 + count) % count : -1;
      break;

    case "Enter":
      if (open.value && highlighted.value >= 0) {
        event.preventDefault();
        pick(filtered.value[highlighted.value]);
      }
      break;

    case "Escape":
      if (open.value) {
        event.stopPropagation();
        hide();
      }
      break;
  }
}
</script>

<template>
  <span class="suggest">
    <input
      :value="modelValue"
      type="text"
      :maxlength="maxlength"
      :placeholder="placeholder"
      autocomplete="off"
      spellcheck="false"
      role="combobox"
      :aria-expanded="open && filtered.length > 0"
      @input="onInput"
      @focus="onFocus"
      @blur="hide"
      @keydown="onKeydown"
    />

    <ul
      v-if="open && filtered.length"
      class="suggestions"
      role="listbox"
    >
      <li
        v-for="(value, index) in filtered"
        :key="value"
        role="option"
        :aria-selected="index === highlighted"
        :class="{ highlighted: index === highlighted }"
        @mousedown.prevent="pick(value)"
      >
        {{ value }}
      </li>
    </ul>
  </span>
</template>

<style scoped>
.suggest {
  position: relative;

  display: block;
}

.suggest input {
  box-sizing: border-box;
  width: 100%;
}

.suggestions {
  position: absolute;
  top: calc(100% + 2px);
  left: 0;
  right: 0;
  z-index: 10;

  max-height: 220px;
  overflow-y: auto;

  margin: 0;
  padding: 4px 0;

  border: 1px solid var(--border);
  border-radius: 8px;

  background: var(--surface);
  box-shadow: var(--shadow-lg);

  list-style: none;
}

.suggestions li {
  padding: 6px 10px;

  font-size: var(--font-size-sm);

  cursor: pointer;
}

.suggestions li:hover,
.suggestions li.highlighted {
  background: var(--primary-soft);
}
</style>
