import { ref } from "vue";

import { ContractError } from "@/contracts/read";
import { log } from "@/utils/logger";

import {
  hasProxyKey,
  ProxyError,
  proxyFetch,
  setProxyKey,
} from "@/services/proxy/proxyClient";

import {
  loadProxyKey,
  saveProxyKey,
  type StoredProxyKey,
} from "@/services/proxy/proxyKeyVault";

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
   recharger, et clé absente ou refusée, qui attend sa
   saisie (submitProxyKey).

   Clé du proxy : lue dans le coffre de l'appareil
   (proxyKeyVault.ts) avant whoami, qui l'exige. Une fois
   l'environnement connu, elle est rangée sous celui-ci si
   elle vient d'être saisie ou si elle était rangée sous un
   autre (appareil réaffecté).
========================= */

const RETRY_INTERVAL_MS =
  60 * 1000;

export const environmentChecking =
  ref(false);

/* Clé en mémoire et environnement sous lequel elle est rangée (null : saisie, pas encore rangée). */
let keySource: { env: string | null; value: string } | null = null;

async function readStoredKey(): Promise<StoredProxyKey | null> {
  try {
    return await loadProxyKey();
  } catch (e) {
    log.warn("[Vault] proxy key not readable", e);
    return null;
  }
}

async function rememberProxyKey(
  env: string
) {
  if (!keySource || keySource.env === env) {
    return;
  }

  try {
    await saveProxyKey(env, keySource.value);
    keySource = { env, value: keySource.value };
  } catch (e) {
    /* Clé gardée en mémoire : elle sera redemandée au prochain lancement. */
    log.warn("[Vault] proxy key not saved", e);
  }
}

export async function loadEnvironment() {

  if (environmentChecking.value) {
    return;
  }

  environmentChecking.value = true;

  try {

    if (!hasProxyKey()) {
      const stored =
        await readStoredKey();

      if (!stored) {
        blockEnvironment({ kind: "key", rejected: false });
        return;
      }

      keySource = stored;
      setProxyKey(stored.value);
    }

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

    await rememberProxyKey(info.env);

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
      if (environmentBlock.value?.kind === "key") {
        keySource = null;
        setProxyKey(null);
      }
    } else if (err instanceof ContractError) {
      blockEnvironment({ kind: "error", code: null, message: err.message });
    } else {
      blockEnvironment({ kind: "error", code: null, message: String(err) });
    }

  } finally {

    environmentChecking.value = false;

  }

}

/* Clé saisie dans AppUnavailable.vue : essayée par whoami, rangée si acceptée. */
export async function submitProxyKey(
  value: string
) {
  const key =
    value.trim();

  if (!key) {
    return;
  }

  keySource = { env: null, value: key };
  setProxyKey(key);

  await loadEnvironment();
}

function retryIfBlocked() {

  const block =
    environmentBlock.value;

  if (
    document.visibilityState === "visible" &&
    block !== null &&
    block.kind !== "key" &&
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
