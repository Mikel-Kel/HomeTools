import { watch, onMounted, computed, ref } from "vue";
import { useRouter } from "vue-router";
import PageHeader from "@/components/PageHeader.vue";
import { listFilesInFolder, readJSON } from "@/services/google/googleDrive";
import { useSpending } from "@/composables/spending/useSpending";
import { useDrive } from "@/composables/useDrive";
import { transformSpendingRaw } from "@/spending/transformSpendingRaw";
/* =========================
   State
========================= */
const router = useRouter();
const spending = useSpending();
const { driveState } = useDrive();
/* =========================
   Filters
========================= */
const filtersOpen = ref(false);
const ownerFilter = ref(new Set());
const dateFrom = ref("");
const dateTo = ref("");
const minAmount = ref(null);
const maxAmount = ref(null);
/* =========================
   Collapse accounts
========================= */
const collapsedAccounts = ref(new Set());
const toggleAccount = (id) => collapsedAccounts.value.has(id)
    ? collapsedAccounts.value.delete(id)
    : collapsedAccounts.value.add(id);
const isCollapsed = (id) => collapsedAccounts.value.has(id);
/* =========================
   Helpers
========================= */
const accounts = computed(() => spending.accounts.value);
const availableOwners = computed(() => {
    const set = new Set();
    spending.records.value.forEach(r => {
        if (r.owner)
            set.add(r.owner);
    });
    return Array.from(set).sort();
});
function toggleOwner(owner) {
    ownerFilter.value.has(owner)
        ? ownerFilter.value.delete(owner)
        : ownerFilter.value.add(owner);
}
const isOwnerActive = (o) => ownerFilter.value.has(o);
function resetFilters() {
    ownerFilter.value.clear();
    dateFrom.value = "";
    dateTo.value = "";
    minAmount.value = null;
    maxAmount.value = null;
}
function applyFilters(records) {
    return records.filter(r => {
        if (ownerFilter.value.size && !ownerFilter.value.has(r.owner))
            return false;
        if (dateFrom.value && r.date < dateFrom.value)
            return false;
        if (dateTo.value && r.date > dateTo.value)
            return false;
        const abs = Math.abs(r.amount);
        if (minAmount.value !== null && abs < minAmount.value)
            return false;
        if (maxAmount.value !== null && abs > maxAmount.value)
            return false;
        return true;
    });
}
function recordsFor(accountId) {
    return applyFilters(spending.getRecordsForAccount(accountId));
}
function totalFor(accountId) {
    return recordsFor(accountId).reduce((s, r) => s + r.amount, 0);
}
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
/* =========================
   Navigation
========================= */
function openAllocation(record) {
    router.push({
        name: "allocation",
        params: { record: JSON.stringify(record) },
    });
}
/* =========================
   Drive loader
========================= */
async function loadFromDrive() {
    if (!driveState.value)
        return;
    const folderId = driveState.value.folders.spending;
    const files = await listFilesInFolder(folderId);
    const file = files.find(f => f.name === "spending.json");
    if (!file)
        return;
    const raw = await readJSON(file.id);
    const { accounts, records } = transformSpendingRaw(raw);
    spending.replaceAll(accounts, records);
}
/* =========================
   Lifecycle
========================= */
onMounted(() => driveState.value && loadFromDrive());
watch(() => driveState.value, s => s && loadFromDrive());
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['chip']} */ ;
/** @type {__VLS_StyleScopedClasses['spending-table']} */ ;
/** @type {__VLS_StyleScopedClasses['spending-table']} */ ;
/** @type {__VLS_StyleScopedClasses['spending-table']} */ ;
/** @type {__VLS_StyleScopedClasses['spending-table']} */ ;
// CSS variable injection 
// CSS variable injection end 
/** @type {[typeof PageHeader, ]} */ ;
// @ts-ignore
const __VLS_0 = __VLS_asFunctionalComponent(PageHeader, new PageHeader({
    title: "Spending",
    icon: "shopping_cart",
}));
const __VLS_1 = __VLS_0({
    title: "Spending",
    icon: "shopping_cart",
}, ...__VLS_functionalComponentArgsRest(__VLS_0));
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "filters" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.header, __VLS_intrinsicElements.header)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.filtersOpen = !__VLS_ctx.filtersOpen;
        } },
    ...{ class: "account-header clickable" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "account-title filters-title" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "arrow" },
});
(__VLS_ctx.filtersOpen ? "▼" : "►");
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
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
    for (const [owner] of __VLS_getVForSourceType((__VLS_ctx.availableOwners))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.filtersOpen))
                        return;
                    __VLS_ctx.toggleOwner(owner);
                } },
            key: (owner),
            ...{ class: "chip" },
            ...{ class: ({ active: __VLS_ctx.isOwnerActive(owner) }) },
        });
        (owner);
    }
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
        min: "0",
        step: "0.01",
        placeholder: "Min",
    });
    (__VLS_ctx.minAmount);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "number",
        min: "0",
        step: "0.01",
        placeholder: "Max",
    });
    (__VLS_ctx.maxAmount);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.resetFilters) },
        ...{ class: "reset" },
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "spending-view" },
});
for (const [account] of __VLS_getVForSourceType((__VLS_ctx.accounts))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        key: (account.id),
        ...{ class: "account" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "account-separator" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.header, __VLS_intrinsicElements.header)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.toggleAccount(account.id);
            } },
        ...{ class: "account-header clickable" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "account-title" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "arrow" },
    });
    (__VLS_ctx.isCollapsed(account.id) ? "►" : "▼");
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    (account.label);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "ops-count" },
    });
    (__VLS_ctx.recordsFor(account.id).length);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "total right" },
        ...{ class: (__VLS_ctx.totalFor(account.id) >= 0 ? 'positive' : 'negative') },
    });
    (__VLS_ctx.formatAmount(__VLS_ctx.totalFor(account.id)));
    if (!__VLS_ctx.isCollapsed(account.id)) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)({
            ...{ class: "spending-table" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
            ...{ class: "right" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
        for (const [record] of __VLS_getVForSourceType((__VLS_ctx.recordsFor(account.id)))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
                ...{ onClick: (...[$event]) => {
                        if (!(!__VLS_ctx.isCollapsed(account.id)))
                            return;
                        __VLS_ctx.openAllocation(record);
                    } },
                key: (record.id),
                ...{ class: "row" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
            (__VLS_ctx.formatDate(record.date));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
            (record.party);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
            (record.owner);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
                ...{ class: "right" },
                ...{ class: (record.amount >= 0 ? 'positive' : 'negative') },
            });
            (__VLS_ctx.formatAmount(record.amount));
        }
    }
}
/** @type {__VLS_StyleScopedClasses['filters']} */ ;
/** @type {__VLS_StyleScopedClasses['account-header']} */ ;
/** @type {__VLS_StyleScopedClasses['clickable']} */ ;
/** @type {__VLS_StyleScopedClasses['account-title']} */ ;
/** @type {__VLS_StyleScopedClasses['filters-title']} */ ;
/** @type {__VLS_StyleScopedClasses['arrow']} */ ;
/** @type {__VLS_StyleScopedClasses['filters-body']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-row']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['chip']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-row']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['filter-row']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['reset']} */ ;
/** @type {__VLS_StyleScopedClasses['spending-view']} */ ;
/** @type {__VLS_StyleScopedClasses['account']} */ ;
/** @type {__VLS_StyleScopedClasses['account-separator']} */ ;
/** @type {__VLS_StyleScopedClasses['account-header']} */ ;
/** @type {__VLS_StyleScopedClasses['clickable']} */ ;
/** @type {__VLS_StyleScopedClasses['account-title']} */ ;
/** @type {__VLS_StyleScopedClasses['arrow']} */ ;
/** @type {__VLS_StyleScopedClasses['ops-count']} */ ;
/** @type {__VLS_StyleScopedClasses['total']} */ ;
/** @type {__VLS_StyleScopedClasses['right']} */ ;
/** @type {__VLS_StyleScopedClasses['spending-table']} */ ;
/** @type {__VLS_StyleScopedClasses['right']} */ ;
/** @type {__VLS_StyleScopedClasses['row']} */ ;
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
            toggleAccount: toggleAccount,
            isCollapsed: isCollapsed,
            accounts: accounts,
            availableOwners: availableOwners,
            toggleOwner: toggleOwner,
            isOwnerActive: isOwnerActive,
            resetFilters: resetFilters,
            recordsFor: recordsFor,
            totalFor: totalFor,
            formatAmount: formatAmount,
            formatDate: formatDate,
            openAllocation: openAllocation,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
