/**
 * Typed API client for the control-plane API. Stores the short-lived access
 * token in memory (module scope) and relies on the httpOnly refresh cookie to
 * renew it. Never stores tokens in localStorage.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1';

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly error: ApiError,
  ) {
    super(error.message);
    this.name = 'ApiRequestError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { retry?: boolean } = {},
): Promise<T> {
  const { retry = true, ...init } = options;
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
    credentials: 'include',
  });

  if (res.status === 401 && retry) {
    // Attempt a silent refresh once, then replay the request.
    const refreshed = await tryRefresh();
    if (refreshed) return request<T>(path, { ...options, retry: false });
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: ApiError } | null;
    throw new ApiRequestError(
      res.status,
      body?.error ?? { code: 'unknown', message: res.statusText },
    );
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { accessToken: string };
    accessToken = data.accessToken;
    return true;
  } catch {
    return false;
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

/* ------------------------------ domain types ----------------------------- */

export interface Site {
  id: string;
  name: string;
  primaryDomain: string;
  publicKey: string;
  ingestKey: string;
  samplingRate: number;
  status: string;
  configVersion: number;
  createdAt: string;
}

export interface Experiment {
  id: string;
  name: string;
  status: string;
  type: string;
  siteId: string;
  allocation: number;
  riskScore: number;
  createdAt: string;
}

export interface Overview {
  pageViews: number;
  conversions: number;
  conversionRate: number;
  ctaClicks: number;
  formSubmits: number;
}

export interface VariantResult {
  variantId: string;
  isControl: boolean;
  exposures: number;
  conversions: number;
  conversionRate: number;
  lift: number | null;
  pValue: number | null;
  significant: boolean;
}
