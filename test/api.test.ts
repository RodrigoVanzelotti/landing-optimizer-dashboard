import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiRequestError, ensureSession, getAccessToken, setAccessToken, setUnauthorizedHandler } from '../src/lib/api';
import { userErrorMessage } from '../src/lib/errors';

afterEach(() => {
  setAccessToken(null);
  setUnauthorizedHandler(null);
  vi.restoreAllMocks();
});

it.each([400, 403, 404, 409, 422, 429, 500])('hides technical response messages for HTTP %s while retaining structured diagnostics', async status => {
  const technical = 'Validation failed: database internals must not be displayed';
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: { code: 'internal_error', message: technical } }, { status }));
  try {
    await api.post('/experiments/experiment/pause');
    throw new Error('Expected request failure');
  } catch (error) {
    expect(error).toBeInstanceOf(ApiRequestError);
    expect((error as ApiRequestError).message).toBe(userErrorMessage({ status }));
    expect((error as ApiRequestError).message).not.toContain(technical);
    expect((error as ApiRequestError).error.message).toBe(technical);
  }
});

it('does not expose arbitrary network or runtime errors in user-facing experiment feedback', () => {
  expect(userErrorMessage(new Error('Validation failed'))).not.toContain('Validation failed');
});

it('replaces technical fetch failures with safe feedback without losing diagnostics', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch internal network details'));
  await expect(api.get('/experiments')).rejects.toMatchObject({ status: 0, message: userErrorMessage(null), error: { code: 'network_error', message: 'Failed to fetch internal network details' } });
});

describe('api request bodies', () => {
  it('supports a deletion confirmation body and preserves bodyless DELETE callers', async () => {
    const fetchMock = mockFetch({});
    await api.del('/sites/site', { confirmation: 'example.test' });
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'DELETE', body: '{"confirmation":"example.test"}' });
    await api.del('/sites/site/origins/origin');
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBeUndefined();
  });
  it('uses the dashboard origin and sends its refresh cookie', async () => {
    const fetchMock = mockFetch({ accessToken: 'renewed-access-token' });
    expect(await ensureSession()).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/refresh', {
      method: 'POST', credentials: 'include',
    });
    expect(getAccessToken()).toBe('renewed-access-token');
  });

  it('does not send JSON content type for a bodyless POST', async () => {
    const fetchMock = mockFetch({ approvedAt: '2026-11-21T12:00:00Z', experimentsReadyAt: null, experiments: [] });

    await api.post('/ai/suggestions/insight-1/approve');

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

describe('session renewal', () => {
  it('keeps the tab customer scope across renewal and image requests, and clears it on logout', async () => {
    vi.resetModules();
    const { api: scopedApi, ensureSession: loadSession } = await import('../src/lib/api');
    window.sessionStorage.setItem('lo_customer_scope', 'customer-grant');
    let refreshes = 0;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const headers = new Headers(init?.headers);
      if (url === '/api/auth/refresh') {
        expect(headers.has('X-Customer-Scope')).toBe(false);
        return Response.json({ accessToken: ++refreshes === 1 ? 'expired' : 'renewed' });
      }
      if (url === '/api/auth/logout') {
        expect(headers.has('X-Customer-Scope')).toBe(false);
        return new Response(null, { status: 204 });
      }
      expect(headers.get('X-Customer-Scope')).toBe('customer-grant');
      if (headers.get('Authorization') === 'Bearer expired') return new Response(null, { status: 401 });
      return url === '/api/image' ? new Response('image') : Response.json([{ id: 'customer-site' }]);
    });
    expect(await loadSession()).toBe(true);
    expect(await scopedApi.get('/sites')).toEqual([{ id: 'customer-site' }]);
    const image = await scopedApi.getBlob('/image');
    expect(await image.text()).toBe('image');
    await scopedApi.logout();
    expect(window.sessionStorage.getItem('lo_customer_scope')).toBeNull();
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/auth/refresh')).toHaveLength(2);
  });

  it.each([null, 'new-login'])('does not restore a stale refresh after the session changes to %s', async (token) => {
    let resolve!: (response: Response) => void;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>(done => { resolve = done; }));
    const refresh = ensureSession();
    setAccessToken(token);
    resolve(Response.json({ accessToken: 'stale-token' }));
    await expect(refresh).rejects.toThrow('Session changed');
    expect(getAccessToken()).toBe(token);
  });
  it('renews /auth/me after inactivity and replays it with the new token', async () => {
    setAccessToken('expired');
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ accessToken: 'renewed' }))
      .mockResolvedValueOnce(Response.json({ id: 'user' }));

    expect(await api.get('/auth/me')).toEqual({ id: 'user' });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/auth/me', '/api/auth/refresh', '/api/auth/me']);
    expect(new Headers(fetchMock.mock.calls[2][1]?.headers).get('Authorization')).toBe('Bearer renewed');
  });

  it('shares one renewal across simultaneous JSON and image requests', async () => {
    setAccessToken('expired');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      if (url === '/api/auth/refresh') return Response.json({ accessToken: 'renewed' });
      if (new Headers(init?.headers).get('Authorization') === 'Bearer expired') return new Response(null, { status: 401 });
      return url === '/api/image' ? new Response('image') : Response.json({ id: 'user' });
    });

    await Promise.all([api.get('/auth/me'), api.get('/sites'), api.getBlob('/image')]);

    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/auth/refresh')).toHaveLength(1);
    expect(getAccessToken()).toBe('renewed');
  });

  it.each(['network', 'server'])('does not discard the session on a temporary %s renewal failure', async (failure) => {
    setAccessToken('expired');
    const unauthorized = vi.fn();
    setUnauthorizedHandler(unauthorized);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status: 401 }));
    if (failure === 'network') fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    else fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));

    await expect(api.get('/auth/me')).rejects.toThrow();
    expect(unauthorized).not.toHaveBeenCalled();
    expect(getAccessToken()).toBe('expired');

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ accessToken: 'renewed' }))
      .mockResolvedValueOnce(Response.json({ id: 'user' }));
    await expect(api.get('/auth/me')).resolves.toEqual({ id: 'user' });
  });

  it('only treats explicit refresh rejection as an expired session', async () => {
    const unauthorized = vi.fn();
    setUnauthorizedHandler(unauthorized);
    setAccessToken('expired');
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));

    await expect(api.get('/auth/me')).rejects.toMatchObject({ status: 401 });
    expect(unauthorized).toHaveBeenCalledOnce();
    expect(getAccessToken()).toBeNull();
  });

  it('does not renew invalid login credentials', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 401 }));
    await expect(api.post('/auth/login', { email: 'user@example.com', password: 'wrong' })).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('distinguishes unavailable startup renewal from a missing session', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status: 503 }));
    await expect(ensureSession()).rejects.toMatchObject({ status: 503 });
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    expect(await ensureSession()).toBe(false);
  });
});

describe('logout', () => {
  it('sends the bearer token and refresh cookie, handles 204 and clears the token', async () => {
    setAccessToken('access-token');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));

    await api.logout();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/logout');
    expect(init?.method).toBe('POST');
    expect(init?.credentials).toBe('include');
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer access-token');
    expect(getAccessToken()).toBeNull();
  });

  it('renews an expired access token and retries logout once', async () => {
    setAccessToken('expired-token');
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ accessToken: 'renewed-token' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await api.logout();

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/auth/logout', '/api/auth/refresh', '/api/auth/logout',
    ]);
    expect(new Headers(fetchMock.mock.calls[2][1]?.headers).get('Authorization')).toBe('Bearer renewed-token');
    expect(getAccessToken()).toBeNull();
  });

  it.each(['network', 'server'])('clears the local token while reporting a %s logout failure', async (failure) => {
    setAccessToken('access-token');
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    if (failure === 'network') fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    else fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));

    await expect(api.logout()).rejects.toThrow();

    expect(getAccessToken()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('stops retrying if logout still returns 401 after refreshing', async () => {
    setAccessToken('expired-token');
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ accessToken: 'renewed-token' }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));

    await expect(api.logout()).rejects.toThrow();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(getAccessToken()).toBeNull();
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
