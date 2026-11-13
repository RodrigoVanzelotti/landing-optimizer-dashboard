'use client';

import { useEffect, useState } from 'react';
import { api, type HeatmapResult, type SnapshotDetail, type SnapshotMeta } from '@/lib/api';
import { DataState } from '@/components/data-state';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { formatMs, HeatmapLegend, HeatmapOverlay, type HeatmapLayers } from '@/components/heatmap-overlay';
import { barWidth } from '@/lib/analytics';
import { formatNumber, formatPct } from '@/lib/utils';

export function SiteHeatmap({ siteId, domain }: { siteId: string; domain?: string }) {
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [snapshotId, setSnapshotId] = useState('');
  const [snapshot, setSnapshot] = useState<SnapshotDetail | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [heatmap, setHeatmap] = useState<HeatmapResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [layers, setLayers] = useState<HeatmapLayers>({ clicks: true, hover: true, frustration: true, scroll: true });

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

  if (error) return <DataState error title="Não foi possível carregar o mapa de calor" description="Confira sua conexão e tente novamente. Seus dados continuam salvos." onRetry={() => setAttempt(n => n + 1)} />;
  if (!loading && !snapshots.length) return <div>
    <DataState title="Prepare a primeira captura do site" description="O mapa precisa de uma imagem da página para posicionar as interações. Após instalar o snippet, siga os passos abaixo." />
    <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-muted-foreground">
      <li>Abra sua página com <code className="break-all rounded bg-muted px-1">https://{domain ?? 'seu-dominio.com'}/?lo_capture=1</code>. Se o endereço já tiver parâmetros, acrescente <code>&amp;lo_capture=1</code>.</li>
      <li>Aguarde a mensagem “captura salva” no canto superior direito da página. A mensagem de preparação ainda não confirma o envio. Se aparecer uma falha, siga a orientação exibida e tente novamente.</li>
      <li>Volte aqui e verifique novamente. As interações serão exibidas conforme forem coletadas.</li>
    </ol>
    <p className="mt-4 text-xs leading-relaxed text-muted-foreground">A captura é executada somente para você. Valores de formulários e elementos com data-lo-ignore são removidos antes do envio.</p>
    <Button variant="outline" className="mt-4 h-11" onClick={() => setAttempt(n => n + 1)}>Já capturei, verificar novamente</Button>
  </div>;

  return <div>
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
      <HeatmapOverlay snapshot={snapshot} imageUrl={imageUrl} heatmap={heatmap} layers={layers} />
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
