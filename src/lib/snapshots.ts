import { api, ApiRequestError } from './api';

export async function uploadSnapshotFile(file: Pick<File, 'size' | 'text'>, siteId: string, screenshot?: File): Promise<void> {
  if (file.size > 6 * 1024 * 1024) throw new Error('O arquivo deve ter no máximo 6 MB. Gere uma nova captura.');
  let snapshot: unknown;
  try { snapshot = JSON.parse(await file.text()); }
  catch { throw new Error('Arquivo inválido. Selecione o arquivo JSON baixado pela captura.'); }
  if (!snapshot || typeof snapshot !== 'object' || !('siteId' in snapshot) || snapshot.siteId !== siteId) {
    throw new Error('Esta captura pertence a outro site. Selecione o site correto ou gere uma nova captura.');
  }
  if (screenshot) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(screenshot.type) || screenshot.size > 3 * 1024 * 1024 || !screenshot.size) {
      throw new Error('Use um screenshot PNG, JPEG ou WebP de até 3 MB.');
    }
    if (!('width' in snapshot) || !('height' in snapshot) || typeof snapshot.width !== 'number' || typeof snapshot.height !== 'number' || !Number.isInteger(snapshot.width) || !Number.isInteger(snapshot.height) || snapshot.width < 200 || snapshot.width > 4000 || snapshot.height < 200 || snapshot.height > 40000) {
      throw new Error('O JSON não contém dimensões válidas. Gere uma nova captura.');
    }
    let bitmap: ImageBitmap;
    try { bitmap = await createImageBitmap(screenshot); }
    catch { throw new Error('Não foi possível ler a imagem. Selecione outro screenshot.'); }
    try {
      // Allow pixel rounding, never stretch a viewport-only image over a full-page map.
      if (Math.abs(bitmap.height * snapshot.width / bitmap.width - snapshot.height) > 2) {
        throw new Error('A proporção da imagem não corresponde ao JSON. Capture a página inteira com a mesma largura e conteúdo.');
      }
      const scale = Math.min(1, snapshot.width / bitmap.width, snapshot.height / bitmap.height, Math.sqrt(24_000_000 / (bitmap.width * bitmap.height)));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(bitmap.width * scale));
      canvas.height = Math.max(1, Math.floor(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Não foi possível preparar a imagem neste navegador.');
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/webp', 0.9);
      const image = dataUrl.split(',')[1];
      if (!image || image.length > 4 * 1024 * 1024) throw new Error('A imagem preparada excede 3 MB. Reduza o tamanho do screenshot e tente novamente.');
      snapshot = { ...snapshot, image, contentType: dataUrl.startsWith('data:image/webp') ? 'image/webp' : 'image/png' };
    } finally { bitmap.close(); }
  }
  try { await api.post('/snapshots', snapshot); }
  catch (error) {
    if (error instanceof ApiRequestError && error.status === 403) throw new Error('Sua conta não tem permissão para enviar capturas deste site.');
    if (error instanceof ApiRequestError && error.status === 429) throw new Error('Limite de capturas atingido. Aguarde e tente novamente.');
    if (error instanceof ApiRequestError && error.status === 400) throw new Error('Captura recusada. Gere e selecione um novo arquivo.');
    throw new Error('Não foi possível enviar. Confira sua conexão e selecione o arquivo novamente para tentar.');
  }
}
