import { ref, shallowRef, watch } from "vue";

import type { Capabilities, EnvironmentInfo } from "@/contracts/environment";

/* =========================
   Environnement de l'appareil

   Renseigné par /api/whoami au démarrage
   (environmentGuard.ts), puis préparé par main.ts :
   migration et lecture du stockage du navigateur, préfixé
   par l'environnement (browserStorage.ts), restauration du
   dossier local. L'environnement est « établi » une fois
   préparé et tant qu'il n'est pas bloqué. Avant, seul
   /api/whoami part vers le proxy (proxyClient.ts), les
   pages ne sont pas montées (App.vue) et la navigation
   attend (router/index.ts).

   Blocages, affichés par AppUnavailable.vue :
   - error : refus du proxy (§5.4) ou réponse inexploitable ;
     code null quand l'erreur vient de la PWA ;
   - contract : MAJOR du contrat différent de celui de la PWA ;
   - changed : l'appareil a changé d'environnement en cours
     de session ;
   - unreachable : le proxy ne répond pas ;
   - key : clé du proxy absente de l'appareil, ou refusée
     (rejected) ; attend sa saisie.
========================= */

export type EnvironmentBlock =
  | { kind: "error"; code: string | null; message: string }
  | { kind: "contract"; proxyVersion: string }
  | { kind: "changed"; expected: string; received: string }
  | { kind: "unreachable" }
  | { kind: "key"; rejected: boolean };

export const environment =
  shallowRef<EnvironmentInfo | null>(null);

export const environmentBlock =
  shallowRef<EnvironmentBlock | null>(null);

/* Stockage du navigateur prêt pour l'environnement (main.ts). */
export const environmentReady =
  ref(false);

export function environmentEstablished(): boolean {
  return (
    environmentReady.value &&
    environment.value !== null &&
    environmentBlock.value === null
  );
}

export function whenEnvironmentReady(): Promise<void> {
  if (environmentReady.value) {
    return Promise.resolve();
  }

  return new Promise(resolve => {
    const stop =
      watch(environmentReady, ready => {
        if (ready) {
          stop();
          resolve();
        }
      });
  });
}

/*
  Capacités de l'environnement et rôle de l'appareil
  (§3.4) : faux tant que l'environnement n'est pas connu.
*/
export function hasCapability(
  name: keyof Capabilities
): boolean {
  return environment.value?.capabilities[name] === true;
}

export function isServerDevice(): boolean {
  return environment.value?.isServer === true;
}

/* Contrat incompatible ou environnement changé : seul un rechargement en sort. */
export function requiresReload(
  block: EnvironmentBlock | null
): boolean {
  return (
    block?.kind === "contract" ||
    block?.kind === "changed"
  );
}

export function blockEnvironment(
  block: EnvironmentBlock
) {
  if (!requiresReload(environmentBlock.value)) {
    environmentBlock.value = block;
  }
}
