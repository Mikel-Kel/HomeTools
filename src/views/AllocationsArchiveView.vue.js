import { ref, computed, watch } from "vue";
import PageHeader from "@/components/PageHeader.vue";
import { onMounted } from "vue";
import { listFilesInFolder } from "@/services/google/googleDrive";
import { loadJSONFromFolder } from "@/services/google/driveRepository";
import { useDrive } from "@/composables/useDrive";
import { useCategories } from "@/composables/useCategories";
import { useBanks } from "@/composables/useBanks";
/* =========================
   State
========================= */
const records = ref([]);
const { driveState } = useDrive();
const categoriesStore = useCategories();
const banksStore = useBanks();
/* =========================
   Filters
========================= */
const filtersOpen = ref(false);
const dateFrom = ref("");
const dateTo = ref("");
const minAmount = ref(null);
const maxAmount = ref(null);
const bankFilter = ref(new Set());
const categoryFilter = ref(new Set());
const subCategoryFilter = ref(new Set());
/* =========================
   Chips sources
========================= */
// Banks (depuis banksStore)
const availableBanks = computed(() => banksStore.banks.value
    .map(b => ({
    id: b.bankID,
    label: b.label,
}))
    .sort((a, b) => a.label.localeCompare(b.label)));
// Categories (depuis categoriesStore)
const availableCategories = computed(() => categoriesStore.categories.value
    .map(c => ({
    id: c.id,
    label: c.label,
    subcategories: c.subcategories,
}))
    .sort((a, b) => a.label.localeCompare(b.label)));
// SubCategories dépendantes des catégories sélectionnées
const availableSubCategories = computed(() => {
    // aucune catégorie sélectionnée → aucune sous-cat affichée
    if (!categoryFilter.value.size)
        return [];
    return categoriesStore.categories.value
        .filter(c => categoryFilter.value.has(c.id))
        .flatMap(c => c.subcategories.map(sc => ({
        id: sc.id,
        label: sc.label,
        categoryID: c.id,
    })))
        .sort((a, b) => a.label.localeCompare(b.label));
});
/* =========================
  Helpers
========================= */
function toggleSet(set, value) {
    set.has(value) ? set.delete(value) : set.add(value);
}
function resolveBank(spendingId) {
    const bankID = spendingId.slice(0, 3);
    return banksStore.banks.value.find(b => b.bankID === bankID) ?? null;
}
function resolveCategory(categoryID) {
    return categoriesStore.categories.value.find(c => c.id === categoryID) ?? null;
}
function resolveSubCategory(categoryID, subCategoryID) {
    if (subCategoryID === null)
        return null;
    const cat = resolveCategory(categoryID);
    return cat?.subcategories.find(sc => sc.id === subCategoryID) ?? null;
}
function applyFilters(list) {
    return list.filter(r => {
        if (dateFrom.value && r.allocationDate < dateFrom.value)
            return false;
        if (dateTo.value && r.allocationDate > dateTo.value)
            return false;
        const abs = Math.abs(r.amount);
        if (minAmount.value !== null && abs < minAmount.value)
            return false;
        if (maxAmount.value !== null && abs > maxAmount.value)
            return false;
        if (bankFilter.value.size &&
            !bankFilter.value.has(r.bankID))
            return false;
        if (categoryFilter.value.size &&
            !categoryFilter.value.has(r.categoryID))
            return false;
        if (subCategoryFilter.value.size &&
            r.subCategoryID !== null &&
            !subCategoryFilter.value.has(r.subCategoryID))
            return false;
        return true;
    });
}
/* =========================
   Computed
========================= */
const filteredRecords = computed(() => {
    return applyFilters(records.value)
        .slice() // copie défensive
        .sort((a, b) => {
        // 1️⃣ date décroissante
        if (a.allocationDate !== b.allocationDate) {
            return b.allocationDate.localeCompare(a.allocationDate);
        }
        // 2️⃣ montant décroissant (valeur absolue)
        return Math.abs(b.amount) - Math.abs(a.amount);
    });
});
/* =========================
   Formatting
========================= */
function formatAmount(amount) {
    const sign = amount > 0 ? "+" : "";
    return (sign +
        amount.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }));
}
const formatDate = (d) => new Date(d).toLocaleDateString();
async function loadArchivedAllocations() {
    const folderId = driveState.value.folders.allocations.archived;
    const files = await listFilesInFolder(folderId);
    const out = [];
    for (const f of files) {
        if (!f.name.endsWith(".json"))
            continue;
        const raw = await loadJSONFromFolder(folderId, f.name);
        if (!raw)
            continue;
        const spendingId = raw.spendingId;
        const processedAt = raw.processedAt;
        const bank = resolveBank(spendingId);
        for (const a of raw.allocations ?? []) {
            const category = resolveCategory(a.categoryID);
            const subCategory = resolveSubCategory(a.categoryID, a.subCategoryID);
            out.push({
                spendingId,
                bankID: bank?.bankID ?? "unknown",
                bankLabel: bank?.label ?? "Unknown bank",
                allocationId: a.id,
                allocationDate: a.allocationDate,
                amount: a.amount,
                categoryID: a.categoryID,
                categoryLabel: category?.label ?? "Unknown category",
                subCategoryID: a.subCategoryID,
                subCategoryLabel: subCategory?.label ?? null,
                allocatedTagID: a.allocatedTagID ?? null,
                comment: a.comment ?? "",
                processedAt,
            });
        }
    }
    records.value = out;
}
watch(categoryFilter, () => {
    // ids valides selon catégories actives
    const validSubIds = new Set(availableSubCategories.value.map(sc => sc.id));
    // purge des sous-catégories non pertinentes
    for (const id of subCategoryFilter.value) {
        if (!validSubIds.has(id)) {
            subCategoryFilter.value.delete(id);
        }
    }
});
onMounted(async () => {
    await Promise.all([
        categoriesStore.load?.(),
        banksStore.load?.(),
    ]);
    await loadArchivedAllocations();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['archives-table']} */ ;
/** @type {__VLS_StyleScopedClasses['archives-table']} */ ;
/** @type {__VLS_StyleScopedClasses['archives-table']} */ ;
// CSS variable injection 
// CSS variable injection end 
/** @type {[typeof PageHeader, ]} */ ;
// @ts-ignore
const __VLS_0 = __VLS_asFunctionalComponent(PageHeader, new PageHeader({
    title: "Archives",
    icon: "folder",
}));
const __VLS_1 = __VLS_0({
    title: "Archives",
    icon: "folder",
}, ...__VLS_functionalComponentArgsRest(__VLS_0));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "archives-scroll" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "filters" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.header, __VLS_intrinsicElements.header)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.filtersOpen = !__VLS_ctx.filtersOpen;
        } },
    ...{ class: "filters-header clickable" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "arrow" },
});
(__VLS_ctx.filtersOpen ? "▼" : "►");
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
if (__VLS_ctx.filtersOpen) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "filters-body" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "filter-row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "date",
    });
    (__VLS_ctx.dateFrom);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "date",
    });
    (__VLS_ctx.dateTo);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "filter-row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "number",
        placeholder: "Min",
    });
    (__VLS_ctx.minAmount);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "number",
        placeholder: "Max",
    });
    (__VLS_ctx.maxAmount);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "filter-row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "label" },
    });
    for (const [b] of __VLS_getVForSourceType((__VLS_ctx.availableBanks))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.filtersOpen))
                        return;
                    __VLS_ctx.toggleSet(__VLS_ctx.bankFilter, b.id);
                } },
            key: (b.id),
            ...{ class: "chip" },
            ...{ class: ({ active: __VLS_ctx.bankFilter.has(b.id) }) },
        });
        (b.label);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "filter-row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "label" },
    });
    for (const [c] of __VLS_getVForSourceType((__VLS_ctx.availableCategories))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.filtersOpen))
                        return;
                    __VLS_ctx.toggleSet(__VLS_ctx.categoryFilter, c.id);
                } },
            key: (c.id),
            ...{ class: "chip" },
            ...{ class: ({ active: __VLS_ctx.categoryFilter.has(c.id) }) },
        });
        (c.label);
    }
    if (__VLS_ctx.availableSubCategories.length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "filter-row" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "label" },
        });
        for (const [sc] of __VLS_getVForSourceType((__VLS_ctx.availableSubCategories))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.filtersOpen))
                            return;
                        if (!(__VLS_ctx.availableSubCategories.length))
                            return;
                        __VLS_ctx.toggleSet(__VLS_ctx.subCategoryFilter, sc.id);
                    } },
                key: (sc.id),
                ...{ class: "chip" },
                ...{ class: ({ active: __VLS_ctx.subCategoryFilter.has(sc.id) }) },
            });
            (sc.label);
        }
    }
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)({
    ...{ class: "archives-table" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ class: "right" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
for (const [r] of __VLS_getVForSourceType((__VLS_ctx.filteredRecords))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
        key: (r.allocationId),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (__VLS_ctx.formatDate(r.allocationDate));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (r.bankLabel);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (r.categoryLabel);
    if (r.subCategoryLabel) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (r.subCategoryLabel);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "comment" },
    });
    (r.comment || "(no comment)");
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "right" },
    });
    (__VLS_ctx.formatAmount(r.amount));
}
/** @type {__VLS_StyleScopedClasses['archives-scroll']} */ ;
/** @type {__VLS_StyleScopedClasses['filters']} */ ;
/** @type {__VLS_StyleScopedClasses['filters-header']} */ ;
/** @type {__VLS_StyleScopedClasses['clickable']} */ ;
/** @type {__VLS_StyleScopedClasses['arrow']} */ ;
/** @type {__VLS_StyleScopedClasses['filters-body']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-row']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-row']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-row']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['chip']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-row']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['chip']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-row']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['chip']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['archives-table']} */ ;
/** @type {__VLS_StyleScopedClasses['right']} */ ;
/** @type {__VLS_StyleScopedClasses['comment']} */ ;
/** @type {__VLS_StyleScopedClasses['right']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            PageHeader: PageHeader,
            filtersOpen: filtersOpen,
            dateFrom: dateFrom,
            dateTo: dateTo,
            minAmount: minAmount,
            maxAmount: maxAmount,
            bankFilter: bankFilter,
            categoryFilter: categoryFilter,
            subCategoryFilter: subCategoryFilter,
            availableBanks: availableBanks,
            availableCategories: availableCategories,
            availableSubCategories: availableSubCategories,
            toggleSet: toggleSet,
            filteredRecords: filteredRecords,
            formatAmount: formatAmount,
            formatDate: formatDate,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
