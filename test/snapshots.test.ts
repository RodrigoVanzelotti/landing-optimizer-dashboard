import { afterEach, expect, it, vi } from 'vitest';
import { uploadSnapshotFile } from '../src/lib/snapshots';
import { setAccessToken } from '../src/lib/api';

afterEach(() => { vi.restoreAllMocks(); setAccessToken(null); });

it('uploads the selected site capture with the authenticated dashboard session', async () => {
  setAccessToken('editor-token');
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ saved: true }, { status: 201 }));
  const snapshot = { siteId: 'site', v: 1, image: 'base64' };
  await uploadSnapshotFile({ size: 100, text: async () => JSON.stringify(snapshot) }, 'site');
  expect(fetch.mock.calls[0][0]).toBe('/api/snapshots');
  expect(new Headers(fetch.mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer editor-token');
  expect(JSON.parse(fetch.mock.calls[0][1]?.body as string)).toEqual(snapshot);
});

it('rejects oversized, malformed, and foreign-site files before making a request', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch');
  for (const file of [{ size: 7 * 1024 * 1024, text: async () => '{}' }, { size: 1, text: async () => 'not json' }, { size: 1, text: async () => '{"siteId":"other"}' }, { size: 1, text: async () => 'null' }]) await expect(uploadSnapshotFile(file, 'site')).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});

it.each([[403, 'permissão'], [429, 'Limite'], [400, 'recusada'], [503, 'conexão']] as const)('explains a %i upload failure with a recovery action', async (status, message) => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: { code: 'failure', message: 'Internal API wording' } }, { status }));
  await expect(uploadSnapshotFile({ size: 1, text: async () => '{"siteId":"site"}' }, 'site')).rejects.toThrow(message);
});
