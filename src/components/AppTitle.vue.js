import AppIcon from "@/components/AppIcon.vue";
const __VLS_props = withDefaults(defineProps(), {
    iconSize: 24,
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_withDefaultsArg = (function (t) { return t; })({
    iconSize: 24,
});
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.header, __VLS_intrinsicElements.header)({
    ...{ class: "app-title" },
});
if (__VLS_ctx.icon) {
    /** @type {[typeof AppIcon, ]} */ ;
    // @ts-ignore
    const __VLS_0 = __VLS_asFunctionalComponent(AppIcon, new AppIcon({
        name: (__VLS_ctx.icon),
        size: (__VLS_ctx.iconSize),
        ...{ class: "icon" },
    }));
    const __VLS_1 = __VLS_0({
        name: (__VLS_ctx.icon),
        size: (__VLS_ctx.iconSize),
        ...{ class: "icon" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_0));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({});
(__VLS_ctx.text);
/** @type {__VLS_StyleScopedClasses['app-title']} */ ;
/** @type {__VLS_StyleScopedClasses['icon']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            AppIcon: AppIcon,
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
