// src/services/google/googleInit.ts

declare global {
  interface Window {
    gapi: any;
  }
}

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