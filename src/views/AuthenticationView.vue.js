import { computed } from "vue";
import { useRouter } from "vue-router";
import PageHeader from "@/components/PageHeader.vue";
import { useDrive } from "@/composables/useDrive";
const router = useRouter();
const { connect, driveStatus, driveBusy, driveError, } = useDrive();
/* =========================
   Derived state
========================= */
const isConnected = computed(() => driveStatus.value === "CONNECTED");
/* =========================
   Actions
========================= */
async function handleConnect() {
    try {
        await connect();
        if (driveStatus.value === "CONNECTED") {
            router.push({ name: "home" });
        }
    }
    catch (err) {
        console.error(err);
    }
}
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
    ...{ onClick: (__VLS_ctx.handleConnect) },
    disabled: (__VLS_ctx.driveBusy || __VLS_ctx.isConnected),
});
(__VLS_ctx.isConnected ? "Drive connected" : "Connect Google Drive");
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
            driveBusy: driveBusy,
            driveError: driveError,
            isConnected: isConnected,
            handleConnect: handleConnect,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
