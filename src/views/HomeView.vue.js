import { computed } from "vue";
import { useTheme } from "@/composables/useTheme";
import { googleAuthenticated } from "@/services/google/googleInit";
import AppTitle from "@/components/AppTitle.vue";
import AppIcon from "@/components/AppIcon.vue";
// version app (injectée par Vite)
const appVersion = __APP_VERSION__;
/* =========================
   Theme
========================= */
const { toggle, theme } = useTheme();
/* =========================
   Drive status
========================= */
const driveStatus = computed(() => googleAuthenticated.value ? "connected" : "disconnected");
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['drive-status']} */ ;
/** @type {__VLS_StyleScopedClasses['drive-status']} */ ;
/** @type {__VLS_StyleScopedClasses['dot']} */ ;
/** @type {__VLS_StyleScopedClasses['drive-status']} */ ;
/** @type {__VLS_StyleScopedClasses['dot']} */ ;
/** @type {__VLS_StyleScopedClasses['drive-status']} */ ;
/** @type {__VLS_StyleScopedClasses['disconnected']} */ ;
/** @type {__VLS_StyleScopedClasses['app-title']} */ ;
/** @type {__VLS_StyleScopedClasses['theme-toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['menu']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-item']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-item']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-item']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "homepage" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "home-header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "title-block" },
});
/** @type {[typeof AppTitle, ]} */ ;
// @ts-ignore
const __VLS_0 = __VLS_asFunctionalComponent(AppTitle, new AppTitle({
    text: "Welcome",
    icon: "home",
    iconSize: (64),
}));
const __VLS_1 = __VLS_0({
    text: "Welcome",
    icon: "home",
    iconSize: (64),
}, ...__VLS_functionalComponentArgsRest(__VLS_0));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "drive-status" },
    ...{ class: (__VLS_ctx.driveStatus) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "dot" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "status-text" },
});
(__VLS_ctx.driveStatus === "connected"
    ? "Home tools ready"
    : "Home tools not available, please login");
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.toggle) },
    ...{ class: "theme-toggle" },
    title: "Toggle theme",
});
/** @type {[typeof AppIcon, ]} */ ;
// @ts-ignore
const __VLS_3 = __VLS_asFunctionalComponent(AppIcon, new AppIcon({
    name: (__VLS_ctx.theme === 'dark' ? 'sun' : 'moon'),
    size: (24),
}));
const __VLS_4 = __VLS_3({
    name: (__VLS_ctx.theme === 'dark' ? 'sun' : 'moon'),
    size: (24),
}, ...__VLS_functionalComponentArgsRest(__VLS_3));
__VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({
    ...{ class: "menu" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
const __VLS_6 = {}.RouterLink;
/** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
// @ts-ignore
const __VLS_7 = __VLS_asFunctionalComponent(__VLS_6, new __VLS_6({
    to: "/authentication",
    ...{ class: "menu-item" },
}));
const __VLS_8 = __VLS_7({
    to: "/authentication",
    ...{ class: "menu-item" },
}, ...__VLS_functionalComponentArgsRest(__VLS_7));
__VLS_9.slots.default;
/** @type {[typeof AppIcon, ]} */ ;
// @ts-ignore
const __VLS_10 = __VLS_asFunctionalComponent(AppIcon, new AppIcon({
    name: "lock",
    size: (32),
}));
const __VLS_11 = __VLS_10({
    name: "lock",
    size: (32),
}, ...__VLS_functionalComponentArgsRest(__VLS_10));
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
var __VLS_9;
__VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
const __VLS_13 = {}.RouterLink;
/** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
// @ts-ignore
const __VLS_14 = __VLS_asFunctionalComponent(__VLS_13, new __VLS_13({
    to: "/spending",
    ...{ class: "menu-item" },
}));
const __VLS_15 = __VLS_14({
    to: "/spending",
    ...{ class: "menu-item" },
}, ...__VLS_functionalComponentArgsRest(__VLS_14));
__VLS_16.slots.default;
/** @type {[typeof AppIcon, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(AppIcon, new AppIcon({
    name: "shopping_cart",
    size: (32),
}));
const __VLS_18 = __VLS_17({
    name: "shopping_cart",
    size: (32),
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
var __VLS_16;
__VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
const __VLS_20 = {}.RouterLink;
/** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    to: "/follow-up",
    ...{ class: "menu-item" },
}));
const __VLS_22 = __VLS_21({
    to: "/follow-up",
    ...{ class: "menu-item" },
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
__VLS_23.slots.default;
/** @type {[typeof AppIcon, ]} */ ;
// @ts-ignore
const __VLS_24 = __VLS_asFunctionalComponent(AppIcon, new AppIcon({
    name: "equalizer",
    size: (32),
}));
const __VLS_25 = __VLS_24({
    name: "equalizer",
    size: (32),
}, ...__VLS_functionalComponentArgsRest(__VLS_24));
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
var __VLS_23;
__VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
const __VLS_27 = {}.RouterLink;
/** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
// @ts-ignore
const __VLS_28 = __VLS_asFunctionalComponent(__VLS_27, new __VLS_27({
    to: "/documentsArchive",
    ...{ class: "menu-item" },
}));
const __VLS_29 = __VLS_28({
    to: "/documentsArchive",
    ...{ class: "menu-item" },
}, ...__VLS_functionalComponentArgsRest(__VLS_28));
__VLS_30.slots.default;
/** @type {[typeof AppIcon, ]} */ ;
// @ts-ignore
const __VLS_31 = __VLS_asFunctionalComponent(AppIcon, new AppIcon({
    name: "folder",
    size: (32),
}));
const __VLS_32 = __VLS_31({
    name: "folder",
    size: (32),
}, ...__VLS_functionalComponentArgsRest(__VLS_31));
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
var __VLS_30;
__VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
const __VLS_34 = {}.RouterLink;
/** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
// @ts-ignore
const __VLS_35 = __VLS_asFunctionalComponent(__VLS_34, new __VLS_34({
    to: "/events",
    ...{ class: "menu-item dev" },
}));
const __VLS_36 = __VLS_35({
    to: "/events",
    ...{ class: "menu-item dev" },
}, ...__VLS_functionalComponentArgsRest(__VLS_35));
__VLS_37.slots.default;
/** @type {[typeof AppIcon, ]} */ ;
// @ts-ignore
const __VLS_38 = __VLS_asFunctionalComponent(AppIcon, new AppIcon({
    name: "rss",
    size: (32),
}));
const __VLS_39 = __VLS_38({
    name: "rss",
    size: (32),
}, ...__VLS_functionalComponentArgsRest(__VLS_38));
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
var __VLS_37;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "app-version" },
});
(__VLS_ctx.appVersion);
/** @type {__VLS_StyleScopedClasses['homepage']} */ ;
/** @type {__VLS_StyleScopedClasses['home-header']} */ ;
/** @type {__VLS_StyleScopedClasses['title-block']} */ ;
/** @type {__VLS_StyleScopedClasses['drive-status']} */ ;
/** @type {__VLS_StyleScopedClasses['dot']} */ ;
/** @type {__VLS_StyleScopedClasses['status-text']} */ ;
/** @type {__VLS_StyleScopedClasses['theme-toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['menu']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-item']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-item']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-item']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-item']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-item']} */ ;
/** @type {__VLS_StyleScopedClasses['dev']} */ ;
/** @type {__VLS_StyleScopedClasses['app-version']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            AppTitle: AppTitle,
            AppIcon: AppIcon,
            appVersion: appVersion,
            toggle: toggle,
            theme: theme,
            driveStatus: driveStatus,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
