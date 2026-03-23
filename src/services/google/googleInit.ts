// src/services/google/googleInit.ts
import { log } from "@/utils/logger";
import { ref } from "vue";

/* ============================
   État réactif (UI)
============================ */
export const googleAuthenticated = ref(false);

/* ============================
   Token interne
============================ */
let accessToken: string | null = null;
let tokenExpiresAt: number | null = null;

/* ============================
   Expose access token (pour googleDrive)
============================ */
export function getAccessToken(): string | null {
  return accessToken;
}

export function clearAccessToken() {
  accessToken = null;
  googleAuthenticated.value = false;
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
   Utils
============================ */
function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function getRedirectUri(): string {
  // GitHub Pages → https://mikel-kel.github.io/HomeTools/
  // Local dev      → http://localhost:5173/
  return window.location.origin + import.meta.env.BASE_URL;
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
        log.info("[Google] gapi client initialized");
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
}

/* ============================
   Étape 2 — Auth Google (popup / redirect auto)
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

    const useRedirect = isIOS();

    log.info(
      `[Google] Auth mode: ${useRedirect ? "redirect (iOS)" : "popup (desktop)"}`
    );

    const tokenClient =
      window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "https://www.googleapis.com/auth/drive",

        // 🔑 POINT CRITIQUE POUR iOS
        ux_mode: useRedirect ? "redirect" : "popup",
        redirect_uri: useRedirect ? getRedirectUri() : undefined,

callback: (resp: any) => {

  if (resp?.error) {
    reject(resp)
  } else if (resp?.access_token) {

    accessToken = resp.access_token

    if (resp.expires_in) {
      tokenExpiresAt = Date.now() + (resp.expires_in - 30) * 1000
    }

    googleAuthenticated.value = true
    resolve()

  } else {

    console.error("❌ NO TOKEN IN RESPONSE", resp)
    reject("No access_token")
  }
}

      });

    tokenClient.requestAccessToken({ prompt: "consent" });
  });
}

export function handleRedirectToken(): boolean {

  const fullUrl = window.location.href

  // 🔥 extraire TOUT ce qui est après #
  const hashIndex = fullUrl.indexOf("#")

  if (hashIndex === -1) return false

  const hashPart = fullUrl.substring(hashIndex + 1)

  // 🔥 chercher access_token dans toute la chaîne
  if (!hashPart.includes("access_token")) return false

  const params = new URLSearchParams(hashPart.replace(/^.*#/, ""))

  const token = params.get("access_token")

  if (!token) return false

  accessToken = token
  googleAuthenticated.value = true

  // 🔥 nettoyage URL propre
  window.history.replaceState(
    {},
    document.title,
    window.location.pathname + window.location.search + "#/authentication"
  )

  return true
}

export function isTokenValid(): boolean {
  if (!accessToken) return false;
  if (!tokenExpiresAt) return true;
  return Date.now() < tokenExpiresAt;
}