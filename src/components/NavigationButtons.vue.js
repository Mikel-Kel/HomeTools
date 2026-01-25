import { useRouter, useRoute } from "vue-router";
import AppIcon from "@/components/AppIcon.vue";
const router = useRouter();
const route = useRoute();
const props = defineProps();
function goBack() {
    if (props.disabled)
        return;
    router.back();
}
function goHome() {
    if (props.disabled)
        return;
    router.push("/");
}
const level = route.meta.level ?? 0;
const showBack = level >= 2;
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['nav-btn']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "nav-buttons" },
});
if (__VLS_ctx.showBack) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.goBack) },
        ...{ class: "nav-btn" },
        disabled: (__VLS_ctx.disabled),
        title: "Back",
    });
    /** @type {[typeof AppIcon, ]} */ ;
    // @ts-ignore
    const __VLS_0 = __VLS_asFunctionalComponent(AppIcon, new AppIcon({
        name: "back",
        size: (32),
    }));
    const __VLS_1 = __VLS_0({
        name: "back",
        size: (32),
    }, ...__VLS_functionalComponentArgsRest(__VLS_0));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.goHome) },
    ...{ class: "nav-btn" },
    title: "Home",
    disabled: (__VLS_ctx.disabled),
});
/** @type {[typeof AppIcon, ]} */ ;
// @ts-ignore
const __VLS_3 = __VLS_asFunctionalComponent(AppIcon, new AppIcon({
    name: "home",
    size: (32),
}));
const __VLS_4 = __VLS_3({
    name: "home",
    size: (32),
}, ...__VLS_functionalComponentArgsRest(__VLS_3));
/** @type {__VLS_StyleScopedClasses['nav-buttons']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-btn']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            AppIcon: AppIcon,
            goBack: goBack,
            goHome: goHome,
            showBack: showBack,
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
