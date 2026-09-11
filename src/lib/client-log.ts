/**
 * Browser-side error reporting to the dashboard's log relay
 * (/api/client-log), which re-emits into the shared log sink. Fire-and-forget,
 * self-throttled, and never throws — reporting must never cause new errors,
 * and a failure of the relay itself is never reported (no loops).
 */

const WINDOW_MS = 60_000;
const WINDOW_MAX = 20;

let windowStart = 0;
let windowCount = 0;

export interface ClientErrorFields {
  reason?: string;
  path?: string;
  status?: number;
  request_id?: string;
  stack?: string;
  source?: string;
}

export function reportClientError(event: string, fields: ClientErrorFields = {}): void {
  try {
    const now = Date.now();
    if (now - windowStart > WINDOW_MS) {
      windowStart = now;
      windowCount = 0;
    }
    if (++windowCount > WINDOW_MAX) return;

    void fetch('/api/client-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, ...fields }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* never throw from error reporting */
  }
}

let installed = false;

/** Global catchers for errors nothing else handled (window scope). */
export function installGlobalErrorReporting(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (e) => {
    reportClientError('unhandled_error', {
      reason: String(e.message ?? 'unknown').slice(0, 300),
      source: 'window.onerror',
      path: location.pathname,
      ...(e.error instanceof Error && e.error.stack
        ? { stack: e.error.stack.slice(0, 4000) }
        : {}),
    });
  });

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason instanceof Error ? `${e.reason.name}:${e.reason.message}` : String(e.reason);
    reportClientError('unhandled_rejection', {
      reason: reason.slice(0, 300),
      source: 'unhandledrejection',
      path: location.pathname,
    });
  });
}
