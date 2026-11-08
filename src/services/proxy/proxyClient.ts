/* =========================
   Client du proxy HomeTools

   Seul point d'accès au proxy Flask du Mac (exposé via
   Tailscale) : URL, clé d'API et en-tête X-Proxy-Key ne
   sont lus qu'ici.

   La clé n'est pas dans le bundle (repo public) : saisie
   une fois par appareil, gardée chiffrée par
   proxyKeyVault.ts, et confiée ici en mémoire par
   environmentGuard.ts (setProxyKey).

   Contrat multi-environnements (src/contracts/environment.ts) :
   - tant que l'environnement n'est pas établi, seul
     /api/whoami est envoyé ;
   - un refus d'identité ou de configuration (§5.4), un
     contrat d'un autre MAJOR ou un environnement différent
     de celui du démarrage bloquent l'app ; un refus de la
     clé (AUTH_INVALID) demande de la saisir.
========================= */

import {
  CONTRACT_HEADER,
  ENV_HEADER,
  ENVIRONMENT_ERROR_CODES,
  isContractCompatible,
  readProxyErrorBody,
  WHOAMI_PATH,
  type ProxyErrorBody,
} from "@/contracts/environment";

import {
  blockEnvironment,
  environment,
  environmentEstablished,
} from "@/services/environment/environmentState";

const proxyUrl =
  import.meta.env.VITE_PROXY_URL as string | undefined;

/* Clé X-Proxy-Key déchiffrée, en mémoire seulement. */
let proxyKey: string | null = null;

export function setProxyKey(
  value: string | null
) {
  proxyKey = value;
}

export function hasProxyKey(): boolean {
  return proxyKey !== null;
}

/*
  Au-delà de ce délai, la requête est abandonnée (Mac en
  veille, Tailscale pas encore reconnecté, etc.).
*/
const DEFAULT_TIMEOUT_MS =
  30_000;

const GATEWAY_ERROR_STATUSES =
  [502, 503, 504];

export type ProxyErrorKind =
  | "config"
  | "unreachable"
  | "timeout"
  | "environment";

/*
  Échec avant toute réponse HTTP, ou réponse de la
  passerelle Tailscale sans le proxy derrière (502, 503,
  504 sans corps d'erreur du contrat) : « unreachable ».
  Environnement non établi ou bloquant : « environment ».
  Une autre réponse en erreur (404, 500…) est rendue
  telle quelle : chaque appelant sait ce qu'elle signifie
  pour lui.
*/
export class ProxyError extends Error {
  readonly kind: ProxyErrorKind;

  constructor(
    kind: ProxyErrorKind,
    message: string
  ) {
    super(message);

    this.name = "ProxyError";
    this.kind = kind;
  }
}

export interface ProxyRequest {
  method?: string;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  body?: BodyInit;
  timeoutMs?: number;
}

export function isProxyConfigured(): boolean {
  return Boolean(
    proxyUrl &&
    proxyKey
  );
}

function buildUrl(
  path: string,
  params?: Record<string, string>
): string {
  const base =
    (proxyUrl ?? "").replace(
      /\/+$/,
      ""
    );

  const url =
    new URL(base + path);

  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

async function readErrorBody(
  response: Response
): Promise<ProxyErrorBody | null> {
  try {
    return readProxyErrorBody(
      await response.clone().json()
    );
  } catch {
    return null;
  }
}

/* Contrat et environnement annoncés par chaque réponse (§5.1). */
function checkResponseHeaders(
  response: Response,
  path: string
) {
  const contract =
    response.headers.get(CONTRACT_HEADER);

  if (contract && !isContractCompatible(contract)) {
    blockEnvironment({
      kind: "contract",
      proxyVersion: contract,
    });

    throw new ProxyError(
      "environment",
      `Incompatible contract ${contract} (${path})`
    );
  }

  const env =
    response.headers.get(ENV_HEADER);

  const known =
    environment.value;

  if (env && known && env !== known.env) {
    blockEnvironment({
      kind: "changed",
      expected: known.env,
      received: env,
    });

    throw new ProxyError(
      "environment",
      `Environment changed to ${env} (${path})`
    );
  }
}

export async function proxyFetch(
  path: string,
  {
    method = "GET",
    params,
    headers,
    body,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  }: ProxyRequest = {}
): Promise<Response> {
  if (!proxyUrl) {
    throw new ProxyError(
      "config",
      "Missing VITE_PROXY_URL"
    );
  }

  if (!proxyKey) {
    throw new ProxyError(
      "config",
      "Proxy key not set on this device"
    );
  }

  if (
    path !== WHOAMI_PATH &&
    !environmentEstablished()
  ) {
    throw new ProxyError(
      "environment",
      `Environment not established (${path})`
    );
  }

  const controller =
    new AbortController();

  const timer =
    window.setTimeout(
      () => controller.abort(),
      timeoutMs
    );

  let response: Response;

  try {
    response = await fetch(
      buildUrl(path, params),
      {
        method,
        body,
        cache: "no-store",
        signal: controller.signal,

        headers: {
          "X-Proxy-Key":
            proxyKey,

          ...headers,
        },
      }
    );

  } catch (err) {
    if (controller.signal.aborted) {
      throw new ProxyError(
        "timeout",
        `Proxy did not answer within ${Math.round(timeoutMs / 1000)} s (${path})`
      );
    }

    throw new ProxyError(
      "unreachable",
      `Proxy unreachable (${path}): ${
        err instanceof Error
          ? err.message
          : String(err)
      }`
    );

  } finally {
    window.clearTimeout(timer);
  }

  checkResponseHeaders(response, path);

  if (response.ok) {
    return response;
  }

  const error =
    await readErrorBody(response);

  if (error && ENVIRONMENT_ERROR_CODES.includes(error.code)) {
    blockEnvironment(
      error.code === "AUTH_INVALID"
        ? { kind: "key", rejected: true }
        : { kind: "error", code: error.code, message: error.message }
    );

    throw new ProxyError(
      "environment",
      `${error.code} (${path}): ${error.message}`
    );
  }

  if (!error && GATEWAY_ERROR_STATUSES.includes(response.status)) {
    throw new ProxyError(
      "unreachable",
      `Proxy unavailable (${path}): HTTP ${response.status}`
    );
  }

  return response;
}
