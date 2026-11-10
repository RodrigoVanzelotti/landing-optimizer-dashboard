import { afterEach, expect, it, vi } from 'vitest';
import config from '../next.config.mjs';

afterEach(() => { vi.unstubAllEnvs(); });

it('proxies the browser API prefix to the configured backend', async () => {
  vi.stubEnv('API_URL', 'https://backend.example/v1');
  expect(await config.rewrites?.()).toEqual([{
    source: '/api/:path*', destination: 'https://backend.example/v1/:path*',
  }]);
});
