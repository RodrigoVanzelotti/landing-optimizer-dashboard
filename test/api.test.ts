import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ensureSession, getAccessToken, setAccessToken, setUnauthorizedHandler } from '../src/lib/api';

afterEach(() => {
  setAccessToken(null);
  setUnauthorizedHandler(null);
  vi.restoreAllMocks();
});

describe('api request bodies', () => {
  it('uses the dashboard origin and sends its refresh cookie', async () => {
    const fetchMock = mockFetch({ accessToken: 'renewed-access-token' });
    expect(await ensureSession()).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/refresh', {
      method: 'POST', credentials: 'include',
    });
    expect(getAccessToken()).toBe('renewed-access-token');
  });

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

describe('session renewal', () => {
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
