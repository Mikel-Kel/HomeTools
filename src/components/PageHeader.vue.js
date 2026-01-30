import AppTitle from "@/components/AppTitle.vue";
import NavigationButtons from "@/components/NavigationButtons.vue";
const __VLS_props = defineProps();
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['page-header']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.header, __VLS_intrinsicElements.header)({
    ...{ class: "page-header" },
});
/** @type {[typeof AppTitle, ]} */ ;
// @ts-ignore
const __VLS_0 = __VLS_asFunctionalComponent(AppTitle, new AppTitle({
    text: (__VLS_ctx.title),
    icon: (__VLS_ctx.icon),
}));
const __VLS_1 = __VLS_0({
    text: (__VLS_ctx.title),
    icon: (__VLS_ctx.icon),
}, ...__VLS_functionalComponentArgsRest(__VLS_0));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "header-right" },
});
var __VLS_3 = {};
/** @type {[typeof NavigationButtons, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(NavigationButtons, new NavigationButtons({
    disabled: (__VLS_ctx.disabled),
}));
const __VLS_6 = __VLS_5({
    disabled: (__VLS_ctx.disabled),
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
/** @type {__VLS_StyleScopedClasses['page-header']} */ ;
/** @type {__VLS_StyleScopedClasses['header-right']} */ ;
// @ts-ignore
var __VLS_4 = __VLS_3;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            AppTitle: AppTitle,
            NavigationButtons: NavigationButtons,
        };
    },
    __typeProps: {},
});
const __VLS_component = (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeProps: {},
});
export default {};
; /* PartiallyEnd: #4569/main.vue */
