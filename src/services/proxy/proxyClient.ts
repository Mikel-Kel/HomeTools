/* =========================
   Client du proxy HomeTools

   Seul point d'accès au proxy Flask du Mac (exposé via
   Tailscale) : URL, clé d'API et en-tête X-Proxy-Key ne
   sont lus qu'ici.

   La clé vient encore de VITE_PROXY_API_KEY, donc du
   bundle public. Le coffre chiffré la remplacera ici,
   sans toucher aux appelants.
========================= */

const proxyUrl =
  import.meta.env.VITE_PROXY_URL as string | undefined;

const proxyApiKey =
  import.meta.env.VITE_PROXY_API_KEY as string | undefined;

/*
  Au-delà de ce délai, la requête est abandonnée (Mac en
  veille, Tailscale pas encore reconnecté, etc.).
*/
const DEFAULT_TIMEOUT_MS =
  30_000;

export type ProxyErrorKind =
  | "config"
  | "unreachable"
  | "timeout";

/*
  Échec avant toute réponse HTTP. Une réponse en erreur
  (404, 500…) est rendue telle quelle : chaque appelant
  sait ce qu'elle signifie pour lui.
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
    proxyApiKey
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

  if (!proxyApiKey) {
    throw new ProxyError(
      "config",
      "Missing VITE_PROXY_API_KEY"
    );
  }

  const controller =
    new AbortController();

  const timer =
    window.setTimeout(
      () => controller.abort(),
      timeoutMs
    );

  try {
    return await fetch(
      buildUrl(path, params),
      {
        method,
        body,
        cache: "no-store",
        signal: controller.signal,

        headers: {
          "X-Proxy-Key":
            proxyApiKey,

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
}
