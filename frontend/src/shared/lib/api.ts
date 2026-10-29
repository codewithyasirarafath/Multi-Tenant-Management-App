const BASE_URL = "/api/v1";

const TOKEN_KEY = "accessToken";
const REFRESH_KEY = "refreshToken";

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setAccessToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}
export function setRefreshToken(token: string) {
  localStorage.setItem(REFRESH_KEY, token);
}
export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

type RefreshHandler = () => Promise<string | null>;
let refreshHandler: RefreshHandler | null = null;

/** AuthContext registers its refresh logic here to avoid a circular import. */
export function setRefreshHandler(handler: RefreshHandler) {
  refreshHandler = handler;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  skipAuth?: boolean;
  retryOn401?: boolean;
}

export async function api<T = unknown>(
  path: string,
  { method = "GET", body, skipAuth = false, retryOn401 = true }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (!skipAuth && token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !skipAuth && retryOn401 && refreshHandler) {
    const newToken = await refreshHandler();
    if (newToken) {
      // Retry the original request once with the fresh token.
      return api<T>(path, { method, body, skipAuth, retryOn401: false });
    }
    clearTokens();
    window.dispatchEvent(new Event("auth:logout"));
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let details: unknown;
    try {
      const data = (await res.json()) as { error?: string; message?: string; details?: unknown };
      message = data.error || data.message || message;
      details = data.details;
    } catch {
      // non-JSON error body
    }
    throw new ApiError(res.status, message, details);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
