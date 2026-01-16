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
/** @type {[typeof NavigationButtons, ]} */ ;
// @ts-ignore
const __VLS_3 = __VLS_asFunctionalComponent(NavigationButtons, new NavigationButtons({}));
const __VLS_4 = __VLS_3({}, ...__VLS_functionalComponentArgsRest(__VLS_3));
/** @type {__VLS_StyleScopedClasses['page-header']} */ ;
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
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
