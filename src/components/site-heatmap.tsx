'use client';

import { useEffect, useState } from 'react';
import { api, type HeatmapResult, type SnapshotDetail, type SnapshotMeta } from '@/lib/api';
import { DataState } from '@/components/data-state';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { formatMs, HeatmapLegend, type HeatmapLayers } from '@/components/heatmap-overlay';
import { HeatmapViewer } from '@/components/heatmap-viewer';
import { barWidth } from '@/lib/analytics';
import { formatNumber, formatPct } from '@/lib/utils';
import { useSession } from '@/lib/session';
import { canEdit } from '@/lib/permissions';
import { uploadSnapshotFile } from '@/lib/snapshots';

export function SiteHeatmap({ siteId, domain }: { siteId: string; domain?: string }) {
  const user = useSession();
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadError, setUploadError] = useState(false);
  const [captureFile, setCaptureFile] = useState<File | null>(null);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [snapshotId, setSnapshotId] = useState('');
  const [snapshot, setSnapshot] = useState<SnapshotDetail | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [heatmap, setHeatmap] = useState<HeatmapResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [layers, setLayers] = useState<HeatmapLayers>({ clicks: true, hover: true, frustration: true, scroll: true });

  const captureHelp = <details className="my-5 rounded-lg border border-border p-4" open={!loading && !snapshots.length}>
    <summary className="cursor-pointer text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Como fazer uma captura do site</summary>
    <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-muted-foreground">
      <li>Com o snippet instalado, abra a página desejada com <code className="break-all rounded bg-muted px-1">https://{domain ?? 'seu-dominio.com'}/?lo_capture=1</code>. Para outra página, mantenha o caminho dela. Se já houver parâmetros, acrescente <code>&amp;lo_capture=1</code>.</li>
      <li>Aguarde o download de <code>landing-optimizer-captura.json</code>. Se aparecer uma falha, siga a orientação exibida e tente novamente.</li>
      <li>Para maior fidelidade, faça também um screenshot de página inteira, sem mudar a largura da janela ou o conteúdo. No Chrome ou Edge: abra as ferramentas do desenvolvedor, desative a simulação de dispositivos, recarregue com <code>lo_capture=1</code> e aguarde o novo JSON. Pressione <kbd>Ctrl+Shift+P</kbd> (Mac: <kbd>Cmd+Shift+P</kbd>), procure <code>Capture full size screenshot</code> e salve a imagem. Aguarde o aviso de captura desaparecer antes de fotografar a página.</li>
      <li>Como editor ou administrador, selecione o JSON abaixo e, se gerou o screenshot, a imagem correspondente. Clique em <strong>Enviar captura</strong>. Gere um novo par de arquivos sempre que o layout mudar.</li>
    </ol>
    <p className="mt-4 text-xs leading-relaxed text-muted-foreground">O JSON remove valores de formulários e elementos com data-lo-ignore. Um screenshot manual não passa por essa proteção: capture uma página sem dados pessoais ou conteúdo privado. Use a mesma página e largura nos dois arquivos; apenas a proporção da imagem pode ser conferida automaticamente.</p>
  </details>;

  const uploadControl = canEdit(user.role) ? <details className="my-5 rounded-lg border border-border p-4" open={!loading && !snapshots.length}>
    <summary className="cursor-pointer text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Enviar ou atualizar captura</summary>
    <form className="mt-4 space-y-3" onSubmit={async event => {
    event.preventDefault();
    if (!captureFile || uploading) return;
    setUploading(true); setUploadError(false); setUploadMessage('Enviando captura…');
    try {
      await uploadSnapshotFile(captureFile, siteId, screenshotFile ?? undefined);
      setUploadMessage('Captura salva. O mapa está sendo atualizado.');
      setAttempt(value => value + 1);
    } catch (error) {
      setUploadError(true);
      setUploadMessage(error instanceof Error ? error.message : 'Não foi possível enviar. Tente novamente.');
    } finally { setUploading(false); }
  }}>
    <label htmlFor="snapshot-upload" className="block text-sm font-medium">Enviar arquivo de captura</label>
    <p id="snapshot-upload-help" className="text-sm text-muted-foreground">Selecione o arquivo JSON baixado pelo site. Limite de 6 MB.</p>
    <input id="snapshot-upload" type="file" accept=".json,application/json" disabled={uploading} aria-describedby="snapshot-upload-help" className="block min-h-11 w-full min-w-0 text-sm file:mr-3 file:min-h-11 file:rounded-md file:border file:border-border file:bg-background file:px-4 file:text-sm hover:file:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" onChange={event => { setCaptureFile(event.target.files?.[0] ?? null); setUploadMessage(''); }} />
    <label htmlFor="screenshot-upload" className="block text-sm font-medium">Screenshot de página inteira (opcional)</label>
    <p id="screenshot-upload-help" className="text-sm text-muted-foreground">PNG, JPEG ou WebP, até 3 MB. Substitui a imagem do JSON e mantém seu mapa de elementos. A imagem precisa corresponder à mesma captura. Consulte o tutorial acima.</p>
    <input id="screenshot-upload" type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} aria-describedby="screenshot-upload-help" className="block min-h-11 w-full min-w-0 text-sm file:mr-3 file:min-h-11 file:rounded-md file:border file:border-border file:bg-background file:px-4 file:text-sm hover:file:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" onChange={event => { setScreenshotFile(event.target.files?.[0] ?? null); setUploadMessage(''); }} />
    <Button type="submit" className="h-11" disabled={!captureFile || uploading}>{uploading ? 'Enviando…' : 'Enviar captura'}</Button>
    {uploadMessage && <p role={uploadError ? 'alert' : 'status'} className="text-sm">{uploadMessage}</p>}
  </form></details> : null;

  useEffect(() => {
    let active = true;
    setLoading(true); setError(false); setSnapshots([]); setSnapshotId('');
    api.get<SnapshotMeta[]>(`/sites/${siteId}/snapshots`).then(list => {
      if (!active) return;
      setSnapshots(list);
      setSnapshotId(list[0]?.id ?? '');
      if (!list.length) setLoading(false);
    }).catch(() => { if (active) { setError(true); setLoading(false); } });
    return () => { active = false; };
  }, [siteId, attempt]);

  useEffect(() => {
    if (!snapshotId) return;
    let active = true;
    let objectUrl = '';
    setLoading(true); setError(false); setSnapshot(null); setHeatmap(null); setImageUrl('');
    Promise.all([
      api.get<SnapshotDetail>(`/sites/${siteId}/snapshots/${snapshotId}`),
      api.getBlob(`/sites/${siteId}/snapshots/${snapshotId}/image`),
    ]).then(async ([detail, blob]) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setSnapshot(detail); setImageUrl(objectUrl);
      const result = await api.get<HeatmapResult>(`/analytics/heatmap?siteId=${encodeURIComponent(siteId)}&path=${encodeURIComponent(detail.urlPath)}`);
      if (active) { setHeatmap(result); setLoading(false); }
    }).catch(() => { if (active) { setError(true); setLoading(false); } });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [siteId, snapshotId]);

  if (error) return <div>{captureHelp}{uploadControl}<DataState error title="Não foi possível carregar o mapa de calor" description="Confira sua conexão e tente novamente. Seus dados continuam salvos." onRetry={() => setAttempt(n => n + 1)} /></div>;
  if (!loading && !snapshots.length) return <div>
    <DataState title="Prepare a primeira captura do site" description="O mapa precisa de uma imagem da página para posicionar as interações. Após instalar o snippet, siga os passos abaixo." />
    {captureHelp}
    {uploadControl}
    <Button variant="outline" className="mt-4 h-11" onClick={() => setAttempt(n => n + 1)}>Já capturei, verificar novamente</Button>
  </div>;

  return <div>
    {captureHelp}
    {uploadControl}
    {snapshots.length > 0 && <div className="mb-5 flex flex-col gap-3">
      <label htmlFor="heatmap-snapshot" className="text-sm font-medium">Captura da página</label>
      <select id="heatmap-snapshot" value={snapshotId} onChange={e => setSnapshotId(e.target.value)} className="h-11 w-full min-w-0 rounded-md border border-border bg-background px-3 text-sm">
        {snapshots.map(s => <option key={s.id} value={s.id}>{s.urlPath} · {new Date(s.capturedAt).toLocaleString('pt-BR')}</option>)}
      </select>
      <fieldset className="mt-2"><legend className="mb-3 text-sm font-medium">Camadas do mapa</legend><div className="flex flex-wrap gap-4">
        {([['clicks', 'Cliques'], ['hover', 'Atenção'], ['frustration', 'Frustração'], ['scroll', 'Rolagem']] as const).map(([key, label]) => <Checkbox key={key} id={`layer-${key}`} label={label} checked={layers[key]} onChange={checked => setLayers(prev => ({ ...prev, [key]: checked }))} />)}
      </div></fieldset>
    </div>}
    {loading ? <DataState loading title="Preparando o mapa de calor…" /> : snapshot && heatmap && <div className="space-y-5">
      {!heatmap.pageViews && !heatmap.elements.length && !heatmap.scrollDepth.length && <DataState title="Captura pronta. Agora faltam as interações." description="A imagem abaixo é a captura do site, ainda sem atividade registrada nos últimos 30 dias. O mapa será preenchido conforme seus visitantes interagirem." />}
      <HeatmapLegend layers={layers} />
      <HeatmapViewer key={snapshot.id} snapshot={snapshot} imageUrl={imageUrl} heatmap={heatmap} layers={layers} />
      <p className="break-words text-xs leading-relaxed text-muted-foreground">Baseado em {formatNumber(heatmap.pageViews)} visualizações em {snapshot.urlPath} nos últimos 30 dias. Captura de {new Date(snapshot.capturedAt).toLocaleString('pt-BR')}.</p>
      {heatmap.scrollDepth.length > 0 && <Card className="shadow-none"><h3 className="mb-4 font-semibold">Até onde as pessoas chegam</h3><ul className="space-y-4">{heatmap.scrollDepth.map(row => <li key={row.bucket}>
        <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm"><span>{row.bucket}% da página</span><span>{formatNumber(row.reached)} eventos · {formatPct(row.pct)} das visualizações</span></div>
        <div aria-hidden="true" className="h-3 rounded bg-muted"><div className="h-full rounded bg-primary" style={{ width: `${barWidth(row.pct, 1)}%` }} /></div>
      </li>)}</ul><p className="mt-4 text-xs text-muted-foreground">Eventos de rolagem em relação às visualizações; não representa visitantes únicos.</p></Card>}
      {!heatmap.elements.length ? <DataState title="Ainda não há interações por elemento" description="Os detalhes de cliques e atenção aparecerão com os primeiros eventos desta página." /> : <Card className="overflow-x-auto shadow-none">
        <table className="w-full min-w-[580px] text-left text-sm"><caption className="sr-only">Interações por elemento, últimos 30 dias</caption><thead className="border-b border-border text-muted-foreground"><tr>{['Elemento', 'Cliques', 'Atenção total', 'Sem resposta', 'Repetidos'].map(h => <th scope="col" key={h} className="px-2 py-3 font-medium">{h}</th>)}</tr></thead><tbody className="divide-y divide-border tabular-nums">{heatmap.elements.map(el => <tr key={el.selector}><th scope="row" className="max-w-sm break-all px-2 py-3 text-left font-mono text-xs font-normal">{el.selector}</th><td className="px-2 py-3">{formatNumber(el.ctaClicks)}</td><td className="px-2 py-3">{formatMs(el.hoverMs)}</td><td className="px-2 py-3">{formatNumber(el.deadClicks)}</td><td className="px-2 py-3">{formatNumber(el.rageClicks)}</td></tr>)}</tbody></table>
      </Card>}
    </div>}
  </div>;
}
