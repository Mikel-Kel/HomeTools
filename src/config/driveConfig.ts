/* =========================
   Drive root
========================= */
export const HOMETOOLS_ROOT_NAME = "HomeTools";

/* =========================
   Canonical drive structure
   Single source of truth
========================= */
export const DRIVE_STRUCTURE = {
  spending: null,
  events: {
    processed: null,
  },
  logs: null,
  settings: null,
  archive: null,

  allocations: {
    budget: null,
    drafts: null,
    released: null,
  },
} as const;


/* =========================
   Types derived from structure
========================= */
type FolderNode = {
  [key: string]: FolderNode | null;
};

export type HomeToolsDriveStructure = typeof DRIVE_STRUCTURE;

/* -------- Paths (string paths) -------- */
export type HomeToolsFolderPaths<
  T extends FolderNode,
  Prefix extends string = ""
> = {
  [K in keyof T]:
    T[K] extends null
      ? `${Prefix}${Extract<K, string>}`
      : T[K] extends FolderNode
        ? HomeToolsFolderPaths<T[K], `${Prefix}${Extract<K, string>}/`>
        : never;
};

/* -------- IDs (same structure, string leaves) -------- */
export type HomeToolsFolderIds<T extends FolderNode> = {
  [K in keyof T]:
    T[K] extends null
      ? string
      : T[K] extends FolderNode
        ? HomeToolsFolderIds<T[K]>
        : never;
};

/* =========================
   Builders
========================= */
function buildPaths<T extends Record<string, any>>(
  structure: T,
  prefix = ""
): any {
  const result: any = {}

  for (const key in structure) {
    const value = structure[key]
    const path = prefix ? `${prefix}/${key}` : key

    if (value === null) {
      result[key] = path
    } else {
      result[key] = buildPaths(value, path)
    }
  }

  return result
}

/* =========================
   Local filesystem mapping
========================= */
export const LOCAL_FOLDERS = buildPaths(DRIVE_STRUCTURE)

/* =========================
   Drive logical paths
========================= */
export const DRIVE_PATHS = buildPaths(DRIVE_STRUCTURE)