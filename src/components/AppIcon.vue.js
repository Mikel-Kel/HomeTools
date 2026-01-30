import { ref, watchEffect } from "vue";
const props = withDefaults(defineProps(), {
    size: 32,
});
const src = ref("");
watchEffect(async () => {
    try {
        const mod = await import(`@/assets/icons/png/${props.size}/${props.name}.png`);
        src.value = mod.default;
    }
    catch (e) {
        console.warn(`[AppIcon] icon not found: ${props.name} (${props.size}px)`);
        src.value = "";
    }
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_withDefaultsArg = (function (t) { return t; })({
    size: 32,
});
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
if (__VLS_ctx.src) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
        src: (__VLS_ctx.src),
        width: (__VLS_ctx.size),
        height: (__VLS_ctx.size),
        ...{ class: "png-icon" },
        draggable: "false",
        alt: "",
    });
}
/** @type {__VLS_StyleScopedClasses['png-icon']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            src: src,
        };
    },
    __typeProps: {},
    props: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeProps: {},
    props: {},
});
; /* PartiallyEnd: #4569/main.vue */
