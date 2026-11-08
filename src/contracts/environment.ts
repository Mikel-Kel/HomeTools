import {
  asBoolean,
  asObject,
  asString,
  ContractError,
} from "./read";

/* =========================
   Contrat multi-environnements

   Référence : contracts/MULTI_ENV_CONTRACT.md (§5 et §10).
   La PWA n'envoie jamais d'environnement : le proxy le
   déduit de l'appareil appelant et le renvoie par
   /api/whoami et par l'en-tête X-HomeTools-Env.
========================= */

/* Version du contrat implémentée par la PWA. */
export const CONTRACT_VERSION =
  "1.2.1";

export const WHOAMI_PATH =
  "/api/whoami";

export const CONTRACT_HEADER =
  "X-HomeTools-Contract";

export const ENV_HEADER =
  "X-HomeTools-Env";

/*
  Codes d'erreur du proxy (§5.4) qui empêchent tout usage
  de l'app : identité de l'appareil, clé du proxy ou
  configuration des environnements.
*/
export const ENVIRONMENT_ERROR_CODES: readonly string[] = [
  "ENV_NO_PROVENANCE",
  "ENV_UNKNOWN_DEVICE",
  "ENV_DISABLED",
  "AUTH_INVALID",
  "CONFIG_INVALID",
];

/* Capacités v1 (§3.4) : absente = false. */
export interface Capabilities {
  localArchive: boolean;
  card24: boolean;
}

export interface EnvironmentInfo {
  contractVersion: string;
  env: string;
  label: string;
  device: string;
  kind: string;
  isServer: boolean;
  capabilities: Capabilities;
}

export interface ProxyErrorBody {
  code: string;
  message: string;
}

function contractMajor(
  version: string
): string | null {
  const match =
    /^(\d+)\./.exec(version);

  return match
    ? match[1]
    : null;
}

/* Même MAJOR que la PWA (§5.4, « Compatibilité »). */
export function isContractCompatible(
  version: string
): boolean {
  const major =
    contractMajor(version);

  return (
    major !== null &&
    major === contractMajor(CONTRACT_VERSION)
  );
}

export function readWhoami(
  value: unknown
): EnvironmentInfo {
  const root =
    asObject(value);

  const env =
    asString(root?.env);

  if (!root || !env) {
    throw new ContractError(
      "whoami",
      "environment missing"
    );
  }

  const capabilities =
    asObject(root.capabilities);

  return {
    contractVersion:
      asString(root.contractVersion),

    env,

    label:
      asString(root.label, env),

    device:
      asString(root.device),

    kind:
      asString(root.kind),

    isServer:
      asBoolean(root.isServer),

    capabilities: {
      localArchive:
        asBoolean(capabilities?.localArchive),

      card24:
        asBoolean(capabilities?.card24),
    },
  };
}

/* Corps d'erreur { error: { code, message } } (§5.4), ou null. */
export function readProxyErrorBody(
  value: unknown
): ProxyErrorBody | null {
  const error =
    asObject(asObject(value)?.error);

  const code =
    asString(error?.code);

  return code
    ? {
        code,
        message: asString(error?.message),
      }
    : null;
}
