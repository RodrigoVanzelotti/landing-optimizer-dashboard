'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, type Overview } from '@/lib/api';
import { useSites } from '@/lib/use-sites';
import { useSession } from '@/lib/session';
import { barWidth, eventLabels, greeting, type EventCount, type SectionRow } from '@/lib/analytics';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { DataState } from '@/components/data-state';
import { SiteHeatmap } from '@/components/site-heatmap';
import { formatNumber, formatPct } from '@/lib/utils';

type Resource<T> = { data?: T; error?: boolean };

export default function OverviewPage() {
  const user = useSession();
  const { sites, loading, error } = useSites();
  const [selected, setSelected] = useState('');
  const siteId = selected || sites[0]?.id || '';
  const site = sites.find(s => s.id === siteId);
  const [hello, setHello] = useState('Olá');
  const [attempt, setAttempt] = useState(0);
  const [overview, setOverview] = useState<Resource<Overview>>({});
  const [events, setEvents] = useState<Resource<EventCount[]>>({});
  const [sections, setSections] = useState<Resource<SectionRow[]>>({});

  useEffect(() => {
    const update = () => setHello(greeting(new Date().getHours()));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!siteId) return;
    let active = true;
    setOverview({}); setEvents({}); setSections({});
    async function load<T>(path: string, set: (value: Resource<T>) => void) {
      try {
        const data = await api.get<T>(`/analytics/${path}?siteId=${encodeURIComponent(siteId)}`);
        if (active) set({ data });
      } catch { if (active) set({ error: true }); }
    }
    void Promise.allSettled([
      load('overview', setOverview), load('funnel', setEvents), load('sections', setSections),
    ]);
    return () => { active = false; };
  }, [siteId, attempt]);

  const retry = () => setAttempt(n => n + 1);
  const metrics = overview.data;
  const hasMetrics = metrics && Object.values(metrics).some(value => value > 0);
  const eventRows = [...(events.data ?? [])].sort((a, b) => b.count - a.count);
  const sectionRows = [...(sections.data ?? [])].sort((a, b) => b.views - a.views);
  const maxEvents = Math.max(0, ...eventRows.map(e => e.count));
  const maxViews = Math.max(0, ...sectionRows.map(s => s.views));
  const name = user.name?.trim().split(/\s+/)[0];

  return (
    <div lang="pt-BR">
      <PageHeader title={`${hello}${name ? `, ${name}` : ''}.`} description="Veja o que atrai atenção, o que gera conversões e onde melhorar a experiência."
        action={<Button variant="outline" className="h-11" onClick={retry} disabled={!siteId}>Atualizar dados</Button>} />
      {error ? <DataState error title="Não foi possível carregar seus sites" description="Confira sua conexão e tente novamente." onRetry={() => window.location.reload()} />
        : loading ? <DataState loading title="Preparando sua visão geral…" />
        : !sites.length ? <DataState title="Vamos conhecer seu primeiro site?" description="Cadastre um site e instale o snippet para começar a acompanhar visitas, conversões e interações. Seus primeiros dados aparecerão aqui." href="/sites" action="Ir para sites" />
        : <>
          <div className="mb-6 flex flex-col gap-4 border-y border-border py-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 sm:max-w-sm">
              <label htmlFor="overview-site" className="mb-2 block text-sm font-medium">Site em análise</label>
              <select id="overview-site" value={siteId} onChange={e => setSelected(e.target.value)} className="h-11 w-full min-w-0 rounded-md border border-border bg-background px-3 text-sm">
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <p className="break-all text-sm text-muted-foreground">{site?.primaryDomain} · Dados agregados, sem perfis individuais</p>
          </div>
          <nav aria-label="Nesta visão geral" className="mb-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {[['indicadores', 'Indicadores'], ['eventos', 'Eventos'], ['secoes', 'Desempenho por seção'], ['heatmap', 'Mapa de calor']].map(([id, label]) => <a key={id} href={`#${id}`} className="inline-flex min-h-11 items-center font-medium text-muted-foreground underline-offset-4 hover:text-primary hover:underline">{label}</a>)}
          </nav>
          <section id="indicadores" className="scroll-mt-6" aria-labelledby="metrics-heading">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2"><h2 id="metrics-heading" className="text-xl font-semibold tracking-tight">Seu site em números</h2><span className="text-sm text-muted-foreground">Últimos 30 dias</span></div>
            {overview.error ? <DataState error title="Os indicadores não carregaram" description="Seus dados continuam salvos. Tente consultar novamente." onRetry={retry} />
              : !metrics ? <DataState loading title="Consultando indicadores…" />
              : !hasMetrics ? <DataState title="Tudo pronto para as primeiras visitas" description="Ainda não recebemos eventos deste site nos últimos 30 dias. Confira a instalação do snippet e visite sua página para iniciar a coleta." href={`/sites/${siteId}`} action="Ver instalação e metas" />
              : <div className="grid gap-6 lg:grid-cols-[1.1fr_2fr]">
                <Card className="flex flex-col justify-between bg-muted/40 p-6 shadow-none sm:p-8">
                  <div><h3 className="text-sm font-medium">Taxa de conversão</h3><p className="mt-4 break-all text-5xl font-semibold tracking-tight tabular-nums sm:text-6xl">{metrics.pageViews > 0 ? formatPct(metrics.conversionRate) : '—'}</p></div>
                  <p className="mt-6 text-sm leading-relaxed text-muted-foreground">{formatNumber(metrics.conversions)} eventos de conversão em {formatNumber(metrics.pageViews)} visualizações. Uma visualização pode gerar mais de uma conversão.</p>
                </Card>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-8 py-4">
                  {[
                    { value: metrics.pageViews, label: 'Visualizações', detail: 'Visitas às suas páginas' },
                    { value: metrics.conversions, label: 'Conversões', detail: 'Eventos de metas atingidas' },
                    { value: metrics.ctaClicks, label: 'Cliques em CTA', detail: 'Interações com chamadas para ação' },
                    { value: metrics.formSubmits, label: 'Formulários enviados', detail: 'Envios registrados pelo snippet' },
                  ].map(({ value, label, detail }) => <div key={label} className="min-w-0 border-b border-border pb-5"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-2 break-all text-3xl font-semibold tracking-tight tabular-nums">{formatNumber(value)}</dd><dd className="mt-2 text-xs leading-relaxed text-muted-foreground">{detail}</dd></div>)}
                </dl>
              </div>}
          </section>
          <section id="eventos" className="mt-10 scroll-mt-6" aria-labelledby="events-heading">
            <h2 id="events-heading" className="text-xl font-semibold tracking-tight">Como as pessoas interagem</h2>
            <p className="mb-5 mt-2 text-sm text-muted-foreground">Volume acumulado por evento. As barras comparam contagens, não etapas de um funil de usuários.</p>
            {events.error ? <DataState error title="Não conseguimos consultar os eventos" description="Tente novamente para visualizar as interações." onRetry={retry} />
              : !events.data ? <DataState loading title="Carregando interações…" />
              : !maxEvents ? <DataState title="As interações vão aparecer aqui" description="Quando o snippet registrar cliques, visitas ou envios de formulário, você poderá comparar o volume de cada evento." href={`/sites/${siteId}`} action="Conferir instalação" />
              : <Card className="shadow-none"><ul className="space-y-5">{eventRows.map(e => <li key={e.event}>
                <div className="mb-2 flex justify-between gap-4 text-sm"><span className="break-all">{eventLabels[e.event] ?? e.event}</span><span className="font-semibold tabular-nums">{formatNumber(e.count)}</span></div>
                <div aria-hidden="true" className="h-5 rounded-sm bg-muted"><div className="h-full rounded-sm bg-primary" style={{ width: `${barWidth(e.count, maxEvents)}%` }} /></div>
              </li>)}</ul></Card>}
          </section>
          <section id="secoes" className="mt-10 scroll-mt-6" aria-labelledby="sections-heading">
            <h2 id="sections-heading" className="text-xl font-semibold tracking-tight">Quais seções merecem atenção</h2>
            <p className="mb-5 mt-2 text-sm text-muted-foreground">Histórico acumulado de visibilidade, tempo de atenção e sinais de frustração.</p>
            {sections.error ? <DataState error title="O desempenho por seção não carregou" description="Tente consultar novamente para comparar as seções." onRetry={retry} />
              : !sections.data ? <DataState loading title="Carregando seções…" />
              : !sectionRows.length ? <DataState title="Ainda estamos conhecendo suas seções" description="As seções aparecerão quando o snippet enviar eventos com identificação de seção. Confira a instalação e aguarde as primeiras interações." href={`/sites/${siteId}`} action="Conferir instalação" />
              : <Card className="overflow-x-auto shadow-none"><table className="w-full min-w-[620px] text-left text-sm"><caption className="sr-only">Comparação de desempenho por seção, histórico acumulado</caption><thead className="border-b border-border text-muted-foreground"><tr>{['Seção / visualizações', 'Cliques sem resposta', 'Cliques repetidos', 'Atenção total'].map(h => <th scope="col" key={h} className="px-3 pb-4 font-medium">{h}</th>)}</tr></thead><tbody className="divide-y divide-border tabular-nums">{sectionRows.map(s => <tr key={s.section}>
                <th scope="row" className="w-2/5 px-3 py-5 text-left font-normal"><div className="flex justify-between gap-4"><span className="max-w-64 break-all font-medium">{s.section || 'Sem identificação'}</span><span>{formatNumber(s.views)}</span></div><div aria-hidden="true" className="mt-3 h-2 rounded bg-muted"><div className="h-full rounded bg-primary/70" style={{ width: `${barWidth(s.views, maxViews)}%` }} /></div></th>
                <td className="px-3 py-5">{formatNumber(s.deadClicks)}</td><td className="px-3 py-5">{formatNumber(s.rageClicks)}</td><td className="px-3 py-5">{formatNumber(Math.round(s.dwellMs / 1000))} s</td>
              </tr>)}</tbody></table><p className="mt-4 text-xs leading-relaxed text-muted-foreground">Cliques sem resposta ocorrem em elementos sem ação; cliques repetidos podem indicar frustração. Atenção total é a soma do tempo registrado, não uma média.</p></Card>}
          </section>
          <section id="heatmap" className="mt-10 scroll-mt-6" aria-labelledby="heatmap-heading"><h2 id="heatmap-heading" className="text-xl font-semibold tracking-tight">Veja a experiência na própria página</h2><p className="mb-5 mt-2 text-sm text-muted-foreground">Explore cliques, atenção, frustração e profundidade de rolagem sobre uma captura do site.</p><SiteHeatmap key={`${siteId}-${attempt}`} siteId={siteId} domain={site?.primaryDomain} /></section>
          <div className="mt-10 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">Transforme estas observações em uma próxima ação.</p><Link href="/experiments" className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4">Acompanhar experimentos</Link></div>
        </>}
    </div>
  );
}
