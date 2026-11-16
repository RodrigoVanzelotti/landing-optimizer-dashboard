import { afterEach, expect, it, vi } from 'vitest';
import { getDocument } from 'pdfjs-dist';
import { renderPdfSnapshot } from '../src/lib/pdf-snapshot';

vi.mock('pdfjs-dist', () => ({ getDocument: vi.fn(), GlobalWorkerOptions: {} }));
afterEach(() => vi.restoreAllMocks());

const file = { arrayBuffer: async () => new ArrayBuffer(8) } as File;

it('renders every PDF page into a separate canvas before joining them in order', async () => {
  const cleanup = vi.fn();
  const render = vi.fn().mockReturnValue({ promise: Promise.resolve() });
  const page = { getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }), render, cleanup };
  const destroy = vi.fn();
  vi.mocked(getDocument).mockReturnValue({ promise: Promise.resolve({ numPages: 2, getPage: vi.fn().mockResolvedValue(page) }), destroy } as unknown as ReturnType<typeof getDocument>);
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect: vi.fn(), drawImage } as unknown as CanvasRenderingContext2D);
  const canvas = await renderPdfSnapshot(file, 1200);
  expect([canvas.width, canvas.height]).toEqual([1200, 3200]);
  expect(render).toHaveBeenCalledTimes(2);
  expect(render.mock.calls[0][0].canvas).not.toBe(canvas);
  expect(drawImage.mock.calls.map(call => call.slice(1))).toEqual([[0, 0], [0, 1600]]);
  expect(destroy).toHaveBeenCalled();
});

it.each([[{ name: 'PasswordException' }, 'senha'], [{ name: 'InvalidPDFException' }, 'PDF válido']])('explains unreadable documents and releases their worker', async (error, message) => {
  const destroy = vi.fn();
  vi.mocked(getDocument).mockReturnValue({ promise: Promise.reject(Object.assign(new Error('bad pdf'), error)), destroy } as unknown as ReturnType<typeof getDocument>);
  await expect(renderPdfSnapshot(file, 1200)).rejects.toThrow(message);
  expect(destroy).toHaveBeenCalled();
});

it('rejects excessive page counts before allocating canvases', async () => {
  const destroy = vi.fn();
  vi.mocked(getDocument).mockReturnValue({ promise: Promise.resolve({ numPages: 51 }), destroy } as unknown as ReturnType<typeof getDocument>);
  const create = vi.spyOn(document, 'createElement');
  await expect(renderPdfSnapshot(file, 1200)).rejects.toThrow('50 páginas');
  expect(create).not.toHaveBeenCalled();
  expect(destroy).toHaveBeenCalled();
});
