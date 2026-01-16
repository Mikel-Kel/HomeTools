// src/services/google/googleDrive.ts
import { getAccessToken } from "./googleInit";

const DRIVE_BASE = "https://www.googleapis.com/drive/v3";

/* =========================
   Types Drive
========================= */
export type DriveItem = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
};

/* =========================
   Helper fetch Drive REST
========================= */
async function driveFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getAccessToken();
  if (!token) throw new Error("[Drive] Not authenticated");

  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
}

/* =========================
   TEST — List My Drive root
========================= */
export async function listMyDriveRoot(): Promise<DriveItem[]> {
  const res = await driveFetch(
    `${DRIVE_BASE}/files?pageSize=20&fields=files(id,name,mimeType)`
  );

  if (!res.ok) {
    throw new Error(`[Drive] root list HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.files ?? [];
}

/* =========================
   List items in folder
========================= */
export async function listFilesInFolder(
  folderId: string
): Promise<DriveItem[]> {
  const q = `'${folderId}' in parents and trashed=false`;
  const url =
    `${DRIVE_BASE}/files?q=${encodeURIComponent(q)}` +
    `&fields=files(id,name,mimeType,modifiedTime)`;

  const res = await driveFetch(url);
  if (!res.ok) {
    throw new Error(`[Drive] listFiles HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.files ?? [];
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
    `${DRIVE_BASE}/files?q=${encodeURIComponent(q)}` +
    `&fields=files(id,name,mimeType)`;

  const res = await driveFetch(url);
  if (!res.ok) {
    throw new Error(`[Drive] findFolder HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.files?.[0] ?? null;
}

/* =========================
   Read JSON file (by id)
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
   Write JSON file
========================= */
export async function writeJSON(
  folderId: string,
  filename: string,
  data: any,
  existingFileId?: string
): Promise<string> {
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

  const token = getAccessToken();
  if (!token) throw new Error("[Drive] Not authenticated");

  const url = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;

  const res = await fetch(url, {
    method: existingFileId ? "PATCH" : "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) {
    throw new Error(`[Drive] writeJSON HTTP ${res.status}`);
  }

  const result = await res.json();
  return result.id;
}

console.log("googleDrive exports loaded", {
  listMyDriveRoot,
});