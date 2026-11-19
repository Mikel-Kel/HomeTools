<script setup lang="ts">
import { formatDate } from "@/utils/dateFormat";
import { formatAmount } from "@/utils/amountFormat";

import { useDocumentTags } from "@/composables/archives/useDocumentTags";
import { useTagTooltip } from "@/composables/archives/useTagTooltip";

import type { ArchiveItem } from "@/contracts/archive";

/* =========================
   Tableau des documents d'archives

   Une ligne par document : bouton de classement, date,
   partie, Info1, Info2 et pastilles des tags ; colonnes
   date de paiement et montant pour les factures (bills).
   Texte recherché surligné.

   Émet :
   - open : clic sur la ligne (ouverture du document) ;
   - classify : clic sur 📂 (fiche de classement).
========================= */

const props = defineProps<{
  items: ArchiveItem[];
  bills: boolean;
  searchText: string;
  partyLabel: (partyID: number) => string;
}>();

const emit = defineEmits<{
  open: [item: ArchiveItem];
  classify: [item: ArchiveItem];
}>();

const tagsStore =
  useDocumentTags();

const {
  showTagTooltip,
  hideTagTooltip,
} = useTagTooltip();

function tagColor(
  tagID: number
): string | undefined {
  return tagsStore.tags.value.find(
    tag => tag.id === tagID
  )?.color;
}

function escapeRegExp(
  value: string
): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

/* Texte avec la recherche entourée de <mark>. */
function highlight(
  text:
    | string
    | null
    | undefined
): string {
  if (!text) {
    return "";
  }

  const query =
    props.searchText.trim();

  if (!query) {
    return text;
  }

  const regex =
    new RegExp(
      `(${escapeRegExp(query)})`,
      "gi"
    );

  return text.replace(
    regex,
    "<mark>$1</mark>"
  );
}
</script>

<template>
  <table
    class="archive-table"
  >
    <colgroup>
      <col
        class="col-action"
        style="width: 35px"
      >

      <col
        class="col-date"
        style="width: 110px"
      >

      <col class="col-party">
      <col class="col-info1">
      <col class="col-info2">

      <col
        v-if="bills"
        class="col-dta"
        style="width: 125px"
      >

      <col
        v-if="bills"
        class="col-amount"
      >
    </colgroup>

    <thead>
      <tr>
        <th class="col-action"></th>
        <th class="col-date">Date</th>
        <th class="col-party">Party</th>
        <th class="col-info1">Info1</th>
        <th class="col-info2">Info2</th>

        <th
          v-if="bills"
          class="col-dta"
        >
          DTA
        </th>

        <th
          v-if="bills"
          class="col-amount"
        >
          Amount
        </th>
      </tr>
    </thead>

    <tbody>
      <tr
        v-for="
          item
          in items
        "
        :key="item.tocid"
        class="clickable-row"
        @click="emit('open', item)"
      >
        <td class="col-action">
          <button
            type="button"
            class="classify-btn"
            @click.stop="emit('classify', item)"
          >
            📂
          </button>
        </td>

        <td class="col-date">
          {{
            formatDate(
              item.documentDate,
              "text"
            )
          }}
        </td>

        <td
          class="col-party"
          v-html="
            highlight(
              partyLabel(
                item.partyID
              )
            )
          "
        ></td>

        <td
          class="col-info1"
          v-html="
            highlight(
              item.info1
            )
          "
        ></td>

        <td class="col-info2">
          <div class="info2-cell">
            <span
              class="info2-text"
              v-html="
                highlight(
                  item.info2
                )
              "
            ></span>

            <span
              v-if="
                item.tagIDs?.length
              "
              class="tag-squares"
            >
              <span
                v-for="
                  tagID
                  in item.tagIDs
                "
                :key="tagID"
                class="tag-square"
                :style="{
                  backgroundColor:
                    tagColor(tagID) ??
                    '#ccc'
                }"
                @mouseenter="
                  showTagTooltip(
                    $event,
                    tagID
                  )
                "
                @mouseleave="
                  hideTagTooltip
                "
              ></span>
            </span>
          </div>
        </td>

        <td
          v-if="bills"
          class="col-dta"
        >
          <span
            v-if="
              item.indicatorDTA ===
              1
            "
            class="dta-badge"
          >
            {{
              formatDate(
                item.dtaDate,
                "text"
              )
            }}
          </span>
        </td>

        <td
          v-if="bills"
          class="col-amount"
        >
          {{
            formatAmount(
              item.refAmount
            )
          }}
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
/* =========================================================
   TABLE
========================================================= */

.archive-table {
  width:
    100%;

  table-layout:
    fixed;

  font-size:
    0.85rem;
}

.archive-table col.col-party {
  width:
    auto;
}

.archive-table col.col-info1 {
  width:
    auto;
}

.archive-table col.col-info2 {
  width:
    auto;
}

.archive-table col.col-dta {
  width:
    100px;
}

.archive-table col.col-amount {
  width:
    120px;
}

/* En-tête collé en haut de la zone qui défile (archives-table-wrapper). */
.archive-table thead th {
  position:
    sticky;

  top:
    0;

  z-index:
    50;

  border-bottom:
    1px solid
    var(--border);

  font-weight:
    700;

  background:
    color-mix(
      in srgb,
      var(--bg) 96%,
      transparent
    );
}

.archive-table th,
.archive-table td {
  padding:
    0.5rem 0.6rem;

  border-bottom:
    1px solid
    var(--border);

  vertical-align:
    middle;

  white-space:
    nowrap;

  overflow:
    hidden;

  text-overflow:
    ellipsis;
}

.archive-table th.col-date,
.archive-table td.col-date,
.archive-table th.col-dta,
.archive-table td.col-dta {
  text-align:
    center;
}

.archive-table th.col-party,
.archive-table td.col-party,
.archive-table th.col-info1,
.archive-table td.col-info1,
.archive-table th.col-info2,
.archive-table td.col-info2 {
  text-align:
    left;
}

.archive-table th.col-amount,
.archive-table td.col-amount {
  text-align:
    right;

  font-variant-numeric:
    tabular-nums;
}

/* =========================================================
   ROWS
========================================================= */

.clickable-row {
  cursor:
    pointer;

  transition:
    background 0.15s ease;
}

.clickable-row:hover {
  background:
    var(--primary-soft);
}

/* =========================================================
   CELLS
========================================================= */

.col-action {
  width:
    30px;

  text-align:
    center;
}

.classify-btn {
  border:
    none;

  background:
    transparent;

  cursor:
    pointer;

  font-size:
    16px;

  opacity:
    0.7;
}

.classify-btn:hover {
  opacity:
    1;
}

.dta-badge {
  padding:
    2px 6px;

  border-radius:
    6px;

  background:
    var(--primary-soft);

  color:
    var(--primary);

  font-size:
    0.75rem;
}

/* =========================================================
   TAGS
========================================================= */

.info2-cell {
  display:
    flex;

  align-items:
    center;

  justify-content:
    space-between;

  gap:
    8px;
}

.info2-text {
  min-width:
    0;

  flex:
    1 1 auto;
}

.tag-squares {
  flex:
    0 0 auto;

  display:
    inline-flex;

  align-items:
    center;

  gap:
    4px;
}

.tag-square {
  width:
    11px;

  height:
    11px;

  border-radius:
    2px;

  border:
    1px solid
    var(--border);

  box-shadow:
    inset 0 0 0 1px
    rgba(255, 255, 255, 0.1);

  cursor:
    pointer;
}

/* Recherche surlignée (contenu v-html : hors portée du style scoped sans :deep). */
.archive-table :deep(mark) {
  background:
    var(--primary-soft);

  color:
    var(--primary);

  padding:
    0 2px;

  border-radius:
    3px;
}
</style>
