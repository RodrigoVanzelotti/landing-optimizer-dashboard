import { api, ApiRequestError } from './api';

export async function uploadSnapshotFile(file: Pick<File, 'size' | 'text'>, siteId: string): Promise<void> {
  if (file.size > 6 * 1024 * 1024) throw new Error('O arquivo deve ter no máximo 6 MB. Gere uma nova captura.');
  let snapshot: unknown;
  try { snapshot = JSON.parse(await file.text()); }
  catch { throw new Error('Arquivo inválido. Selecione o arquivo JSON baixado pela captura.'); }
  if (!snapshot || typeof snapshot !== 'object' || !('siteId' in snapshot) || snapshot.siteId !== siteId) {
    throw new Error('Esta captura pertence a outro site. Selecione o site correto ou gere uma nova captura.');
  }
  try { await api.post('/snapshots', snapshot); }
  catch (error) {
    if (error instanceof ApiRequestError && error.status === 403) throw new Error('Sua conta não tem permissão para enviar capturas deste site.');
    if (error instanceof ApiRequestError && error.status === 429) throw new Error('Limite de capturas atingido. Aguarde e tente novamente.');
    if (error instanceof ApiRequestError && error.status === 400) throw new Error('Captura recusada. Gere e selecione um novo arquivo.');
    throw new Error('Não foi possível enviar. Confira sua conexão e selecione o arquivo novamente para tentar.');
  }
}
