/* =========================
   Types
========================= */
export type HomeToolsDriveState = {
  rootId: string;
  folders: {
    spending: string;
    events: string;
    logs: string;
    settings: string;
    allocations: {
      drafts: string;
      released: string;
    };
  };
};

export const DRIVE_STATE = {
  rootId: "1By3snfPJBczwPnMr1jZ058qVF4StCHmJ",

  folders: {
    spending: "1XjXq3_hezg2Xo-C9_Iw9VfgRwSfCa0Rq",
    events: "1crGDM0o8GuDcrDiZnx5vkDD4WR1vRNJA",
    logs: "1NTj_htHtFJg7cBUrzvAMwRaHhAm6wMnh",
    settings: "1kWn7JZZLOChML2LQQ4agGxN1rJGKrF32",

    allocations: {
      drafts: "1RSA_gZvCxHs1yg4ZTbN0TsGktOyBqZ9J",
      released: "10ti-rPzmoVxfBS0r6UDy6hHrhWz5E---",
    },
  },
};