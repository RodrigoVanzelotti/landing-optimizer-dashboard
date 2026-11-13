import { afterEach, expect, it, vi } from 'vitest';
import config from '../next.config.mjs';

afterEach(() => { vi.unstubAllEnvs(); });

it('proxies the browser API prefix to the configured backend', async () => {
  vi.stubEnv('API_URL', 'https://backend.example/v1');
  expect(await config.rewrites?.()).toEqual([{
    source: '/api/:path*', destination: 'https://backend.example/v1/:path*',
  }]);
});

it('disables embedding, plugins, foreign form targets and sensitive browser capabilities', async () => {
  const rules = await config.headers?.();
  const headers = rules?.find(rule => rule.source === '/:path*')?.headers;
  expect(headers).toContainEqual({ key: 'Content-Security-Policy', value: "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'" });
  expect(headers).toContainEqual({ key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' });
});
