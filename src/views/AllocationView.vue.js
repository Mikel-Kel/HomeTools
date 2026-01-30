import { computed, onMounted, nextTick, ref } from "vue";
import { useRouter } from "vue-router";
import PageHeader from "@/components/PageHeader.vue";
import AppIcon from "@/components/AppIcon.vue";
import { useSpending } from "@/composables/spending/useSpending";
import { useAllocation } from "@/composables/allocations/useAllocation";
import { useCategories } from "@/composables/useCategories";
/* =========================
   Router / Props
========================= */
const router = useRouter();
const props = defineProps();
/* =========================
   Stores
========================= */
const spendingStore = useSpending();
const categoriesStore = useCategories();
/* =========================
   Record (nullable)
========================= */
const record = computed(() => spendingStore.records.value.find(r => r.id === props.id) ?? null);
const recordReady = computed(() => record.value !== null);
/* ✅ Alias NON NULL pour le template */
const recordSafe = computed(() => {
    return record.value ?? {};
});
const allocationSafe = computed(() => {
    return allocation.value ?? {
        loading: ref(true),
        busy: ref(false),
        busyAction: ref(null),
    };
});
/* =========================
   Allocation (créé seulement si record existe)
========================= */
const loading = computed(() => allocationSafe.value.loading.value);
const busy = computed(() => allocationSafe.value.busy.value);
const busyAction = computed(() => allocationSafe.value.busyAction.value);
const allocation = computed(() => record.value
    ? useAllocation(record.value.id, record.value.amount, record.value.partyID, record.value.date)
    : null);
/* =========================
   Exposition SAFE pour le template
========================= */
const allocations = computed(() => allocation.value?.allocations.value ?? []);
const categoryID = computed({
    get: () => allocation.value?.categoryID.value ?? null,
    set: v => allocation.value && (allocation.value.categoryID.value = v),
});
const subCategoryID = computed({
    get: () => allocation.value?.subCategoryID.value ?? null,
    set: v => allocation.value && (allocation.value.subCategoryID.value = v),
});
const comment = computed({
    get: () => allocation.value?.comment.value ?? "",
    set: v => allocation.value && (allocation.value.comment.value = v),
});
const amount = computed({
    get: () => allocation.value?.amount.value ?? 0,
    set: v => allocation.value && (allocation.value.amount.value = v),
});
const amountDisplay = computed({
    get: () => amount.value.toFixed(2),
    set: (v) => {
        const normalized = v.replace(",", ".");
        const n = Number(normalized);
        if (Number.isFinite(n)) {
            amount.value = Number(n.toFixed(2));
        }
    },
});
const allocationDate = computed({
    get: () => allocation.value?.allocationDate?.value ?? null,
    set: v => allocation.value && (allocation.value.allocationDate.value = v),
});
const showAllocationDate = ref(false);
/*const totalAllocated = computed(
  () => allocation.value?.totalAllocated.value ?? 0
);*/
const remainingAmount = computed(() => allocation.value?.remainingAmount.value ?? 0);
const isBalanced = computed(() => allocation.value?.isBalanced.value ?? false);
const canSaveDraft = computed(() => allocation.value?.canSaveDraft.value ?? false);
const canRelease = computed(() => allocation.value?.canRelease.value ?? false);
const busyMessage = computed(() => {
    if (loading.value)
        return "Loading…";
    switch (busyAction.value) {
        case "save":
            return "Saving…";
        case "release":
            return "Releasing…";
        default:
            return "";
    }
});
/* =========================
   Focus
========================= */
const amountInput = ref(null);
async function resetAmountToRemaining() {
    await nextTick();
    amount.value = Math.abs(remainingAmount.value);
    amountInput.value?.focus();
}
const dateInput = ref(null);
/* =========================
   Lifecycle
========================= */
onMounted(async () => {
    await categoriesStore.load();
    if (allocation.value) {
        await allocation.value.loadDraft();
        // ✅ preset (si pas de draft chargé)
        if (allocation.value.allocations.value.length === 0 && record.value) {
            allocation.value.categoryID.value = record.value.categoryID;
            allocation.value.subCategoryID.value = record.value.subCategoryID;
            allocation.value.comment.value = record.value.allocComment ?? "";
            // tagID : pas encore disponible / visible ici, mais utilisé par useAllocation lors de addAllocation()
        }
        await resetAmountToRemaining();
    }
});
/* =========================
   Derived
========================= */
const absRemainingAmount = computed(() => Math.abs(remainingAmount.value));
const allowedNature = computed(() => record.value && record.value.amount >= 0 ? "I" : "E");
const categories = computed(() => categoriesStore.categories.value.filter(c => c.nature === allowedNature.value));
const subCategories = computed(() => typeof categoryID.value === "number"
    ? categoriesStore.getSubcategories(categoryID.value)
    : []);
/* =========================
   Helpers (MANQUANTS AVANT)
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
    if (!allocation.value)
        return;
    await allocation.value.addAllocation();
    showAllocationDate.value = false;
    await resetAmountToRemaining();
}
async function onSaveDraft() {
    await allocation.value?.saveDraft();
}
async function onRelease() {
    await allocation.value?.release();
    router.push({ name: "spending" });
}
async function onRemoveAllocation(index) {
    await allocation.value?.removeAllocation(index);
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
/** @type {__VLS_StyleScopedClasses['icon-button']} */ ;
/** @type {__VLS_StyleScopedClasses['date-button']} */ ;
/** @type {__VLS_StyleScopedClasses['comment-row']} */ ;
/** @type {__VLS_StyleScopedClasses['comment-row']} */ ;
/** @type {__VLS_StyleScopedClasses['field-long']} */ ;
/** @type {__VLS_StyleScopedClasses['allocation-list']} */ ;
/** @type {__VLS_StyleScopedClasses['allocation-list']} */ ;
/** @type {__VLS_StyleScopedClasses['allocation-list']} */ ;
/** @type {__VLS_StyleScopedClasses['allocation-list']} */ ;
/** @type {__VLS_StyleScopedClasses['footer-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['footer-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['allocation-row']} */ ;
/** @type {__VLS_StyleScopedClasses['allocation-action']} */ ;
/** @type {__VLS_StyleScopedClasses['remove']} */ ;
/** @type {__VLS_StyleScopedClasses['alloc-comment']} */ ;
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
if (!__VLS_ctx.recordReady) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "loading" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "allocation-view" },
    });
    if (__VLS_ctx.loading || __VLS_ctx.busy) {
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
        (__VLS_ctx.busyMessage);
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
    (__VLS_ctx.recordSafe.party);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "record-meta" },
    });
    (__VLS_ctx.recordSafe.date);
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
    (__VLS_ctx.formatAmount(Math.abs(__VLS_ctx.recordSafe.amount)));
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
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        value: (__VLS_ctx.categoryID),
        ...{ class: "field field-short" },
        disabled: (__VLS_ctx.allocation?.state.value === 'DRAFTED'
            || __VLS_ctx.allocation?.state.value === 'BUSY'
            || __VLS_ctx.allocation?.state.value === 'READONLY'),
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
        disabled: (__VLS_ctx.categoryID === null
            || __VLS_ctx.allocation?.state.value === 'DRAFTED'
            || __VLS_ctx.allocation?.state.value === 'BUSY'
            || __VLS_ctx.allocation?.state.value === 'READONLY'),
        ...{ class: "field field-short" },
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
        ...{ class: "amount-block" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "amount-row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        ref: "amountInput",
        value: (__VLS_ctx.amountDisplay),
        type: "text",
        inputmode: "decimal",
        ...{ class: "field field-short amount-input" },
        disabled: (__VLS_ctx.allocation?.state.value === 'DRAFTED'
            || __VLS_ctx.allocation?.state.value === 'BUSY'
            || __VLS_ctx.allocation?.state.value === 'READONLY'),
    });
    /** @type {typeof __VLS_ctx.amountInput} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "date-button" },
    });
    /** @type {[typeof AppIcon, ]} */ ;
    // @ts-ignore
    const __VLS_3 = __VLS_asFunctionalComponent(AppIcon, new AppIcon({
        name: "calendar",
        size: (32),
    }));
    const __VLS_4 = __VLS_3({
        name: "calendar",
        size: (32),
    }, ...__VLS_functionalComponentArgsRest(__VLS_3));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        ref: "dateInput",
        type: "date",
        ...{ class: "date-input-overlay" },
        disabled: (__VLS_ctx.allocation?.state.value === 'DRAFTED'
            || __VLS_ctx.allocation?.state.value === 'BUSY'
            || __VLS_ctx.allocation?.state.value === 'READONLY'),
        'aria-label': "Set allocation date",
    });
    (__VLS_ctx.allocationDate);
    /** @type {typeof __VLS_ctx.dateInput} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "comment-row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        ...{ class: "field field-long" },
        placeholder: "(optional comment)",
        disabled: (__VLS_ctx.allocation?.state.value === 'DRAFTED'
            || __VLS_ctx.allocation?.state.value === 'BUSY'
            || __VLS_ctx.allocation?.state.value === 'READONLY'
            || !__VLS_ctx.categoryID
            || !__VLS_ctx.subCategoryID
            || __VLS_ctx.amount === 0),
    });
    (__VLS_ctx.comment);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.onAddAllocation) },
        ...{ class: "theme-toggle" },
        disabled: (__VLS_ctx.allocation?.state.value === 'DRAFTED'
            || __VLS_ctx.allocation?.state.value === 'BUSY'
            || __VLS_ctx.allocation?.state.value === 'READONLY'
            || !__VLS_ctx.categoryID
            || !__VLS_ctx.subCategoryID
            || __VLS_ctx.amount === 0),
        'aria-label': "Add allocation",
    });
    /** @type {[typeof AppIcon, ]} */ ;
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent(AppIcon, new AppIcon({
        name: "add",
        size: (24),
    }));
    const __VLS_7 = __VLS_6({
        name: "add",
        size: (24),
    }, ...__VLS_functionalComponentArgsRest(__VLS_6));
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
            ...{ class: "alloc-comment-row" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "alloc-comment" },
        });
        (a.comment || "(no comment)");
        if (a.allocationDate && a.allocationDate !== __VLS_ctx.recordSafe.date) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "alloc-date-badge" },
                title: (a.allocationDate),
            });
            (a.allocationDate);
        }
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
                    if (!!(!__VLS_ctx.recordReady))
                        return;
                    __VLS_ctx.onRemoveAllocation(__VLS_ctx.allocations.indexOf(a));
                } },
            disabled: (__VLS_ctx.allocation?.state.value === 'BUSY'
                || __VLS_ctx.allocation?.state.value === 'READONLY'),
        });
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.footer, __VLS_intrinsicElements.footer)({
        ...{ class: "allocation-footer" },
    });
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
}
/** @type {__VLS_StyleScopedClasses['loading']} */ ;
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
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['field-short']} */ ;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['field-short']} */ ;
/** @type {__VLS_StyleScopedClasses['amount-block']} */ ;
/** @type {__VLS_StyleScopedClasses['amount-row']} */ ;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['field-short']} */ ;
/** @type {__VLS_StyleScopedClasses['amount-input']} */ ;
/** @type {__VLS_StyleScopedClasses['date-button']} */ ;
/** @type {__VLS_StyleScopedClasses['date-input-overlay']} */ ;
/** @type {__VLS_StyleScopedClasses['comment-row']} */ ;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['field-long']} */ ;
/** @type {__VLS_StyleScopedClasses['theme-toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['allocation-separator']} */ ;
/** @type {__VLS_StyleScopedClasses['allocation-list']} */ ;
/** @type {__VLS_StyleScopedClasses['alloc-text']} */ ;
/** @type {__VLS_StyleScopedClasses['alloc-comment-row']} */ ;
/** @type {__VLS_StyleScopedClasses['alloc-comment']} */ ;
/** @type {__VLS_StyleScopedClasses['alloc-date-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['alloc-category']} */ ;
/** @type {__VLS_StyleScopedClasses['right']} */ ;
/** @type {__VLS_StyleScopedClasses['alloc-amount']} */ ;
/** @type {__VLS_StyleScopedClasses['alloc-action']} */ ;
/** @type {__VLS_StyleScopedClasses['allocation-footer']} */ ;
/** @type {__VLS_StyleScopedClasses['footer-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            PageHeader: PageHeader,
            AppIcon: AppIcon,
            recordReady: recordReady,
            recordSafe: recordSafe,
            loading: loading,
            busy: busy,
            busyAction: busyAction,
            allocation: allocation,
            allocations: allocations,
            categoryID: categoryID,
            subCategoryID: subCategoryID,
            comment: comment,
            amount: amount,
            amountDisplay: amountDisplay,
            allocationDate: allocationDate,
            isBalanced: isBalanced,
            canSaveDraft: canSaveDraft,
            canRelease: canRelease,
            busyMessage: busyMessage,
            amountInput: amountInput,
            dateInput: dateInput,
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
