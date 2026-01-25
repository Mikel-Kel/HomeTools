import { onMounted } from "vue";
import { initGoogleAPI, connectGoogle } from "@/services/google/googleInit";
import { log } from "./utils/logger";
async function login() {
    try {
        await connectGoogle();
    }
    catch (e) {
        log.error("[Google login failed]", e);
    }
}
onMounted(async () => {
    try {
        await initGoogleAPI();
    }
    catch (e) {
        log.error("[Google API init failed]", e);
    }
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
const __VLS_0 = {}.RouterView;
/** @type {[typeof __VLS_components.RouterView, typeof __VLS_components.routerView, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_4 = {};
var __VLS_3;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
