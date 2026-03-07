/* =========================
   Types
========================= */

export type HomeToolsDriveFolders = {
  spending: string;
  events: string;
  logs: string;
  settings: string;
  archive: string;

  allocations: {
    budget: string;
    drafts: string;
    released: string;
    archived: string;
  };
};

export type HomeToolsDriveState = {
  rootId: string;
  folders: HomeToolsDriveFolders;
};

/* =========================
   Google Drive configuration
========================= */

export const DRIVE_STATE: HomeToolsDriveState = {

  rootId: "1caH2l4FQ8I0cYDPlIUTAeK-2PfJ0vxak",

  folders: {

    spending: "1VSI1rSeZwN-B1Yzh2fi107E5hpBdXbjX",
    events: "1sNbv4M97biaKBGWbYhQHnE490cKqFe30",
    logs: "1dz-ro5UYug3CRbtd5UOzshykRtkA0MuE",
    settings: "18pvl799XuGspqwAo8WFGhLS9bLgljpK2",
    archive: "1g8ojw5rmzx7mGrSM9zSyR5wgTMst5t2v",

    allocations: {
      budget: "1Uaedb7UHrO1G6CnrHrSN_1LKzHV3ADh3",
      drafts: "1WheqzXBd47NK9u8xwGlbDQAbBYYtOG08",
      released: "1CqevaUPvOy_evidswrEfgOrNVUZWi2VL",
      archived: "1o9jPu6CuOKDC0o7RLbmq9Rt6fSBAE8U7",
    },
  },
};

/* =========================
   Local filesystem mapping
========================= */

export const LOCAL_FOLDERS: HomeToolsDriveFolders = {

  spending: "spending",
  events: "events",
  logs: "logs",
  settings: "settings",
  archive: "archive",

  allocations: {
    budget: "allocations/budget",
    drafts: "allocations/drafts",
    released: "allocations/released",
    archived: "allocations/archived",
  },
};