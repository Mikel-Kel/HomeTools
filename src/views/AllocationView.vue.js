import { computed, onMounted, nextTick, ref } from "vue";
import { useRouter } from "vue-router";
import PageHeader from "@/components/PageHeader.vue";
import { useAllocation } from "@/composables/allocations/useAllocation";
import { useCategories } from "@/composables/useCategories";
/* =========================
   Router
========================= */
const router = useRouter();
const props = defineProps();
const record = JSON.parse(props.record);
/* =========================
   Categories
========================= */
const categoriesStore = useCategories();
/* =========================
   Allocation logic
========================= */
const { allocations, categoryID, subCategoryID, comment, amount, totalAllocated, remainingAmount, isBalanced, canSaveDraft, canRelease, busy, busyAction, loadDraft, addAllocation, removeAllocation, saveDraft, release, } = useAllocation(String(record.id), record.amount);
/* =========================
   Focus
========================= */
const amountInput = ref(null);
async function resetAmountToRemaining() {
    await nextTick();
    amount.value = Math.abs(remainingAmount.value);
    amountInput.value?.focus();
}
/* =========================
   Lifecycle
========================= */
onMounted(async () => {
    await categoriesStore.load();
    await loadDraft();
    await resetAmountToRemaining();
});
/* =========================
   Computed
========================= */
const absRemainingAmount = computed(() => Math.abs(remainingAmount.value));
/* =========================
   Category filtering by sign
========================= */
const allowedNature = computed(() => record.amount >= 0 ? "I" : "E");
const categories = computed(() => categoriesStore.categories.value.filter(c => c.nature === allowedNature.value));
const subCategories = computed(() => typeof categoryID.value === "number"
    ? categoriesStore.getSubcategories(categoryID.value)
    : []);
/* =========================
   Category helpers
========================= */
function categoryLabel(id) {
    return id == null
        ? ""
        : categoriesStore.getCategory(id)?.label ?? "";
}
function subCategoryLabel(categoryID, subCategoryID) {
    if (categoryID == null || subCategoryID == null)
        return "";
    return (categoriesStore
        .getSubcategories(categoryID)
        .find(sc => sc.id === subCategoryID)?.label ?? "");
}
function formatAmount(a) {
    return a.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}
/* =========================
   Actions
========================= */
async function onAddAllocation() {
    await addAllocation();
    await resetAmountToRemaining();
}
async function onSaveDraft() {
    await saveDraft();
}
async function onRelease() {
    await release();
    router.push({ name: "spending" });
}
async function onRemoveAllocation(index) {
    await removeAllocation(index);
}
function closeView() {
    if (busy.value)
        return;
    router.push({ name: "spending" });
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['amount-box']} */ ;
/** @type {__VLS_StyleScopedClasses['amount-box']} */ ;
/** @type {__VLS_StyleScopedClasses['amount-box']} */ ;
/** @type {__VLS_StyleScopedClasses['remaining']} */ ;
/** @type {__VLS_StyleScopedClasses['allocation-form']} */ ;
/** @type {__VLS_StyleScopedClasses['allocation-form']} */ ;
/** @type {__VLS_StyleScopedClasses['form-row']} */ ;
/** @type {__VLS_StyleScopedClasses['form-row']} */ ;
/** @type {__VLS_StyleScopedClasses['form-row']} */ ;
/** @type {__VLS_StyleScopedClasses['allocation-form']} */ ;
/** @type {__VLS_StyleScopedClasses['allocation-list']} */ ;
/** @type {__VLS_StyleScopedClasses['allocation-list']} */ ;
/** @type {__VLS_StyleScopedClasses['allocation-list']} */ ;
/** @type {__VLS_StyleScopedClasses['allocation-list']} */ ;
/** @type {__VLS_StyleScopedClasses['footer-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['footer-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['allocation-row']} */ ;
/** @type {__VLS_StyleScopedClasses['allocation-action']} */ ;
/** @type {__VLS_StyleScopedClasses['remove']} */ ;
// CSS variable injection 
// CSS variable injection end 
/** @type {[typeof PageHeader, ]} */ ;
// @ts-ignore
const __VLS_0 = __VLS_asFunctionalComponent(PageHeader, new PageHeader({
    title: "Allocation",
    icon: "shopping_cart",
}));
const __VLS_1 = __VLS_0({
    title: "Allocation",
    icon: "shopping_cart",
}, ...__VLS_functionalComponentArgsRest(__VLS_0));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "allocation-view" },
});
if (__VLS_ctx.busy) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "busy-overlay" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "busy-box" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "spinner" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "busy-text" },
    });
    (__VLS_ctx.busyAction === "release"
        ? "Releasing… please wait"
        : "Saving… please wait");
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "allocation-record" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "record-main" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "record-party" },
});
(__VLS_ctx.record.party);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "record-meta" },
});
(__VLS_ctx.record.date);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "record-amounts" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "amount-box total" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "amount-label" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "amount-value" },
});
(__VLS_ctx.formatAmount(Math.abs(__VLS_ctx.record.amount)));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "amount-box remaining" },
    ...{ class: ({ balanced: __VLS_ctx.isBalanced, unbalanced: !__VLS_ctx.isBalanced }) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "amount-label" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "amount-value" },
});
(__VLS_ctx.formatAmount(__VLS_ctx.absRemainingAmount));
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "allocation-form" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "form-row" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
    value: (__VLS_ctx.categoryID),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
    value: (null),
    disabled: true,
});
for (const [c] of __VLS_getVForSourceType((__VLS_ctx.categories))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        key: (c.id),
        value: (c.id),
    });
    (c.label);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
    value: (__VLS_ctx.subCategoryID),
    disabled: (__VLS_ctx.categoryID === null),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
    value: (null),
    disabled: true,
});
for (const [sc] of __VLS_getVForSourceType((__VLS_ctx.subCategories))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        key: (sc.id),
        value: (sc.id),
    });
    (sc.label);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "form-row" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ref: "amountInput",
    type: "number",
    step: "0.01",
});
(__VLS_ctx.amount);
/** @type {typeof __VLS_ctx.amountInput} */ ;
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.onAddAllocation) },
    ...{ class: "primary" },
    disabled: (!__VLS_ctx.categoryID || !__VLS_ctx.subCategoryID || __VLS_ctx.amount === 0),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ class: "comment" },
    placeholder: "(optional comment)",
});
(__VLS_ctx.comment);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "allocation-separator" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "allocation-list" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
for (const [a] of __VLS_getVForSourceType((__VLS_ctx.allocations))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
        key: (a.id),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "alloc-text" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "alloc-comment" },
    });
    (a.comment || "(no comment)");
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "alloc-category" },
    });
    (__VLS_ctx.categoryLabel(a.categoryID));
    if (a.subCategoryID) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.subCategoryLabel(a.categoryID, a.subCategoryID));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "right alloc-amount" },
    });
    (__VLS_ctx.formatAmount(a.amount));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "alloc-action" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.onRemoveAllocation(__VLS_ctx.allocations.indexOf(a));
            } },
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.footer, __VLS_intrinsicElements.footer)({
    ...{ class: "allocation-footer" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "footer-total" },
});
(__VLS_ctx.formatAmount(__VLS_ctx.totalAllocated));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "footer-actions" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.onSaveDraft) },
    disabled: (__VLS_ctx.busy || !__VLS_ctx.canSaveDraft),
});
if (__VLS_ctx.busy && __VLS_ctx.busyAction === 'save') {
}
else if (__VLS_ctx.canRelease) {
}
else {
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.onRelease) },
    disabled: (__VLS_ctx.busy || !__VLS_ctx.canRelease),
});
(__VLS_ctx.busy && __VLS_ctx.busyAction === "release"
    ? "Releasing…"
    : "Release");
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.closeView) },
    ...{ class: "secondary" },
    disabled: (__VLS_ctx.busy),
});
/** @type {__VLS_StyleScopedClasses['allocation-view']} */ ;
/** @type {__VLS_StyleScopedClasses['busy-overlay']} */ ;
/** @type {__VLS_StyleScopedClasses['busy-box']} */ ;
/** @type {__VLS_StyleScopedClasses['spinner']} */ ;
/** @type {__VLS_StyleScopedClasses['busy-text']} */ ;
/** @type {__VLS_StyleScopedClasses['allocation-record']} */ ;
/** @type {__VLS_StyleScopedClasses['record-main']} */ ;
/** @type {__VLS_StyleScopedClasses['record-party']} */ ;
/** @type {__VLS_StyleScopedClasses['record-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['record-amounts']} */ ;
/** @type {__VLS_StyleScopedClasses['amount-box']} */ ;
/** @type {__VLS_StyleScopedClasses['total']} */ ;
/** @type {__VLS_StyleScopedClasses['amount-label']} */ ;
/** @type {__VLS_StyleScopedClasses['amount-value']} */ ;
/** @type {__VLS_StyleScopedClasses['amount-box']} */ ;
/** @type {__VLS_StyleScopedClasses['remaining']} */ ;
/** @type {__VLS_StyleScopedClasses['balanced']} */ ;
/** @type {__VLS_StyleScopedClasses['unbalanced']} */ ;
/** @type {__VLS_StyleScopedClasses['amount-label']} */ ;
/** @type {__VLS_StyleScopedClasses['amount-value']} */ ;
/** @type {__VLS_StyleScopedClasses['allocation-form']} */ ;
/** @type {__VLS_StyleScopedClasses['form-row']} */ ;
/** @type {__VLS_StyleScopedClasses['form-row']} */ ;
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
/** @type {__VLS_StyleScopedClasses['comment']} */ ;
/** @type {__VLS_StyleScopedClasses['allocation-separator']} */ ;
/** @type {__VLS_StyleScopedClasses['allocation-list']} */ ;
/** @type {__VLS_StyleScopedClasses['alloc-text']} */ ;
/** @type {__VLS_StyleScopedClasses['alloc-comment']} */ ;
/** @type {__VLS_StyleScopedClasses['alloc-category']} */ ;
/** @type {__VLS_StyleScopedClasses['right']} */ ;
/** @type {__VLS_StyleScopedClasses['alloc-amount']} */ ;
/** @type {__VLS_StyleScopedClasses['alloc-action']} */ ;
/** @type {__VLS_StyleScopedClasses['allocation-footer']} */ ;
/** @type {__VLS_StyleScopedClasses['footer-total']} */ ;
/** @type {__VLS_StyleScopedClasses['footer-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            PageHeader: PageHeader,
            record: record,
            allocations: allocations,
            categoryID: categoryID,
            subCategoryID: subCategoryID,
            comment: comment,
            amount: amount,
            totalAllocated: totalAllocated,
            isBalanced: isBalanced,
            canSaveDraft: canSaveDraft,
            canRelease: canRelease,
            busy: busy,
            busyAction: busyAction,
            amountInput: amountInput,
            absRemainingAmount: absRemainingAmount,
            categories: categories,
            subCategories: subCategories,
            categoryLabel: categoryLabel,
            subCategoryLabel: subCategoryLabel,
            formatAmount: formatAmount,
            onAddAllocation: onAddAllocation,
            onSaveDraft: onSaveDraft,
            onRelease: onRelease,
            onRemoveAllocation: onRemoveAllocation,
            closeView: closeView,
        };
    },
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
