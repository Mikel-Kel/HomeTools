import type { HomeToolsFolderIds } from "./driveConfig";
import { DRIVE_STRUCTURE } from "./driveConfig";

/* =========================
   Types
========================= */
export type HomeToolsDriveFolders = HomeToolsFolderIds<typeof DRIVE_STRUCTURE>;

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

    events: {
      processed: "1rj42Dp4XE0ckqPYjzrGpd4Scm69h_YcN",
    },

    logs: "1dz-ro5UYug3CRbtd5UOzshykRtkA0MuE",
    settings: "18pvl799XuGspqwAo8WFGhLS9bLgljpK2",
    archive: "1g8ojw5rmzx7mGrSM9zSyR5wgTMst5t2v",

    allocations: {
      budget: "1Uaedb7UHrO1G6CnrHrSN_1LKzHV3ADh3",
      drafts: "1WheqzXBd47NK9u8xwGlbDQAbBYYtOG08",
      released: "1CqevaUPvOy_evidswrEfgOrNVUZWi2VL",
    },
  },
};
