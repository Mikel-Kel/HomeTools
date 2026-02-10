/* =========================
   Drive root
========================= */
export const HOMETOOLS_ROOT_NAME = "HomeTools";

/* =========================
   Drive folders structure
========================= */
export const DRIVE_FOLDERS = {
  spending: "spending",
  events: "events",
  logs: "logs",
  settings: "settings",

  allocations: {
    budget: "budget",
    drafts: "drafts",
    released: "released",
    archived: "archived",
  },
} as const;