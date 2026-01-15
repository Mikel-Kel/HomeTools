// src/services/google/googleInit.ts
import { ref } from "vue";

/* ============================
   État réactif
============================ */
export const googleAuthenticated = ref(false);

let accessToken: string | null = null;

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

/* ============================
   Étape 1 — Init gapi (technique)
============================ */
export async function initGoogleAPI(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.gapi) {
      reject("[Google] gapi not loaded (check index.html)");
      return;
    }

    window.gapi.load("client", async () => {
      try {
        await window.gapi.client.init({
          apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
        });

        console.info("[Google] gapi client initialized");
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
}

/* ============================
   Étape 2 — Auth Google (popup)
============================ */
export async function connectGoogle(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.google) {
      reject("[Google] GIS not loaded");
      return;
    }

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      reject("[Google] VITE_GOOGLE_CLIENT_ID missing");
      return;
    }

    const tokenClient =
      window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "https://www.googleapis.com/auth/drive.readonly",
        callback: (resp: any) => {
          if (resp.error) {
            reject(resp);
          } else {
            accessToken = resp.access_token;
            googleAuthenticated.value = true;
            console.info("[Google] Auth success");
            resolve();
          }
        },
      });

    tokenClient.requestAccessToken({ prompt: "consent" });
  });
}

/* ============================
   Étape 3 — Drive read-only (REST)
============================ */
export async function listDriveFiles(): Promise<void> {
  if (!accessToken) {
    throw new Error("[Drive] No access token");
  }

  const res = await fetch(
    "https://www.googleapis.com/drive/v3/files?pageSize=10&fields=files(id,name,mimeType)",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error(`[Drive] HTTP ${res.status}`);
  }

  const data = await res.json();

  console.group("[Drive] files.list");
  data.files?.forEach((f: any) => {
    console.log(`${f.name} (${f.mimeType})`);
  });
  console.groupEnd();
}