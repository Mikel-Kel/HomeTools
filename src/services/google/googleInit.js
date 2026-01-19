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
let accessToken = null;
/* ============================
   Expose access token (pour googleDrive)
============================ */
export function getAccessToken() {
    return accessToken;
}
/* ============================
   Utils
============================ */
function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
}
function getRedirectUri() {
    // GitHub Pages → https://mikel-kel.github.io/HomeTools/
    // Local dev      → http://localhost:5173/
    return window.location.origin + import.meta.env.BASE_URL;
}
/* ============================
   Étape 1 — Init gapi (technique)
============================ */
export async function initGoogleAPI() {
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
            }
            catch (err) {
                reject(err);
            }
        });
    });
}
/* ============================
   Étape 2 — Auth Google (popup / redirect auto)
============================ */
export async function connectGoogle() {
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
        log.info(`[Google] Auth mode: ${useRedirect ? "redirect (iOS)" : "popup (desktop)"}`);
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: "https://www.googleapis.com/auth/drive",
            // 🔑 POINT CRITIQUE POUR iOS
            ux_mode: useRedirect ? "redirect" : "popup",
            redirect_uri: useRedirect ? getRedirectUri() : undefined,
            callback: (resp) => {
                if (resp?.error) {
                    reject(resp);
                }
                else if (resp?.access_token) {
                    accessToken = resp.access_token;
                    googleAuthenticated.value = true;
                    log.info("[Google] Auth success");
                    resolve();
                }
            },
        });
        tokenClient.requestAccessToken({ prompt: "consent" });
    });
}
