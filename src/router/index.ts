import { createRouter, createWebHashHistory } from "vue-router";
import { useDrive } from "@/composables/useDrive";

import HomeView from "../views/HomeView.vue";
import AuthenticationView from "../views/AuthenticationView.vue";
import SpendingView from "../views/SpendingView.vue";
import AllocationView from "../views/AllocationView.vue";
import AllocationsArchiveView from "../views/AllocationsArchiveView.vue"; 
import FollowUpView from "../views/FollowUpView.vue"; 
import DocumentsArchiveView from "../views/DocumentsArchiveView.vue";
import EventLogView from "../views/devtools/EventLogView.vue";

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomeView,
      meta: { level: 0, title: "Home" },
    },
    {
      path: "/authentication",
      name: "authentication",
      component: AuthenticationView,
      meta: { level: 1, title: "Authentication" },
    },
    {
      path: "/allocationsArchive",
      name: "allocationsArchive",
      component: AllocationsArchiveView,
      meta: { level: 2, title: "Allocation Archives" },
    },
    {
      path: "/spending",
      name: "spending",
      component: SpendingView,
      meta: { level: 1, title: "Spending", requiresDrive: true },
    },
    {
      path: "/allocation/:id",
      name: "allocation",
      component: AllocationView,
      props: true,
      meta: { level: 2, title: "Allocation", requiresDrive: true },
    },
    {
      path: "/allocationsArchive",
      name: "allocationsArchive",
      component: AllocationsArchiveView,
      meta: { level: 2, title: "Allocation Archives", requiresDrive: true },
    },
    {
      path: "/follow-up",
      name: "followup",
      component: FollowUpView,
      meta: { level: 1, title: "Follow-up", requiresDrive: true },
    },
    {
      path: "/documentsArchive",
      name: "documentsArchive",
      component: DocumentsArchiveView,
      meta: { level: 1, title: "Documents Archives", requiresDrive: true },
    },
    {
      path: "/events",
      name: "events",
      component: EventLogView,
      meta: { level: 1, title: "Events", requiresDrive: true },
    },
  ],
});


router.beforeEach((to, _from, next) => {
  document.title = (to.meta?.title as string) ?? "HomeTools";

  const { driveStatus } = useDrive();

  // 🔒 Route protégée
  if (to.meta?.requiresDrive) {
    if (driveStatus.value !== "CONNECTED") {
      console.warn(
        "🚫 Navigation blocked — Drive not connected",
        {
          to: to.fullPath,
          status: driveStatus.value,
        }
      );

      // 👉 choix UX : retour à l’auth
      return next({ name: "authentication" });
      // ou : next({ name: "home" });
    }
  }

  next();
});

export default router;