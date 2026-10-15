export const AUTH_TOKEN_KEY = "auth_token";
export const AUTH_REFRESH_TOKEN_KEY = "auth_refresh_token";
export const AUTH_USER_KEY = "auth_user";
export const AUTH_EXPIRED_EVENT = "samp:auth-expired";

export function readAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) || sessionStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function readAuthRefreshToken(): string | null {
  try {
    return localStorage.getItem(AUTH_REFRESH_TOKEN_KEY) || sessionStorage.getItem(AUTH_REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function readAuthUser<T>(): T | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY) || sessionStorage.getItem(AUTH_USER_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function persistAuthSession(
  token: string,
  user: unknown,
  rememberMe = true,
  refreshToken?: string
): void {
  try {
    const serialized = JSON.stringify(user);
    if (rememberMe) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      localStorage.setItem(AUTH_USER_KEY, serialized);
      if (refreshToken) localStorage.setItem(AUTH_REFRESH_TOKEN_KEY, refreshToken);
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
      sessionStorage.removeItem(AUTH_USER_KEY);
      sessionStorage.removeItem(AUTH_REFRESH_TOKEN_KEY);
    } else {
      sessionStorage.setItem(AUTH_TOKEN_KEY, token);
      sessionStorage.setItem(AUTH_USER_KEY, serialized);
      if (refreshToken) sessionStorage.setItem(AUTH_REFRESH_TOKEN_KEY, refreshToken);
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
      localStorage.removeItem(AUTH_REFRESH_TOKEN_KEY);
    }
  } catch {
    // Ignore storage quota or disabled storage errors
  }
}

export function updateAuthSessionTokens(token: string, refreshToken: string, user?: unknown): void {
  try {
    const storage = localStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(AUTH_REFRESH_TOKEN_KEY)
      ? localStorage
      : sessionStorage;
    storage.setItem(AUTH_TOKEN_KEY, token);
    storage.setItem(AUTH_REFRESH_TOKEN_KEY, refreshToken);
    if (user !== undefined) storage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  } catch {
    // Ignore storage errors; the current request can still use the refreshed token.
  }
}

export function updateStoredAuthUser(user: unknown): void {
  try {
    const serialized = JSON.stringify(user);
    if (localStorage.getItem(AUTH_TOKEN_KEY)) {
      localStorage.setItem(AUTH_USER_KEY, serialized);
    } else if (sessionStorage.getItem(AUTH_TOKEN_KEY)) {
      sessionStorage.setItem(AUTH_USER_KEY, serialized);
    }
  } catch {
    // Ignore storage errors
  }
}

export function clearAuthStorage(): void {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(AUTH_REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_USER_KEY);
    sessionStorage.removeItem(AUTH_REFRESH_TOKEN_KEY);
  } catch {
    // Ignore
  }
}
