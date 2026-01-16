import { ref, computed } from "vue";
import PageHeader from "@/components/PageHeader.vue";
import { useEvents } from "@/composables/useEvents";
import { connectGoogle } from "@/services/google/googleInit";
import { useDriveJsonFile } from "@/composables/useDriveJsonFile";
/* =========================
   CONFIG
========================= */
// 👉 ID réel du dossier /HomeTools/events
const EVENTS_FOLDER_ID = "PUT_EVENTS_FOLDER_ID_HERE";
/* =========================
   Events métier
========================= */
const { events, importJSON, exportJSON, clear, } = useEvents();
/* =========================
   Drive JSON binding
========================= */
const driveFile = useDriveJsonFile(EVENTS_FOLDER_ID, "events.json");
const driveConnected = ref(false);
/* =========================
   UI state (APLATI)
========================= */
const isBusy = computed(() => {
    return driveFile.busy.value;
});
const canUseDrive = computed(() => {
    return driveConnected.value && !isBusy.value;
});
/* =========================
   Actions
========================= */
async function connectDrive() {
    await connectGoogle();
    driveConnected.value = true;
}
async function loadFromDrive() {
    const json = await driveFile.load();
    if (json)
        importJSON(JSON.stringify(json));
}
async function saveToDrive() {
    await driveFile.save(JSON.parse(exportJSON()));
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "event-log" },
});
/** @type {[typeof PageHeader, ]} */ ;
// @ts-ignore
const __VLS_0 = __VLS_asFunctionalComponent(PageHeader, new PageHeader({
    title: "Event Log",
    icon: "rss",
}));
const __VLS_1 = __VLS_0({
    title: "Event Log",
    icon: "rss",
}, ...__VLS_functionalComponentArgsRest(__VLS_0));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "actions" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.connectDrive) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.loadFromDrive) },
    disabled: (!__VLS_ctx.canUseDrive),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.saveToDrive) },
    disabled: (!__VLS_ctx.canUseDrive),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.clear) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({});
(__VLS_ctx.events);
if (__VLS_ctx.driveFile.error) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "error" },
    });
    (__VLS_ctx.driveFile.error);
}
/** @type {__VLS_StyleScopedClasses['event-log']} */ ;
/** @type {__VLS_StyleScopedClasses['actions']} */ ;
/** @type {__VLS_StyleScopedClasses['error']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            PageHeader: PageHeader,
            events: events,
            clear: clear,
            driveFile: driveFile,
            canUseDrive: canUseDrive,
            connectDrive: connectDrive,
            loadFromDrive: loadFromDrive,
            saveToDrive: saveToDrive,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
