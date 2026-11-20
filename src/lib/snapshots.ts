import { api, ApiRequestError } from './api';

export function selectSnapshotFiles(files: File[]): { capture?: File; visual?: File } {
  const selected: { capture?: File; visual?: File } = {};
  for (const file of files) {
    const isJson = file.name.toLowerCase().endsWith('.json') || file.type === 'application/json';
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = ['image/png', 'image/jpeg', 'image/webp'].includes(file.type);
    if (!isJson && !isPdf && !isImage) throw new Error('Use JSON ou PDF até 6 MB, ou PNG, JPEG ou WebP até 3 MB.');
    const key = isJson ? 'capture' : 'visual';
    if (selected[key]) throw new Error('Envie um JSON e apenas uma imagem ou PDF por captura.');
    const maxMb = isJson || isPdf ? 6 : 3;
    if (!file.size || file.size > maxMb * 1024 * 1024) throw new Error(`${file.name}: limite de ${maxMb} MB. Selecione outro arquivo.`);
    selected[key] = file;
  }
  return selected;
}

export async function uploadSnapshotFile(file: Pick<File, 'size' | 'text'>, siteId: string, screenshot?: File): Promise<void> {
  if (file.size > 6 * 1024 * 1024) throw new Error('O arquivo deve ter no máximo 6 MB. Gere uma nova captura.');
  let parsed: unknown;
  try { parsed = JSON.parse(await file.text()); }
  catch { throw new Error('Arquivo inválido. Selecione o arquivo JSON baixado pela captura.'); }
  if (!parsed || typeof parsed !== 'object' || !('siteId' in parsed) || parsed.siteId !== siteId) {
    throw new Error('Esta captura pertence a outro site. Selecione o site correto ou gere uma nova captura.');
  }
  let snapshot: Record<string, unknown> = { ...parsed };
  if (screenshot) {
    const isPdf = screenshot.type === 'application/pdf' || screenshot.name.toLowerCase().endsWith('.pdf');
    selectSnapshotFiles([screenshot]);
    if (!isPdf && !['image/png', 'image/jpeg', 'image/webp'].includes(screenshot.type)) throw new Error('Use uma captura de tela PNG, JPEG ou WebP de até 3 MB.');
    if (!('width' in snapshot) || !('height' in snapshot) || typeof snapshot.width !== 'number' || typeof snapshot.height !== 'number' || !Number.isInteger(snapshot.width) || !Number.isInteger(snapshot.height) || snapshot.width < 200 || snapshot.width > 4000 || snapshot.height < 200 || snapshot.height > 40000) {
      throw new Error('O JSON não contém dimensões válidas. Gere uma nova captura.');
    }
    let canvas: HTMLCanvasElement;
    if (isPdf) {
      const { renderPdfSnapshot } = await import('./pdf-snapshot');
      canvas = await renderPdfSnapshot(screenshot, snapshot.width);
      snapshot = { ...snapshot, width: canvas.width, height: canvas.height, nodes: [] };
    } else {
      let bitmap: ImageBitmap;
      try { bitmap = await createImageBitmap(screenshot); }
      catch { throw new Error('Não foi possível ler a imagem. Selecione outra captura de tela.'); }
      try {
        // Allow pixel rounding, never stretch a viewport-only image over a full-page map.
        if (Math.abs(bitmap.height * snapshot.width / bitmap.width - snapshot.height) > 2) {
          throw new Error('A proporção da imagem não corresponde ao JSON. Capture a página inteira com a mesma largura e conteúdo.');
        }
        const scale = Math.min(1, snapshot.width / bitmap.width, snapshot.height / bitmap.height, Math.sqrt(24_000_000 / (bitmap.width * bitmap.height)));
        canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.floor(bitmap.width * scale));
        canvas.height = Math.max(1, Math.floor(bitmap.height * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Não foi possível preparar a imagem neste navegador.');
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      } finally { bitmap.close(); }
    }
    const dataUrl = canvas.toDataURL('image/webp', 0.9);
    const image = dataUrl.split(',')[1];
    if (!image || image.length > 4 * 1024 * 1024) throw new Error('A imagem preparada excede 3 MB. Reduza o tamanho da captura de tela ou exporte menos páginas do PDF.');
    snapshot = { ...snapshot, image, contentType: dataUrl.startsWith('data:image/webp') ? 'image/webp' : 'image/png' };
  }
  try { await api.post('/snapshots', snapshot); }
  catch (error) {
    if (error instanceof ApiRequestError && error.status === 403) throw new Error('Sua conta não tem permissão para enviar capturas deste site.');
    if (error instanceof ApiRequestError && error.status === 429) throw new Error('Limite de capturas atingido. Aguarde e tente novamente.');
    if (error instanceof ApiRequestError && error.status === 400) throw new Error('Captura recusada. Gere e selecione um novo arquivo.');
    throw new Error('Não foi possível enviar. Confira sua conexão e selecione o arquivo novamente para tentar.');
  }
}
