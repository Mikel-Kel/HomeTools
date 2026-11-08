import { shallowRef } from "vue";

import type { EnvironmentInfo } from "@/contracts/environment";

/* =========================
   Environnement de l'appareil

   Renseigné par /api/whoami au démarrage
   (environmentGuard.ts). Tant qu'il n'est pas établi
   (inconnu ou bloqué), seul /api/whoami part vers le
   proxy (proxyClient.ts) et les pages ne sont pas montées
   (App.vue).

   Blocages, affichés par AppUnavailable.vue :
   - error : refus du proxy (§5.4) ou réponse inexploitable ;
     code null quand l'erreur vient de la PWA ;
   - contract : MAJOR du contrat différent de celui de la PWA ;
   - changed : l'appareil a changé d'environnement en cours
     de session ;
   - unreachable : le proxy ne répond pas.
========================= */

export type EnvironmentBlock =
  | { kind: "error"; code: string | null; message: string }
  | { kind: "contract"; proxyVersion: string }
  | { kind: "changed"; expected: string; received: string }
  | { kind: "unreachable" };

export const environment =
  shallowRef<EnvironmentInfo | null>(null);

export const environmentBlock =
  shallowRef<EnvironmentBlock | null>(null);

export function environmentEstablished(): boolean {
  return (
    environment.value !== null &&
    environmentBlock.value === null
  );
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
