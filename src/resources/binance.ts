import { NetworkError } from '@data-client/rest';

export const BINANCE_REST = 'https://data-api.binance.vision/api/v3';
export const BINANCE_WS = 'wss://data-stream.binance.vision/stream';

/** REST fills the entity once; websocket `set`s keep it live.
 * Must be finite: `Infinity` becomes `null` in Data Client's JSON SSR snapshot. */
export const LIVE_SNAPSHOT_EXPIRY = 10 * 365 * 24 * 60 * 60 * 1000;
/** Don't retry a hard error until Binance's typical Retry-After has elapsed. */
export const RATE_LIMIT_ERROR_EXPIRY = 30_000;
const SNAPSHOT_TTL_MS = 5_000;
const DEFAULT_RETRY_MS = 25_000;

const inflight = new Map<string, Promise<Response>>();
const snapshots = new Map<string, { expires: number; response: Response }>();
let limitedUntil = 0;

export function binanceRetryDelay() {
  return Math.max(0, limitedUntil - Date.now());
}

function retryAfterMs(response: Response): number {
  const raw = response.headers.get('retry-after');
  if (!raw) return DEFAULT_RETRY_MS;
  const secs = Number(raw);
  if (Number.isFinite(secs)) return Math.max(1000, secs * 1000);
  const when = Date.parse(raw);
  if (Number.isFinite(when)) return Math.max(1000, when - Date.now());
  return DEFAULT_RETRY_MS;
}

function noteRateLimit(response: Response) {
  if (response.status !== 429) return;
  limitedUntil = Math.max(limitedUntil, Date.now() + retryAfterMs(response));
}

function rateLimitedError(url: string): NetworkError {
  const retrySec = Math.max(1, Math.ceil(binanceRetryDelay() / 1000));
  const response = new Response(
    JSON.stringify({
      code: -1015,
      msg: `Too many requests. Retry after ${retrySec}s`,
    }),
    {
      status: 429,
      headers: {
        'content-type': 'application/json',
        'retry-after': String(retrySec),
      },
    },
  );
  Object.defineProperty(response, 'url', { value: url });
  return new NetworkError(response);
}

function pruneSnapshots(now: number) {
  for (const [key, entry] of snapshots) {
    if (entry.expires <= now) snapshots.delete(key);
  }
}

/** GET with Content-Type is a non-simple request; Binance CORS rejects the preflight. */
export function binanceGetInit(this: { signal?: AbortSignal }) {
  return { method: 'GET' as const, signal: this.signal };
}

export async function binanceFetch(
  url: string,
  init?: RequestInit,
  { snapshot = false }: { snapshot?: boolean } = {},
): Promise<Response> {
  const now = Date.now();
  if (now < limitedUntil) throw rateLimitedError(url);

  if (snapshot && typeof window === 'undefined') {
    pruneSnapshots(now);
    const cached = snapshots.get(url);
    if (cached && cached.expires > now) return cached.response.clone();
  }

  let pending = inflight.get(url);
  if (!pending) {
    pending = fetch(url, init)
      .then((response) => {
        noteRateLimit(response);
        if (!response.ok) throw new NetworkError(response);
        if (snapshot && typeof window === 'undefined') {
          snapshots.set(url, {
            expires: Date.now() + SNAPSHOT_TTL_MS,
            response: response.clone(),
          });
        }
        return response;
      })
      .finally(() => {
        inflight.delete(url);
      });
    inflight.set(url, pending);
  }

  return (await pending).clone();
}

export function binanceFetchResponse(input: RequestInfo, init: RequestInit) {
  const url = typeof input === 'string' ? input : input.url;
  return binanceFetch(url, init, { snapshot: true }).catch((error: unknown) => {
    if (error instanceof TypeError) {
      (error as TypeError & { status?: number }).status = 500;
    }
    throw error;
  });
}

export const binanceLive = {
  getRequestInit: binanceGetInit,
  fetchResponse: binanceFetchResponse,
  dataExpiryLength: LIVE_SNAPSHOT_EXPIRY,
  errorExpiryLength: RATE_LIMIT_ERROR_EXPIRY,
};

export type StreamArgs = {
  symbol?: string;
  symbols?: readonly string[];
  interval?: string;
};

export type StreamEndpoint = {
  streams?: (args: StreamArgs) => string[];
};
