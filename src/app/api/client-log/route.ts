import { NextResponse } from 'next/server';

/**
 * Log relay: receives browser-side errors from the dashboard and re-emits
 * them on the server's stdout in the shared one-JSON-object-per-line envelope
 * (same shape as the API/AI services), so client failures land in the same
 * log sink and are traceable by request_id.
 *
 * Untrusted input: every field is sanitized, capped, and allowlisted. Never
 * returns an error body the client would act on — best-effort by design.
 */

const MAX_BODY_BYTES = 8 * 1024;
const ALLOWED_FIELDS = new Set([
  'reason',
  'path',
  'status',
  'request_id',
  'stack',
  'source',
]);

const CONTROL_CHARS = new RegExp('[\\u0000-\\u001F\\u007F]+', 'g');

// Best-effort per-instance flood guard (the client also throttles itself).
let windowStart = Date.now();
let windowCount = 0;
const WINDOW_MS = 60_000;
const WINDOW_MAX = 120;

export async function POST(req: Request): Promise<NextResponse> {
  try {
    if (flooded()) return NextResponse.json({ ok: true });

    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ ok: true });
    const body = JSON.parse(raw) as Record<string, unknown>;

    const output: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level: 'error',
      service: 'landing-optimizer-dashboard',
      logger: 'client',
      event: clean(String(body['event'] ?? 'client_error'), 128),
    };
    for (const [key, value] of Object.entries(body)) {
      if (!ALLOWED_FIELDS.has(key)) continue;
      output[key] =
        typeof value === 'number' && Number.isFinite(value)
          ? value
          : clean(String(value), key === 'stack' ? 4000 : 300);
    }
    process.stdout.write(`${JSON.stringify(output)}\n`);
  } catch {
    /* a broken report must never become a client-visible error */
  }
  return NextResponse.json({ ok: true });
}

function flooded(): boolean {
  const now = Date.now();
  if (now - windowStart > WINDOW_MS) {
    windowStart = now;
    windowCount = 0;
  }
  windowCount += 1;
  return windowCount > WINDOW_MAX;
}

/** Collapse control characters and cap length (mirrors the API sanitizer). */
function clean(value: string, maxLength: number): string {
  return value.replace(CONTROL_CHARS, ' ').trim().slice(0, maxLength);
}
