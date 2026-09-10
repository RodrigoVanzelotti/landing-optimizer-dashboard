import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, setAccessToken } from '../src/lib/api';

afterEach(() => {
  setAccessToken(null);
  vi.restoreAllMocks();
});

describe('api request bodies', () => {
  it('does not send JSON content type for a bodyless POST', async () => {
    const fetchMock = mockFetch({ count: 1, score: 75 });

    await api.post('/sites/site-1/ai/analyze');

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.body).toBeUndefined();
    expect(new Headers(init.headers).has('Content-Type')).toBe(false);
  });

  it('sets JSON content type when a body is present', async () => {
    const fetchMock = mockFetch({ ok: true });

    await api.post('/experiments', { name: 'Headline test' });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.body).toBe('{"name":"Headline test"}');
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
  });

  it('preserves explicitly supplied falsy JSON values', async () => {
    const fetchMock = mockFetch({ ok: true });

    await api.post('/example', false);

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.body).toBe('false');
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
  });
});

function mockFetch(payload: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => payload,
  } as Response);
}