/**
 * =========================================================
 * Google Drive low-level API
 * ---------------------------------------------------------
 * Règles STRICTES :
 * 1. Ne JAMAIS appeler Drive si driveStatus !== CONNECTED
 * 2. Un 401 invalide TOUTE la session (expire())
 * 3. AUCUN état local caché
 * 4. Toute erreur Drive remonte (pas swallow)
 * =========================================================
 */

import { getAccessToken } from "./googleInit";
import { useDrive } from "@/composables/useDrive";

const DRIVE_BASE = "https://www.googleapis.com/drive/v3";

/* =========================
   Types
========================= */
export type DriveItem = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
};

/* =========================
   Core fetch helper
========================= */
async function driveFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const { driveStatus, expire } = useDrive();

  if (driveStatus.value !== "CONNECTED") {
    throw new Error("DRIVE_UNAVAILABLE");
  }

  const token = getAccessToken();
  if (!token) {
    expire("Missing access token");
    throw new Error("DRIVE_UNAUTHORIZED");
  }

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    expire("HTTP 401 Unauthorized");
    throw new Error("DRIVE_UNAUTHORIZED");
  }

  return res;
}

/* =========================
   Find subfolder by name
========================= */
export async function findFolderByName(
  parentId: string,
  folderName: string
): Promise<DriveItem | null> {
  const q =
    `'${parentId}' in parents and ` +
    `mimeType='application/vnd.google-apps.folder' and ` +
    `name='${folderName}' and trashed=false`;

  const url =
    `${DRIVE_BASE}/files` +
    `?q=${encodeURIComponent(q)}` +
    `&spaces=drive` +
    `&includeItemsFromAllDrives=true` +
    `&supportsAllDrives=true` +
    `&fields=files(id,name,mimeType)`;

  const res = await driveFetch(url);
  if (!res.ok) {
    throw new Error(`[Drive] findFolderByName HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.files?.[0] ?? null;
}

/* =========================
   List files in folder
========================= */
export async function listFilesInFolder(
  folderId: string
): Promise<DriveItem[]> {
  const q = `'${folderId}' in parents and trashed=false`;

  const url =
    `${DRIVE_BASE}/files` +
    `?q=${encodeURIComponent(q)}` +
    `&spaces=drive` +
    `&includeItemsFromAllDrives=true` +
    `&supportsAllDrives=true` +
    `&fields=files(id,name,mimeType,modifiedTime)`;

  const res = await driveFetch(url);
  if (!res.ok) {
    throw new Error(`[Drive] listFiles HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.files ?? [];
}

/* =========================
   Read JSON file
========================= */
export async function readJSON<T = any>(
  fileId: string
): Promise<T> {
  const res = await driveFetch(
    `${DRIVE_BASE}/files/${fileId}?alt=media`
  );

  if (!res.ok) {
    throw new Error(`[Drive] readJSON HTTP ${res.status}`);
  }

  return res.json();
}

/* =========================
   Write JSON file (create / update)
========================= */
export async function writeJSON(
  folderId: string,
  filename: string,
  data: any,
  existingFileId?: string
): Promise<string> {
  const { driveStatus } = useDrive();
  if (driveStatus.value !== "CONNECTED") {
    throw new Error("DRIVE_UNAVAILABLE");
  }

  const token = getAccessToken();
  if (!token) {
    throw new Error("DRIVE_UNAUTHORIZED");
  }

  const metadata = {
    name: filename,
    parents: existingFileId ? undefined : [folderId],
  };

  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], {
      type: "application/json",
    })
  );
  form.append(
    "file",
    new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    })
  );

  const url = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart&supportsAllDrives=true`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true`;

  const res = await fetch(url, {
    method: existingFileId ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  if (res.status === 401) {
    const { expire } = useDrive();
    expire("HTTP 401 during writeJSON");
    throw new Error("DRIVE_UNAUTHORIZED");
  }

  if (!res.ok) {
    throw new Error(`[Drive] writeJSON HTTP ${res.status}`);
  }

  const result = await res.json();
  return result.id;
}

/* =========================
   Delete file
========================= */
export async function deleteFile(fileId: string): Promise<void> {
  const { driveStatus, expire } = useDrive();

  if (driveStatus.value !== "CONNECTED") {
    throw new Error("DRIVE_UNAVAILABLE");
  }

  const token = getAccessToken();
  if (!token) {
    expire("Missing token during delete");
    throw new Error("DRIVE_UNAUTHORIZED");
  }

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (res.status === 401) {
    expire("HTTP 401 during delete");
    throw new Error("DRIVE_UNAUTHORIZED");
  }

  if (!res.ok) {
    throw new Error(`[Drive] deleteFile HTTP ${res.status}`);
  }
}

