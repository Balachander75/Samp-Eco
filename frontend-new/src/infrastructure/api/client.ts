import {
  AUTH_EXPIRED_EVENT,
  clearAuthStorage,
  readAuthRefreshToken,
  readAuthToken,
  updateAuthSessionTokens,
} from "@/lib/session";

function getEffectiveApiBaseUrl(): string {
  const configured = (
    import.meta.env.VITE_API_URL?.trim() || import.meta.env.VITE_API_BASE_URL?.trim() || ""
  ).replace(/\/+$/, "");

  if (typeof window === "undefined") {
    return configured;
  }

  // When accessing over the local network (e.g. mobile or another PC on LAN),
  // a 'localhost' / '127.0.0.1' base URL will fail on the remote device.
  // In that case, fallback to same-origin (Vite dev proxy) to guarantee seamless network sharing.
  if (configured && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
    try {
      const parsed = new URL(configured, window.location.origin);
      if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
        return "";
      }
    } catch {
      // ignore
    }
  }

  return configured;
}

export const API_BASE_URL = getEffectiveApiBaseUrl();

interface RefreshedSession {
  access_token?: string;
  refresh_token?: string;
  user?: unknown;
}

const REQUEST_TIMEOUT_MS = 30_000;
const AUTH_TIMEOUT_MS = 12_000;
const AUTH_REFRESH_LOCK_KEY = "samp.auth-refresh.lock";
const AUTH_REFRESH_LOCK_NAME = "samp-auth-refresh";
const AUTH_REFRESH_LOCK_LEASE_MS = AUTH_TIMEOUT_MS + 8_000;
const AUTH_REFRESH_LOCK_WAIT_MS = AUTH_TIMEOUT_MS + 5_000;
let refreshInFlight: Promise<string | null> | null = null;

interface LocalRefreshLock {
  owner: string;
  expiresAt: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createRefreshLockOwner(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readLocalRefreshLock(): LocalRefreshLock | null {
  try {
    const raw = localStorage.getItem(AUTH_REFRESH_LOCK_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<LocalRefreshLock>;
    return typeof value.owner === "string" && typeof value.expiresAt === "number"
      ? { owner: value.owner, expiresAt: value.expiresAt }
      : null;
  } catch {
    return null;
  }
}

/** Serialize rotating refresh-token requests across tabs sharing localStorage. */
async function withCrossTabRefreshLock<T>(work: () => Promise<T>): Promise<T> {
  const browserLocks = typeof navigator === "undefined"
    ? undefined
    : (navigator as unknown as {
        locks?: { request: <R>(name: string, callback: () => Promise<R>) => Promise<R> };
      }).locks;

  if (browserLocks) {
    return browserLocks.request(AUTH_REFRESH_LOCK_NAME, work);
  }

  if (typeof window === "undefined") return work();

  // Web Locks are not available in every supported browser. Use a short
  // localStorage lease as a fallback; the owner check prevents a tab from
  // releasing another tab's lock.
  const owner = createRefreshLockOwner();
  const deadline = Date.now() + AUTH_REFRESH_LOCK_WAIT_MS;
  while (Date.now() < deadline) {
    const current = readLocalRefreshLock();
    if (!current || current.expiresAt <= Date.now()) {
      try {
        localStorage.setItem(AUTH_REFRESH_LOCK_KEY, JSON.stringify({
          owner,
          expiresAt: Date.now() + AUTH_REFRESH_LOCK_LEASE_MS,
        } satisfies LocalRefreshLock));
      } catch {
        // Storage may be disabled. Continue with same-tab single-flight behavior.
        return work();
      }
      if (readLocalRefreshLock()?.owner === owner) {
        try {
          return await work();
        } finally {
          try {
            if (readLocalRefreshLock()?.owner === owner) {
              localStorage.removeItem(AUTH_REFRESH_LOCK_KEY);
            }
          } catch {
            // Let the lease expire if storage becomes unavailable mid-refresh.
          }
        }
      }
    }
    await sleep(60 + Math.floor(Math.random() * 90));
  }

  throw new Error("Another tab is refreshing the session. Please retry shortly.");
}

function resolveApiUrl(endpoint: string): URL {
  const base = API_BASE_URL || (typeof window !== "undefined" ? window.location.origin : "http://localhost");
  return new URL(endpoint, base);
}

function isApiRequest(url: URL): boolean {
  const base = API_BASE_URL || (typeof window !== "undefined" ? window.location.origin : "http://localhost");
  return url.origin === new URL(base).origin;
}

async function fetchWithTimeout(url: URL, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const callerSignal = init.signal;
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abortFromCaller = () => controller.abort();

  if (callerSignal?.aborted) controller.abort();
  else callerSignal?.addEventListener("abort", abortFromCaller, { once: true });

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) throw new Error("Request timed out. Please try again.");
    throw error;
  } finally {
    clearTimeout(timeout);
    callerSignal?.removeEventListener("abort", abortFromCaller);
  }
}

async function refreshAccessToken(failedAccessToken: string): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = withCrossTabRefreshLock(async () => {
      // A different request or tab may have refreshed while this request was
      // waiting for the lock. Reuse that access token instead of rotating again.
      const latestAccessToken = readAuthToken();
      if (latestAccessToken && latestAccessToken !== failedAccessToken) {
        return latestAccessToken;
      }

      const refreshToken = readAuthRefreshToken();

      const response = await apiRawFetch("/api/auth/refresh", {
        method: "POST",
        jsonBody: refreshToken ? { refresh_token: refreshToken } : {},
        timeoutMs: AUTH_TIMEOUT_MS,
        skipAuthRefresh: true,
      });
      if (response.status === 429 || response.status >= 500) {
        throw new Error("Session refresh is temporarily unavailable.");
      }
      if (!response.ok) {
        // If another tab rotated the token just before this refresh reached the
        // server, keep using its session instead of clearing a valid login.
        const tokenAfterFailure = readAuthToken();
        return tokenAfterFailure && tokenAfterFailure !== failedAccessToken
          ? tokenAfterFailure
          : null;
      }

      const session = (await response.json()) as RefreshedSession;
      if (!session.access_token) return null;
      updateAuthSessionTokens(session.access_token, session.refresh_token || "", session.user);
      return session.access_token;
    }).finally(() => {
      refreshInFlight = null;
    });
  }

  const token = await refreshInFlight;
  if (!token) {
    clearAuthStorage();
    if (typeof window !== "undefined") window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }
  return token;
}

export interface ApiHeaderOptions {
  json?: boolean;
  accept?: boolean;
  token?: string | null;
}

/** Builds consistent request headers including an optional Bearer token. */
export function createApiHeaders({
  json = false,
  accept = false,
  token = readAuthToken(),
}: ApiHeaderOptions = {}): Record<string, string> {
  return {
    ...(accept ? { Accept: "application/json" } : {}),
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Normalizes common FastAPI and network error bodies into a useful message. */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!isRecord(error)) return typeof error === "string" ? error : fallback;
  const detail = error.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => (typeof item === "string" ? item : isRecord(item) ? item.msg : null))
      .filter((value): value is string => typeof value === "string");
    if (messages.length) return messages.join(" ");
  }
  if (isRecord(detail)) {
    if (typeof detail.message === "string") return detail.message;
    if (isRecord(detail.error) && typeof detail.error.message === "string") return detail.error.message;
  }
  return typeof error.message === "string" ? error.message : fallback;
}

type ApiRequestInit = RequestInit & {
  jsonBody?: unknown;
  timeoutMs?: number;
  skipAuthRefresh?: boolean;
};

/** Raw response helper for JSON, file, and authentication requests. */
export async function apiRawFetch(endpoint: string, options: ApiRequestInit = {}): Promise<Response> {
  const url = /^https?:\/\//i.test(endpoint) ? new URL(endpoint) : resolveApiUrl(endpoint);
  const { jsonBody, timeoutMs = REQUEST_TIMEOUT_MS, skipAuthRefresh = false, ...requestInit } = options;
  const headers = new Headers(requestInit.headers);
  const apiRequest = isApiRequest(url);

  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (jsonBody !== undefined) {
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    requestInit.body = JSON.stringify(jsonBody);
  }
  // Never forward a SAMP bearer token to an image host or arbitrary absolute URL.
  if (apiRequest && !headers.has("Authorization")) {
    const token = readAuthToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  } else if (!apiRequest) headers.delete("Authorization");

  const config: RequestInit = { credentials: "include", ...requestInit, headers };
  let response = await fetchWithTimeout(url, config, timeoutMs);

  if (
    response.status === 401 &&
    apiRequest &&
    !skipAuthRefresh &&
    readAuthToken() &&
    !url.pathname.endsWith("/api/auth/refresh")
  ) {
    try {
      const sentAuthorization = headers.get("Authorization") || "";
      const sentAccessToken = sentAuthorization.replace(/^Bearer\s+/i, "");
      const refreshedToken = await refreshAccessToken(sentAccessToken);
      if (refreshedToken) {
        const retryHeaders = new Headers(config.headers);
        retryHeaders.set("Authorization", `Bearer ${refreshedToken}`);
        response = await fetchWithTimeout(url, { ...config, headers: retryHeaders }, timeoutMs);
      }
    } catch {
      // Preserve the original response so the caller receives the API error.
    }
  }
  return response;
}

/** Typed HTTP wrapper with bounded requests and standardized JSON errors. */
export async function apiFetch<T>(endpoint: string, options: ApiRequestInit = {}): Promise<T> {
  const response = await apiRawFetch(endpoint, options);
  const responseText = await response.text();
  let responseData: unknown = null;
  if (responseText) {
    try {
      responseData = JSON.parse(responseText) as unknown;
    } catch {
      responseData = responseText;
    }
  }

  if (!response.ok) {
    throw new Error(
      getApiErrorMessage(responseData, `Request failed with status ${response.status}: ${response.statusText}`)
    );
  }
  if (!responseText) return null as T;
  if (typeof responseData === "string") throw new Error("The server returned an invalid response.");
  return responseData as T;
}
