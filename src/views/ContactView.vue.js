import PageHeader from "@/components/PageHeader.vue";
import axios from "axios";
import { ref, onMounted } from "vue";
const contacts = ref([]);
const newContact = ref({ name: "", email: "" });
const fetchContacts = async () => {
    try {
        const { data } = await axios.get("http://localhost:3000/api/contacts");
        contacts.value = data;
    }
    catch (error) {
        console.error("Error fetching contacts:", error);
    }
};
const addContact = async () => {
    try {
        const { data } = await axios.post("http://localhost:3000/api/contacts", newContact.value);
        contacts.value.push(data);
        newContact.value = { name: "", email: "" };
    }
    catch (error) {
        console.error("Error adding contact:", error);
    }
};
onMounted(fetchContacts);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
/** @type {[typeof PageHeader, ]} */ ;
// @ts-ignore
const __VLS_0 = __VLS_asFunctionalComponent(PageHeader, new PageHeader({
    title: "Contact",
    icon: "users",
}));
const __VLS_1 = __VLS_0({
    title: "Contact",
    icon: "users",
}, ...__VLS_functionalComponentArgsRest(__VLS_0));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "contact-view" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({});
for (const [contact] of __VLS_getVForSourceType((__VLS_ctx.contacts))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
        key: (contact.id),
    });
    (contact.name);
    (contact.email);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
    ...{ onSubmit: (__VLS_ctx.addContact) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    value: (__VLS_ctx.newContact.name),
    type: "text",
    placeholder: "Name",
    required: true,
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "email",
    placeholder: "Email",
    required: true,
});
(__VLS_ctx.newContact.email);
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    type: "submit",
});
/** @type {__VLS_StyleScopedClasses['contact-view']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            PageHeader: PageHeader,
            contacts: contacts,
            newContact: newContact,
            addContact: addContact,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
