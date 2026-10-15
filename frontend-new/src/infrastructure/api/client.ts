import {
  AUTH_EXPIRED_EVENT,
  clearAuthStorage,
  readAuthRefreshToken,
  readAuthToken,
  updateAuthSessionTokens,
} from "@/lib/session";

export const API_BASE_URL = (
  import.meta.env.VITE_API_URL?.trim() || import.meta.env.VITE_API_BASE_URL?.trim() || ""
).replace(/\/+$/, "");

interface RefreshedSession {
  access_token?: string;
  refresh_token?: string;
  user?: unknown;
}

const REQUEST_TIMEOUT_MS = 30_000;
const AUTH_TIMEOUT_MS = 12_000;
let refreshInFlight: Promise<string | null> | null = null;

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

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = readAuthRefreshToken();
      if (!refreshToken) return null;

      const response = await apiRawFetch("/api/auth/refresh", {
        method: "POST",
        jsonBody: { refresh_token: refreshToken },
        timeoutMs: AUTH_TIMEOUT_MS,
        skipAuthRefresh: true,
      });
      if (response.status === 429 || response.status >= 500) {
        throw new Error("Session refresh is temporarily unavailable.");
      }
      if (!response.ok) return null;

      const session = (await response.json()) as RefreshedSession;
      if (!session.access_token || !session.refresh_token) return null;
      updateAuthSessionTokens(session.access_token, session.refresh_token, session.user);
      return session.access_token;
    })().finally(() => {
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

  const config: RequestInit = { ...requestInit, headers };
  let response = await fetchWithTimeout(url, config, timeoutMs);

  if (
    response.status === 401 &&
    apiRequest &&
    !skipAuthRefresh &&
    readAuthToken() &&
    !url.pathname.endsWith("/api/auth/refresh")
  ) {
    try {
      const refreshedToken = await refreshAccessToken();
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
