import { createRouter, createWebHashHistory } from "vue-router";
import { useDrive } from "@/composables/useDrive";
import { ensureAppVersionChecked } from "@/services/version/versionGuard";

import HomeView from "../views/HomeView.vue";
import AuthenticationView from "../views/AuthenticationView.vue";
import SpendingView from "../views/SpendingView.vue";
import AllocationView from "../views/AllocationView.vue";
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

/* =========================
   BEFORE — Access control
========================= */
router.beforeEach(async (to, _from, next) => {
  document.title = (to.meta?.title as string) ?? "HomeTools";

  if (!to.meta?.requiresDrive) {
    return next();
  }

  const drive = useDrive();

  // Déjà prêt → OK
  if (drive.driveStatus.value === "CONNECTED" && drive.driveState.value) {
    return next();
  }

  // Tentative de connexion Drive
  if (drive.driveStatus.value === "EXPIRED") {
    return next({ name: "authentication" });
  }
  try {
    await drive.connect();

    if (drive.driveStatus.value === "CONNECTED" && drive.driveState.value) {
      return next();
    }
  } catch {
    // ignore, handled below
  }

  console.warn("🚫 Navigation blocked — Drive not ready", {
    to: to.fullPath,
    status: drive.driveStatus.value,
  });

  return next({ name: "authentication" });
});

/* =========================
   AFTER — Version check
========================= */
router.afterEach(async () => {
  try {
    await ensureAppVersionChecked();
  } catch (err: any) {
    alert(
      "⚠️ Application version inconsistency detected.\n\n" +
      err.message +
      "\n\nPlease refresh your browser and try again."
    );
  }
});

export default router;