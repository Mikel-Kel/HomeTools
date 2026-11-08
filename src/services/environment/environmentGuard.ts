import { ref } from "vue";

import { ContractError } from "@/contracts/read";
import { ProxyError, proxyFetch } from "@/services/proxy/proxyClient";

import {
  isContractCompatible,
  readWhoami,
  WHOAMI_PATH,
} from "@/contracts/environment";

import {
  blockEnvironment,
  environment,
  environmentBlock,
  requiresReload,
} from "./environmentState";

/* =========================
   Démarrage sous contrat

   /api/whoami est le premier appel au proxy, quel que soit
   le stockage (Local Drive compris). En cas d'échec, l'app
   reste bloquée (AppUnavailable.vue) et réessaie toutes les
   minutes et au retour au premier plan, sauf contrat
   incompatible ou environnement changé, qui demandent de
   recharger.
========================= */

const RETRY_INTERVAL_MS =
  60 * 1000;

export const environmentChecking =
  ref(false);

export async function loadEnvironment() {

  if (environmentChecking.value) {
    return;
  }

  environmentChecking.value = true;

  try {

    const response =
      await proxyFetch(WHOAMI_PATH);

    if (!response.ok) {
      blockEnvironment({
        kind: "error",
        code: null,
        message: `Environment request failed (HTTP ${response.status}).`,
      });
      return;
    }

    const info =
      readWhoami(await response.json());

    if (!isContractCompatible(info.contractVersion)) {
      blockEnvironment({
        kind: "contract",
        proxyVersion: info.contractVersion,
      });
      return;
    }

    const known =
      environment.value;

    if (known && known.env !== info.env) {
      blockEnvironment({
        kind: "changed",
        expected: known.env,
        received: info.env,
      });
      return;
    }

    environment.value = info;
    environmentBlock.value = null;

  } catch (err) {

    if (err instanceof ProxyError) {
      if (err.kind === "unreachable" || err.kind === "timeout") {
        blockEnvironment({ kind: "unreachable" });
      } else if (err.kind === "config") {
        blockEnvironment({ kind: "error", code: null, message: err.message });
      }
      /* "environment" : le blocage est déjà posé par proxyFetch. */
    } else if (err instanceof ContractError) {
      blockEnvironment({ kind: "error", code: null, message: err.message });
    } else {
      blockEnvironment({ kind: "error", code: null, message: String(err) });
    }

  } finally {

    environmentChecking.value = false;

  }

}

function retryIfBlocked() {

  const block =
    environmentBlock.value;

  if (
    document.visibilityState === "visible" &&
    block !== null &&
    !requiresReload(block)
  ) {
    void loadEnvironment();
  }

}

/* Premier appel et relances, posés une fois au démarrage (main.ts). */
export function startEnvironmentWatch() {

  void loadEnvironment();

  document.addEventListener("visibilitychange", retryIfBlocked);

  window.setInterval(retryIfBlocked, RETRY_INTERVAL_MS);

}
