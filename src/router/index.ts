import { createRouter, createWebHashHistory } from "vue-router";

import { getLocalDirectory } from "@/services/local/localDirectory";
import { detectStorageBackend } from "@/utils/storageBackend";

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
      path: "/select-folder",
      name: "selectFolder",
      component: AuthenticationView,
      meta: {
        level: 1,
        title: "Select Folder",
      },
    },
    {
      path: "/",
      name: "home",
      component: HomeView,
      meta: {
        level: 0,
        title: "Home",
      },
    },
    {
      path: "/authentication",
      name: "authentication",
      component: AuthenticationView,
      meta: {
        level: 1,
        title: "Authentication",
      },
    },
    {
      path: "/spending",
      name: "spending",
      component: SpendingView,
      meta: {
        level: 1,
        title: "Spending",
        requiresDrive: true,
      },
    },
    {
      path: "/allocation/:id",
      name: "allocation",
      component: AllocationView,
      props: true,
      meta: {
        level: 2,
        title: "Allocation",
        requiresDrive: true,
      },
    },
    {
      path: "/follow-up",
      name: "followup",
      component: FollowUpView,
      meta: {
        level: 1,
        title: "Follow-up",
        requiresDrive: true,
      },
    },
    {
      path: "/documentsArchive",
      name: "documentsArchive",
      component: DocumentsArchiveView,
      meta: {
        level: 1,
        title: "Documents Archives",
        requiresDrive: true,
      },
    },
    {
      path: "/events",
      name: "events",
      component: EventLogView,
      meta: {
        level: 1,
        title: "Events",
        requiresDrive: true,
      },
    },
  ],
});

/* =========================
   BEFORE — Access control
========================= */

router.beforeEach(async (to, _from, next) => {
  document.title =
    (to.meta?.title as string) ??
    "HomeTools";

  const backend =
    detectStorageBackend();

  const requiresStorage =
    to.meta?.requiresDrive === true;

  /* =========================
     Public routes
  ========================= */

  if (!requiresStorage) {
    return next();
  }

  /* =========================
     LOCAL DRIVE MODE
  ========================= */

  if (backend === "LOCAL_DRIVE") {
    const folder =
      getLocalDirectory();

    if (!folder) {
      if (to.name === "selectFolder") {
        return next();
      }

      return next({
        name: "selectFolder",
      });
    }

    return next();
  }

  /* =========================
     OBJECT STORAGE MODE
  ========================= */

  if (
    backend ===
    "OBJECT_STORAGE"
  ) {
    /*
      La navigation est autorisée.

      La validité de la configuration S3
      sera contrôlée par l'adaptateur lors
      du premier accès réel.
    */
    return next();
  }

  /* =========================
     GOOGLE DRIVE MODE
  ========================= */

  const drive = useDrive();

  if (
    drive.driveStatus.value ===
      "CONNECTED" &&
    drive.driveState.value
  ) {
    return next();
  }

  if (
    drive.driveStatus.value ===
    "EXPIRED"
  ) {
    return next({
      name: "authentication",
    });
  }

  try {
    await drive.connect();

    if (
      drive.driveStatus.value ===
        "CONNECTED" &&
      drive.driveState.value
    ) {
      return next();
    }

  } catch {
    // La redirection ci-dessous
    // gère le cas d'échec.
  }

  console.warn(
    "🚫 Navigation blocked — Storage backend not ready",
    {
      to: to.fullPath,
      backend,
      driveStatus:
        drive.driveStatus.value,
    }
  );

  return next({
    name: "authentication",
  });
});

/* =========================
   AFTER — Version check
========================= */

router.afterEach(async () => {
  const backend =
    detectStorageBackend();

  /*
    En mode local, ne pas lancer le contrôle
    tant qu'aucun dossier n'a été sélectionné.
  */
  if (
    backend === "LOCAL_DRIVE" &&
    !getLocalDirectory()
  ) {
    return;
  }

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