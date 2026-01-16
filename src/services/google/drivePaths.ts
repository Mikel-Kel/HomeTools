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
    root: "allocations",
    drafts: "drafts",
    released: "released",
  },
} as const;