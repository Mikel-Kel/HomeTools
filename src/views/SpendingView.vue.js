import { onMounted } from "vue";
import { useRouter } from "vue-router";
import PageHeader from "@/components/PageHeader.vue";
import { useSpending } from "@/composables/useSpending";
/* =========================
   State
========================= */
const router = useRouter();
const { accounts, getRecordsForAccount, load } = useSpending();
/* =========================
   Navigation
========================= */
function openAllocation(record) {
    router.push({
        name: "allocation",
        params: {
            record: JSON.stringify(record),
        },
    });
}
/* =========================
   Utils
========================= */
function formatAmount(amount) {
    return amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}
onMounted(load);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['spending-table']} */ ;
/** @type {__VLS_StyleScopedClasses['spending-table']} */ ;
/** @type {__VLS_StyleScopedClasses['clickable']} */ ;
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
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "spending-view" },
});
for (const [account, index] of __VLS_getVForSourceType((__VLS_ctx.accounts))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        key: (account.id),
        ...{ class: "account" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    (account.label);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)({
        ...{ class: "spending-table" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
        ...{ class: "center" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
        ...{ class: "right" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
    for (const [record] of __VLS_getVForSourceType((__VLS_ctx.getRecordsForAccount(index)))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
            ...{ onClick: (...[$event]) => {
                    __VLS_ctx.openAllocation(record);
                } },
            key: (record.id),
            ...{ class: "clickable" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
            ...{ class: "center" },
        });
        (record.date);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
        (record.party);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
            ...{ class: "right" },
            ...{ class: (record.amount >= 0 ? 'positive' : 'negative') },
        });
        (__VLS_ctx.formatAmount(record.amount));
    }
}
/** @type {__VLS_StyleScopedClasses['spending-view']} */ ;
/** @type {__VLS_StyleScopedClasses['account']} */ ;
/** @type {__VLS_StyleScopedClasses['spending-table']} */ ;
/** @type {__VLS_StyleScopedClasses['center']} */ ;
/** @type {__VLS_StyleScopedClasses['right']} */ ;
/** @type {__VLS_StyleScopedClasses['clickable']} */ ;
/** @type {__VLS_StyleScopedClasses['center']} */ ;
/** @type {__VLS_StyleScopedClasses['right']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            PageHeader: PageHeader,
            accounts: accounts,
            getRecordsForAccount: getRecordsForAccount,
            openAllocation: openAllocation,
            formatAmount: formatAmount,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
