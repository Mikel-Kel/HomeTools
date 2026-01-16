import { ref } from "vue";
import PageHeader from "@/components/PageHeader.vue";
import { connectGoogle } from "@/services/google/googleInit";
import { listFilesInFolder, readJSON, writeJSON, } from "@/services/google/googleDrive";
/* =========================
   CONFIG
========================= */
// 👉 ID du dossier parent (ex: parent de HomeTools)
const ROOT_FOLDER_ID = "root";
/* =========================
   State
========================= */
const driveConnected = ref(false);
const busy = ref(false);
const error = ref(null);
const currentFolderId = ref(ROOT_FOLDER_ID);
const folderStack = ref([]);
const items = ref([]);
/* =========================
   Test write JSON
========================= */
const testPayload = ref({
    source: "DriveDevView",
    counter: 0,
    timestamp: new Date().toISOString(),
});
const lastWritten = ref(null);
/* =========================
   Helpers
========================= */
function isFolder(item) {
    return item.mimeType === "application/vnd.google-apps.folder";
}
function isJson(item) {
    return item.mimeType === "application/json";
}
/* =========================
   Loaders
========================= */
async function refresh() {
    busy.value = true;
    error.value = null;
    try {
        items.value = await listFilesInFolder(currentFolderId.value);
    }
    catch (e) {
        error.value = e instanceof Error ? e.message : String(e);
        items.value = [];
    }
    finally {
        busy.value = false;
    }
}
/* =========================
   Navigation
========================= */
async function openFolder(item) {
    if (!isFolder(item))
        return;
    folderStack.value.push(currentFolderId.value);
    currentFolderId.value = item.id;
    await refresh();
}
async function goUp() {
    const parent = folderStack.value.pop();
    if (!parent)
        return;
    currentFolderId.value = parent;
    await refresh();
}
/* =========================
   File actions
========================= */
async function openFile(item) {
    console.log("[UI] file clicked:", item.name, item.mimeType);
    if (!isJson(item)) {
        console.warn("[UI] not a JSON file");
        return;
    }
    try {
        const json = await readJSON(item.id);
        console.log("[Drive] readJSON OK", json);
        lastWritten.value = json;
    }
    catch (e) {
        console.error("[Drive] readJSON FAILED", e);
    }
}
/* =========================
   TEST — write JSON
========================= */
async function writeTestJSON() {
    busy.value = true;
    error.value = null;
    try {
        testPayload.value.counter++;
        testPayload.value.timestamp = new Date().toISOString();
        const id = await writeJSON(currentFolderId.value, "drive-test.json", testPayload.value);
        console.log("[TEST] writeJSON OK, id =", id);
        const reread = await readJSON(id);
        console.log("[TEST] readJSON after write =", reread);
        lastWritten.value = reread;
        await refresh(); // pour voir le fichier apparaître
    }
    catch (e) {
        error.value = String(e);
    }
    finally {
        busy.value = false;
    }
}
/* =========================
   Google connect
========================= */
async function connectDrive() {
    busy.value = true;
    error.value = null;
    try {
        await connectGoogle();
        driveConnected.value = true;
        await refresh();
    }
    catch (e) {
        error.value = String(e);
    }
    finally {
        busy.value = false;
    }
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['file-list']} */ ;
/** @type {__VLS_StyleScopedClasses['folder']} */ ;
/** @type {__VLS_StyleScopedClasses['file']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "drive-dev" },
});
/** @type {[typeof PageHeader, ]} */ ;
// @ts-ignore
const __VLS_0 = __VLS_asFunctionalComponent(PageHeader, new PageHeader({
    title: "Drive DevTools",
    icon: "folder",
}));
const __VLS_1 = __VLS_0({
    title: "Drive DevTools",
    icon: "folder",
}, ...__VLS_functionalComponentArgsRest(__VLS_0));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "actions" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.connectDrive) },
    disabled: (__VLS_ctx.busy),
});
(__VLS_ctx.driveConnected ? "Drive Connected" : "Connect Drive");
if (__VLS_ctx.folderStack.length) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.goUp) },
        disabled: (__VLS_ctx.busy),
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.writeTestJSON) },
    disabled: (!__VLS_ctx.driveConnected || __VLS_ctx.busy),
});
if (__VLS_ctx.busy) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
}
if (__VLS_ctx.error) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "error" },
    });
    (__VLS_ctx.error);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({
    ...{ class: "file-list" },
});
for (const [item] of __VLS_getVForSourceType((__VLS_ctx.items))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
        key: (item.id),
    });
    if (__VLS_ctx.isFolder(item)) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.isFolder(item)))
                        return;
                    __VLS_ctx.openFolder(item);
                } },
            ...{ class: "folder" },
        });
        (item.name);
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.isFolder(item)))
                        return;
                    __VLS_ctx.openFile(item);
                } },
            ...{ class: "file" },
        });
        (item.name);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.small, __VLS_intrinsicElements.small)({});
        (item.mimeType);
    }
}
if (__VLS_ctx.lastWritten) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
}
if (__VLS_ctx.lastWritten) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({});
    (JSON.stringify(__VLS_ctx.lastWritten, null, 2));
}
/** @type {__VLS_StyleScopedClasses['drive-dev']} */ ;
/** @type {__VLS_StyleScopedClasses['actions']} */ ;
/** @type {__VLS_StyleScopedClasses['error']} */ ;
/** @type {__VLS_StyleScopedClasses['file-list']} */ ;
/** @type {__VLS_StyleScopedClasses['folder']} */ ;
/** @type {__VLS_StyleScopedClasses['file']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            PageHeader: PageHeader,
            driveConnected: driveConnected,
            busy: busy,
            error: error,
            folderStack: folderStack,
            items: items,
            lastWritten: lastWritten,
            isFolder: isFolder,
            openFolder: openFolder,
            goUp: goUp,
            openFile: openFile,
            writeTestJSON: writeTestJSON,
            connectDrive: connectDrive,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
