/**
 * Typed API client for the control-plane API. Stores the short-lived access
 * token in memory (module scope) and relies on the httpOnly refresh cookie to
 * renew it. Never stores tokens in localStorage.
 */

import { reportClientError } from './client-log';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1';

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

let onAuthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onAuthorized = handler;
}

export async function ensureSession(): Promise<boolean> {
  if (accessToken) return true;
  return tryRefresh()
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
  const headers = new Headers(init.headers);
  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  if (init.body !== undefined && init.body !== null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      credentials: 'include',
    });
  } catch (err) {
    // Network-level failure: the API never saw it, so the relay log is the
    // only trace of the incident.
    reportClientError('api_unreachable', {
      path,
      reason: err instanceof Error ? `${err.name}:${err.message}`.slice(0, 300) : 'unknown',
      source: 'api-client',
    });
    throw err;
  }

  if (res.status === 401 && !path.startsWith('/auth/')) {
    // Attempt a silent refresh once, then replay the request.
    if (retry) {
      const refreshed = await tryRefresh();
      if (refreshed) {
        return request<T>(path, { ...options, retry: false });
      }
    }
    accessToken = null;
    onAuthorized?.();
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: ApiError } | null;
    if (res.status >= 500) {
      // 5xx: the API already logged its own request_failed record; this adds
      // the browser-side view under the SAME request id for correlation.
      reportClientError('api_request_failed', {
        path,
        status: res.status,
        reason: body?.error?.code ?? 'unknown',
        request_id: res.headers.get('X-Request-ID') ?? undefined,
        source: 'api-client',
      });
    }
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

/** Fetch a binary resource (e.g., a snapshot image) with the same auth flow. */
async function requestBlob(path: string, retry = true): Promise<Blob> {
  const headers = new Headers();
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const res = await fetch(`${API_URL}${path}`, { headers, credentials: 'include' });

  if (res.status === 401) {
    if (retry && (await tryRefresh())) return requestBlob(path, false);
    accessToken = null;
    onAuthorized?.();
  }
  if (!res.ok) {
    throw new ApiRequestError(res.status, { code: 'unknown', message: res.statusText });
  }
  return res.blob();
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  getBlob: (path: string) => requestBlob(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: jsonBody(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: jsonBody(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: jsonBody(body) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

function jsonBody(body: unknown): string | undefined {
  return body === undefined ? undefined : JSON.stringify(body);
}

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

export type GoalKind = 'event' | 'url' | 'form_submit';

export interface ConversionGoal {
  id: string;
  siteId: string;
  name: string;
  kind: GoalKind;
  matcher: Record<string, unknown>;
  createdAt: string;
}

export interface GuardrailRules {
  tone?: string;
  bannedWords?: string[];
  maxLength?: number;
  mustKeepClaims?: string[];
}

export interface GuardrailView {
  siteId: string;
  rules: GuardrailRules;
  updatedAt: string | null;
}

/* ------------------------------ heatmap types ----------------------------- */

/** Document-space bounding box [x, y, width, height] in CSS pixels. */
export type SnapshotRect = [number, number, number, number];

export interface SnapshotNode {
  selector: string;
  role: string;
  rect: SnapshotRect;
}

export interface SnapshotMeta {
  id: string;
  urlPath: string;
  width: number;
  height: number;
  contentType: string;
  nodeCount: number;
  capturedAt: string;
}

export interface SnapshotDetail extends SnapshotMeta {
  nodes: SnapshotNode[];
}

export interface HeatmapElement {
  selector: string;
  ctaClicks: number;
  deadClicks: number;
  rageClicks: number;
  hoverMs: number;
  hoverEvents: number;
}

export interface HeatmapResult {
  pageViews: number;
  elements: HeatmapElement[];
  scrollDepth: { bucket: number; reached: number; pct: number }[];
}

/* ------------------------------ journey types ----------------------------- */

export type MilestoneId =
  | 'site_created'
  | 'snippet_installed'
  | 'traffic'
  | 'goal_defined'
  | 'conversion_tracked'
  | 'snapshot_captured'
  | 'heatmap_ready'
  | 'ai_ready'
  | 'experiment_created'
  | 'experiment_live'
  | 'results_ready';

export interface JourneyMilestone {
  id: MilestoneId;
  done: boolean;
  current?: number;
  target?: number;
}

export interface Journey {
  siteId: string;
  firstEventAt: string | null;
  lastEventAt: string | null;
  completed: number;
  total: number;
  milestones: JourneyMilestone[];
}
