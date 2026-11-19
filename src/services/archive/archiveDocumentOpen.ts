import { isProxyConfigured, ProxyError, proxyFetch } from "@/services/proxy/proxyClient";
import { SERVER_NOT_ANSWERING } from "@/services/events/requestMessages";
import { hasCapability, isServerDevice } from "@/services/environment/environmentState";
import { isPWA } from "@/utils/deviceDetection";

/* =========================
   Ouverture d'un document d'archives

   Par le proxy Tailscale : Aperçu ou disque sur le Mac
   serveur, magasin S3 archives ailleurs. Utilisée par
   DocumentsArchiveView.vue (openDocument).
========================= */

/*
  Archives sur le disque de cet appareil : l'environnement a
  la capacité localArchive et l'appareil est le serveur
  (§3.4). Alors seulement, le PDF est ouvert dans Aperçu
  (/api/local/open) ou lu sur le disque (/api/local/read).
  Ailleurs, iPad compris : lu dans le magasin S3 archives de
  l'environnement et affiché dans le navigateur.
*/
function archivesOnThisDevice(): boolean {
  return (
    hasCapability("localArchive") &&
    isServerDevice()
  );
}

async function openNativelyOnMac(
  physicalName: string
): Promise<boolean> {
  if (!isProxyConfigured()) {
    return false;
  }

  try {
    /*
      Délai court : en cas d'échec, l'affichage dans le
      navigateur prend le relais.
    */
    const response =
      await proxyFetch(
        "/api/local/open",
        {
          method: "POST",
          params: { key: physicalName },
          timeoutMs: 10_000,
        }
      );

    return response.ok;

  } catch (err) {
    console.error(
      "Native open via proxy failed",
      err
    );

    return false;
  }
}

const LOCAL_SOURCE =
  "local archive";

const STORE_SOURCE =
  "archive storage";

/*
  Distingue un vrai "fichier absent" (404) d'un autre
  echec (reseau, Tailscale pas encore reconnecte, cle
  invalide, etc.) - utile pour diagnostiquer les
  echecs intermittents sur iPad.
*/
function readFailure(
  source: string,
  response: Response
): string {
  return response.status === 404
    ? `Document not found in ${source}`
    : `Read from ${source} failed (HTTP ${response.status})`;
}

/*
  Lecture du PDF par le proxy, renvoyée en URL blob: :
  - sur le Mac serveur (archivesOnThisDevice) : sur le
    disque, /api/local/read ; si la copie locale ne l'a pas
    (404 : en retard, ou fichier pas téléchargé par iCloud),
    dans le magasin S3 archives, qui fait référence (§6,
    §10). Une autre erreur ne déclenche pas de repli ;
  - ailleurs : magasin S3 archives de l'environnement,
    /api/s3/read (octets bruts, §5.3).
  La clé est le même chemin relatif sur le disque et dans le
  magasin ; le proxy essaie ses formes NFC et NFD.
  Le délai de proxyFetch ne court que jusqu'aux en-têtes :
  un gros PDF n'est pas coupé pendant son téléchargement.
*/
async function fetchArchiveDocumentUrl(
  physicalName: string
): Promise<string> {
  let localFailure =
    "";

  if (archivesOnThisDevice()) {
    const localResponse =
      await proxyFetch(
        "/api/local/read",
        { params: { key: physicalName } }
      );

    if (localResponse.ok) {
      return toPdfObjectUrl(
        localResponse,
        physicalName
      );
    }

    localFailure =
      readFailure(LOCAL_SOURCE, localResponse);

    if (localResponse.status !== 404) {
      throw new Error(localFailure);
    }
  }

  const response =
    await proxyFetch(
      "/api/s3/read",
      { params: { store: "archives", key: physicalName } }
    );

  if (!response.ok) {
    const storeFailure =
      readFailure(STORE_SOURCE, response);

    throw new Error(
      localFailure
        ? `${localFailure}. ${storeFailure}.`
        : `${storeFailure}.`
    );
  }

  return toPdfObjectUrl(
    response,
    physicalName
  );
}

async function toPdfObjectUrl(
  response: Response,
  physicalName: string
): Promise<string> {
  let blob =
    await response.blob();

  /*
    Objet S3 sans type enregistré (application/octet-stream) :
    l'iPad le téléchargerait au lieu de l'afficher.
  */
  if (
    blob.type !== "application/pdf" &&
    physicalName.toLowerCase().endsWith(".pdf")
  ) {
    blob =
      new Blob([blob], { type: "application/pdf" });
  }

  /*
    L'URL blob:// generee ici n'est valide que dans cet onglet
    et est liberee automatiquement par le navigateur a sa
    fermeture - pas besoin de revokeObjectURL manuel pour ce
    cas d'usage ponctuel (ouverture d'un document).
  */
  return URL.createObjectURL(blob);
}

/*
  Ouvre le document de chemin physicalName ; renvoie null,
  ou la raison de l'échec, à afficher.
*/
export async function openArchiveDocument(
  physicalName: string
): Promise<string | null> {
  if (!physicalName) {
    return "This document has no file.";
  }

  if (archivesOnThisDevice()) {
    if (
      await openNativelyOnMac(
        physicalName
      )
    ) {
      return null;
    }
    /*
      Echec de l'ouverture native (proxy injoignable, launchctl
      qui echoue, etc.) : on continue vers l'affichage navigateur
      ci-dessous plutot que d'abandonner - toujours mieux qu'un
      message d'erreur pour un probleme purement cosmetique.
    */
  }

  try {
    const objectUrl =
      await fetchArchiveDocumentUrl(
        physicalName
      );

    if (isPWA()) {
      /*
        PWA installée (écran d'accueil de l'iPad, Dock ou
        Chrome sur Mac) : le PDF s'affiche dans la fenêtre de
        l'app, comme sur l'iPad. window.open() y est peu
        fiable (pas d'onglets, échec souvent silencieux sur
        iOS) et ouvrirait une fenêtre de navigateur sur Mac.
      */
      window.location.href =
        objectUrl;

      return null;
    }

    window.open(
      objectUrl,
      "_blank",
      "noopener"
    );

    return null;

  } catch (err) {
    console.error(
      "Failed to open archive document",
      physicalName,
      err
    );

    if (
      err instanceof ProxyError &&
      (err.kind === "unreachable" || err.kind === "timeout")
    ) {
      return SERVER_NOT_ANSWERING;
    }

    return err instanceof Error
      ? err.message
      : String(err);
  }
}
