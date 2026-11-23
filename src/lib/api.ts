/**
 * Typed API client for the control-plane API. Stores the short-lived access
 * token in memory (module scope) and relies on the httpOnly refresh cookie to
 * renew it. Never stores tokens in localStorage.
 */

import { userErrorMessage } from './errors';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api';

let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;
let sessionVersion = 0;

export function setAccessToken(token: string | null): void {
  sessionVersion++;
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
  return tryRefresh();
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
    super(userErrorMessage({ status }));
    this.name = 'ApiRequestError';
  }
}

async function fetchResponse(path: string, init: RequestInit): Promise<Response> {
  try { return await fetch(`${API_URL}${path}`, init); }
  catch (error) { throw new ApiRequestError(0, { code: 'network_error', message: error instanceof Error ? error.message : 'Network request failed' }); }
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

  const res = await fetchResponse(path, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (res.status === 401 && (!path.startsWith('/auth/') || path === '/auth/me' || path === '/auth/logout')) {
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
    throw new ApiRequestError(
      res.status,
      body?.error ?? { code: 'unknown', message: res.statusText },
    );
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = refreshSession().finally(() => { refreshPromise = null; });
  return refreshPromise;
}

async function refreshSession(): Promise<boolean> {
  const version = sessionVersion;
  const res = await fetchResponse('/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  });
  if (version !== sessionVersion) throw new Error('Session changed during renewal');
  if (res.status === 401 || res.status === 403) {
    accessToken = null;
    return false;
  }
  if (!res.ok) throw new ApiRequestError(res.status, { code: 'refresh_failed', message: 'Não foi possível renovar a sessão. Tente novamente.' });
  const data = (await res.json()) as { accessToken?: unknown } | null;
  if (version !== sessionVersion) throw new Error('Session changed during renewal');
  if (!data || typeof data.accessToken !== 'string' || !data.accessToken) throw new Error('Invalid session response');
  accessToken = data.accessToken;
  return true;
}

/** Fetch a binary resource (e.g., a snapshot image) with the same auth flow. */
async function requestBlob(path: string, retry = true): Promise<Blob> {
  const headers = new Headers();
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const res = await fetchResponse(path, { headers, credentials: 'include' });

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
  logout: async (): Promise<void> => {
    try { await request<void>('/auth/logout', { method: 'POST' }); }
    finally { setAccessToken(null); }
  },
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  getBlob: (path: string) => requestBlob(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: jsonBody(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: jsonBody(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: jsonBody(body) }),
  del: <T>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body: jsonBody(body) }),
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
  insightId?: string | null;
  allocation: number;
  riskScore: number;
  createdAt: string;
  expiresAt?: string | null;
  expired?: boolean;
  startedAt?: string | null;
  resultState?: 'pending_validation' | 'ready';
}

export interface Overview {
  pageViews: number;
  conversions: number;
  conversionRate: number;
  ctaClicks: number;
  formSubmits: number;
}

export type AnalyticsTimeframe = '7d' | '30d' | '6m' | '1y';
export interface ImpactTotals {
  control: { exposures: number; conversions: number; rate: number | null };
  variants: { exposures: number; conversions: number; rate: number | null };
  gainPp: number | null;
}
export interface ExperimentImpactReport {
  goal: { id: string; name: string; isFavorite: boolean };
  timeframe: AnalyticsTimeframe;
  range: { from: string; to: string; previousFrom: string; previousTo: string };
  coverage: { availableFrom: string; currentComplete: boolean; previousComplete: boolean };
  current: ImpactTotals; previous: ImpactTotals;
  series: { from: string; to: string; values: ImpactTotals | null }[];
  excludedExposures: number;
  experiments: (ImpactTotals & { id: string; name: string; status: string; startedAt: string; endedAt: string | null; partial: boolean })[];
}
export interface ReportMetrics {
  pageViews: number; sessions: number; ctaClicks: number; conversions: number;
  formSubmits: number; formStarts: number; formCompletions: number;
  formCompletionRate: number | null;
}
export interface AnalyticsReport {
  timeframe: AnalyticsTimeframe;
  timezone: 'UTC'; granularity: 'day' | 'week';
  range: { from: string; to: string; previousFrom: string; previousTo: string };
  coverage: { availableFrom: string; currentComplete: boolean; previousComplete: boolean };
  current: ReportMetrics; previous: ReportMetrics;
  series: { from: string; to: string; previousFrom: string; previousTo: string; current: ReportMetrics | null; previous: ReportMetrics | null }[];
  events: { event: string; count: number }[];
  sections: { section: string; views: number; deadClicks: number; rageClicks: number; dwellMs: number }[];
}

export interface VariantResult {
  decision?: 'collecting' | 'improvement' | 'decline' | 'equivalent';
  variantId: string;
  isControl: boolean;
  exposures: number;
  conversions: number;
  conversionRate: number;
  lift: number | null;
  pValue: number | null;
  significant: boolean;
}

export interface ExperimentResult {
  experimentId: string;
  experiment: Experiment;
  goal: { id: string; name: string } | null;
  variants: (VariantResult & { name: string })[];
}

export interface ExperimentReport {
  experimentId: string;
  experiment: Pick<Experiment, 'id' | 'siteId' | 'name' | 'status'>;
  goal: { id: string; name: string } | null;
  variants: ExperimentResult['variants'];
  series: { date: string; variants: { variantId: string; exposures: number; conversions: number; conversionRate: number | null }[] }[];
  conclusive: boolean;
  coverageComplete: boolean;
  conversionWindowHours: number;
  recordedAt: string;
  plan: { monthlyVisits: number; minimumPerArm: number; estimatedDays: number; relativeEffect: number } | null;
  evidence: { variantId: string; lower: number; upper: number; decision: string }[];
}

export type GoalKind = 'event' | 'url' | 'form_submit';

export interface ConversionGoal {
  id: string;
  siteId: string;
  name: string;
  isFavorite?: boolean;
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

export interface InsightKpi {
  key: string;
  label: string;
  value: number | null;
  unit: 'count' | 'ratio' | 'milliseconds';
  definition: string;
  previousValue?: number | null;
  numerator?: number;
  denominator?: number;
}

export interface InsightSuggestion {
  id: string;
  model: string;
  kind: string;
  riskLevel: string;
  expectedImpact: string | null;
  approvedAt: string | null;
  rejectedAt?: string | null;
  experimentsReadyAt: string | null;
  experiments: { id: string; name: string; status: string }[];
  payload: {
    title?: string;
    detail?: string;
    selector?: string;
    proposedValue?: string;
    experimentProposals?: {
      name?: string;
      type?: 'copy' | 'cta' | 'headline';
      selector: string;
      proposedValue: string;
      originalValue?: string;
    }[];
    kpis?: InsightKpi[];
    designContext?: {
      selector: string;
      pagePath: string;
      capturedAt: string;
      text?: string;
      tag?: string;
      role?: string;
      observation?: string;
    };
    analysisPeriod?: {
      from: string;
      to: string;
      timezone: 'UTC';
      observedFrom: string;
      partial: boolean;
      sessions: number;
      pageViews: number;
      comparison?: { from: string; to: string };
    };
  };
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
