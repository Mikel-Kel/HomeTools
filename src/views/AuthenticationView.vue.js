import PageHeader from "@/components/PageHeader.vue";
import { useDrive } from "@/composables/useDrive";
/* =========================
   Drive
========================= */
const { connect, driveReady, driveBusy, driveError, } = useDrive();
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
/** @type {[typeof PageHeader, ]} */ ;
// @ts-ignore
const __VLS_0 = __VLS_asFunctionalComponent(PageHeader, new PageHeader({
    title: "Authentication",
    icon: "lock",
}));
const __VLS_1 = __VLS_0({
    title: "Authentication",
    icon: "lock",
}, ...__VLS_functionalComponentArgsRest(__VLS_0));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "authentication-view" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.connect) },
    disabled: (__VLS_ctx.driveBusy || __VLS_ctx.driveReady),
});
(__VLS_ctx.driveReady ? "Drive connected" : "Connect Google Drive");
if (__VLS_ctx.driveBusy) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
}
if (__VLS_ctx.driveError) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "error" },
    });
    (__VLS_ctx.driveError);
}
/** @type {__VLS_StyleScopedClasses['authentication-view']} */ ;
/** @type {__VLS_StyleScopedClasses['error']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            PageHeader: PageHeader,
            connect: connect,
            driveReady: driveReady,
            driveBusy: driveBusy,
            driveError: driveError,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
