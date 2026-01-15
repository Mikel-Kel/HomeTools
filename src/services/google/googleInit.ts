// src/services/google/googleInit.ts

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

let isAuthenticated = false;

export function isGoogleAuthenticated(): boolean {
  return isAuthenticated;
}

/* ============================
   Étape 1 — Init gapi (déjà OK)
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
        scope: "profile email", // ⬅️ volontairement minimal
        callback: (resp: any) => {
          if (resp.error) {
            reject(resp);
          } else {
            isAuthenticated = true;
            console.info("[Google] Auth success");
            resolve();
          }
        },
      });

    tokenClient.requestAccessToken({ prompt: "consent" });
  });
}