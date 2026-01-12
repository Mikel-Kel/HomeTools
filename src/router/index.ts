import { createRouter, createWebHistory } from "vue-router";

import HomeView from "../views/HomeView.vue";
import AuthenticationView from "../views/AuthenticationView.vue";
import SpendingView from "../views/SpendingView.vue";
import ContactView from "../views/ContactView.vue";
import AllocationView from "../views/AllocationView.vue";
import EventLogView from "../views/devtools/EventLogView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomeView,
      meta: { title: "Home" },
    },
    {
      path: "/authentication",
      name: "authentication",
      component: AuthenticationView,
      meta: { title: "Authentication" },
    },
    {
      path: "/spending",
      name: "spending",
      component: SpendingView,
      meta: { title: "Spending" },
    },
    {
      path: "/contact",
      name: "contact",
      component: ContactView,
      meta: { title: "Contact" },
    },
    {
      path: "/allocation/:record",
      name: "allocation",
      component: AllocationView,
      props: true,
      meta: { title: "Allocation" },
    },
    {
      path: "/events",
      name: "events",
      component: EventLogView,
      meta: { title: "Events" },
    },
  ],
});

router.beforeEach((to, _from, next) => {
  document.title = (to.meta?.title as string) ?? "HomeTools";
  next();
});

export default router;