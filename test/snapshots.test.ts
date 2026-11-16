import { afterEach, expect, it, vi } from 'vitest';
import { selectSnapshotFiles, uploadSnapshotFile } from '../src/lib/snapshots';
import { setAccessToken } from '../src/lib/api';
import { renderPdfSnapshot } from '../src/lib/pdf-snapshot';

vi.mock('../src/lib/pdf-snapshot', () => ({ renderPdfSnapshot: vi.fn() }));

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); setAccessToken(null); });

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

it('pairs a real screenshot with the original element map and downsizes retina pixels', async () => {
  const bitmap = { width: 2400, height: 6000, close: vi.fn() };
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/webp;base64,c2NyZWVuc2hvdA==');
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ saved: true }));
  const snapshot = { siteId: 'site', width: 1200, height: 3000, path: '/', nodes: [{ selector: '#cta', rect: [10, 20, 30, 40] }], image: 'old' };
  await uploadSnapshotFile({ size: 100, text: async () => JSON.stringify(snapshot) }, 'site', new File(['png'], 'page.png', { type: 'image/png' }));
  expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 1200, 3000);
  expect(JSON.parse(fetch.mock.calls[0][1]?.body as string)).toEqual({ ...snapshot, image: 'c2NyZWVuc2hvdA==', contentType: 'image/webp' });
  expect(bitmap.close).toHaveBeenCalled();
});

it('rejects a viewport screenshot whose proportions do not match the page map', async () => {
  const bitmap = { width: 1200, height: 800, close: vi.fn() };
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));
  const fetch = vi.spyOn(globalThis, 'fetch');
  await expect(uploadSnapshotFile({ size: 100, text: async () => JSON.stringify({ siteId: 'site', width: 1200, height: 3000 }) }, 'site', new File(['png'], 'page.png', { type: 'image/png' }))).rejects.toThrow('proporção');
  expect(bitmap.close).toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});

it('rejects unsupported or oversized screenshots before decoding or uploading', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch');
  const decode = vi.fn();
  vi.stubGlobal('createImageBitmap', decode);
  for (const screenshot of [new File(['svg'], 'page.svg', { type: 'image/svg+xml' }), new File([new Uint8Array(3 * 1024 * 1024 + 1)], 'page.png', { type: 'image/png' })]) {
    await expect(uploadSnapshotFile({ size: 100, text: async () => '{"siteId":"site"}' }, 'site', screenshot)).rejects.toThrow('3 MB');
  }
  expect(decode).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});

it('selects JSON and PDF together regardless of drag order, and supports separate additions', () => {
  const json = new File(['{}'], 'capture.json', { type: 'application/json' });
  const pdf = new File(['pdf'], 'print.PDF');
  expect(selectSnapshotFiles([pdf, json])).toEqual({ capture: json, visual: pdf });
  expect(selectSnapshotFiles([pdf])).toEqual({ visual: pdf });
  expect(() => selectSnapshotFiles([pdf, new File(['png'], 'page.png', { type: 'image/png' })])).toThrow('apenas uma');
  expect(() => selectSnapshotFiles([json, json])).toThrow('um JSON');
  expect(() => selectSnapshotFiles([new File([], 'empty.pdf')])).toThrow('limite');
});

it('imports a PDF as a visual reference without reusing DOM coordinates from the print layout', async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 1200; canvas.height = 3400;
  vi.mocked(renderPdfSnapshot).mockResolvedValue(canvas);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/webp;base64,cGRm');
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ saved: true }));
  const snapshot = { siteId: 'site', width: 1200, height: 3000, path: '/page', nodes: [{ selector: '#cta', rect: [10, 20, 30, 40] }] };
  const pdf = new File(['pdf'], 'page.pdf', { type: 'application/pdf' });
  await uploadSnapshotFile({ size: 100, text: async () => JSON.stringify(snapshot) }, 'site', pdf);
  expect(renderPdfSnapshot).toHaveBeenCalledWith(pdf, 1200);
  expect(JSON.parse(fetch.mock.calls[0][1]?.body as string)).toEqual({ ...snapshot, height: 3400, nodes: [], image: 'cGRm', contentType: 'image/webp' });
});
