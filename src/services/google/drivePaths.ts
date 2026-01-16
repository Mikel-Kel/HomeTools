// src/services/drive/drivePaths.ts

export const HOMETOOLS_ROOT_NAME = "HomeTools";

export const DRIVE_FOLDERS = {
  events: "events",
  logs: "logs",
  settings: "settings",
  spending: "spending",
} as const;

export type DriveFolderKey = keyof typeof DRIVE_FOLDERS;