import { createRouter, createWebHashHistory } from "vue-router";

import { getLocalDirectory } from "@/services/local/localDirectory";
import { detectStorageBackend } from "@/utils/storageBackend";
import { whenEnvironmentReady } from "@/services/environment/environmentState";

import { checkAppVersion } from "@/services/version/versionGuard";
import { checkAppStatus } from "@/services/appStatus/appStatusGuard";

import HomeView from "../views/HomeView.vue";
import AuthenticationView from "../views/AuthenticationView.vue";
import SpendingView from "../views/SpendingView.vue";
import AllocationView from "../views/AllocationView.vue";
import FollowUpView from "../views/FollowUpView.vue";
import DocumentsArchiveView from "../views/DocumentsArchiveView.vue";
import HousekeepingView from "../views/HousekeepingView.vue";
import BudgetView from "../views/BudgetView.vue";
import IndicatorsView from "../views/IndicatorsView.vue";
import IndicatorHistoryView from "../views/IndicatorHistoryView.vue";
import MasterDataView from "../views/MasterDataView.vue";

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
        title: "Documents",
        requiresDrive: true,
      },
    },
    {
      path: "/housekeeping",
      name: "housekeeping",
      component: HousekeepingView,
      meta: {
        level: 1,
        title: "Housekeeping",
        requiresDrive: true,
      },
    },
    {
      path: "/budget",
      name: "budget",
      component: BudgetView,
      meta: {
        level: 1,
        title: "Budget",
        requiresDrive: true,
      },
    },
    {
      path: "/indicators",
      name: "indicators",
      component: IndicatorsView,
      meta: {
        level: 1,
        title: "Indicators",
        requiresDrive: true,
      },
    },
    {
      path: "/indicators/history",
      name: "indicatorHistory",
      component: IndicatorHistoryView,
      meta: {
        level: 2,
        title: "Indicator history",
        requiresDrive: true,
      },
    },
    {
      path: "/master-data",
      name: "masterData",
      component: MasterDataView,
      meta: {
        level: 1,
        title: "Master data",
        requiresDrive: true,
      },
    },
    {
      /* Ancienne adresse de la page des journaux. */
      path: "/events",
      redirect: "/housekeeping",
    },
  ],
});

/* =========================
   BEFORE — Access control
========================= */

router.beforeEach(async (to) => {
  document.title =
    (to.meta?.title as string) ??
    "HomeTools";

  /*
    Stockage du navigateur (choix du backend, dossier
    local) lisible seulement une fois l'environnement
    connu : la première navigation l'attend.
  */
  await whenEnvironmentReady();

  const backend =
    detectStorageBackend();

  const requiresStorage =
    to.meta?.requiresDrive === true;

  /* =========================
     Public routes
  ========================= */

  if (!requiresStorage) {
    return true;
  }

  /* =========================
     LOCAL DRIVE MODE
  ========================= */

  if (
    backend === "LOCAL_DRIVE" &&
    !getLocalDirectory() &&
    to.name !== "selectFolder"
  ) {
    return {
      name: "selectFolder",
    };
  }

  /* =========================
     OBJECT STORAGE MODE
  ========================= */

  /*
    La navigation est autorisée.

    La validité de la configuration S3
    sera contrôlée par l'adaptateur lors
    du premier accès réel.
  */
  return true;
});

/* =========================
   AFTER — Disponibilité et version
========================= */

router.afterEach(() => {
  void checkAppStatus();
  void checkAppVersion();
});

export default router;