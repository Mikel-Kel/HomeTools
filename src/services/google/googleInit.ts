// src/services/google/googleInit.ts
import { ref } from "vue";

/* ============================
   État réactif (UI)
============================ */
export const googleAuthenticated = ref(false);

/* ============================
   Token interne
============================ */
let accessToken: string | null = null;

/* ============================
   Expose access token (pour googleDrive)
============================ */
export function getAccessToken(): string | null {
  return accessToken;
}

/* ============================
   Typage global minimal
============================ */
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
        scope: "https://www.googleapis.com/auth/drive",
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