import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

/** Flatten print pages for visual reference; print coordinates cannot locate DOM elements. */
export async function renderPdfSnapshot(file: File, targetWidth: number): Promise<HTMLCanvasElement> {
  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 50) throw new Error('O PDF deve ter no máximo 50 páginas.');
    const pages = [];
    for (let index = 1; index <= pdf.numPages; index++) pages.push(await pdf.getPage(index));
    const viewports = pages.map(page => page.getViewport({ scale: 1 }));
    if (viewports.some(viewport => !Number.isFinite(viewport.width) || !Number.isFinite(viewport.height) || viewport.width <= 0 || viewport.height <= 0)) throw new Error('O PDF contém dimensões inválidas.');
    const width = Math.max(...viewports.map(viewport => viewport.width));
    const height = viewports.reduce((sum, viewport) => sum + viewport.height, 0);
    const scale = Math.min(targetWidth / width, 40000 / height, Math.sqrt(24_000_000 / (width * height)));
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(width * scale);
    canvas.height = Math.floor(height * scale);
    if (canvas.width < 200 || canvas.height < 200) throw new Error('O PDF é longo ou estreito demais. Exporte menos páginas.');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível preparar o PDF neste navegador.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    let offset = 0;
    for (const page of pages) {
      const viewport = page.getViewport({ scale });
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = Math.max(1, Math.floor(viewport.width));
      pageCanvas.height = Math.max(1, Math.floor(viewport.height));
      await page.render({ canvas: pageCanvas, viewport }).promise;
      context.drawImage(pageCanvas, 0, offset);
      offset += pageCanvas.height;
      pageCanvas.width = pageCanvas.height = 0;
      page.cleanup();
    }
    return canvas;
  } catch (error) {
    if (error instanceof Error && error.name === 'PasswordException') throw new Error('O PDF está protegido por senha. Exporte uma cópia sem senha.');
    if (error instanceof Error && (error.message.startsWith('O PDF') || error.message.startsWith('Não foi possível'))) throw error;
    throw new Error('Não foi possível ler o PDF. Selecione um PDF válido, sem senha.');
  } finally { await task.destroy(); }
}
