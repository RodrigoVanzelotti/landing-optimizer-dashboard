'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, type AnalyticsReport, type AnalyticsTimeframe, type ReportMetrics } from '@/lib/api';
import { barWidth, changeLabel, eventLabels, timeframeLabels, metricDelta } from '@/lib/analytics';
import { Card } from '@/components/ui/card';
import { DataState } from '@/components/data-state';
import { BarChart } from '@/components/bar-chart';
import { ConversionDrivers } from '@/components/conversion-drivers';
import { TrendChart, dateSpan, metricValue, reportDate } from '@/components/trend-chart';
import { ExperimentImpact } from '@/components/experiment-impact';

export function OverviewAnalytics({ siteId, timeframe, onTimeframeChange, refreshKey }: { siteId: string; timeframe: AnalyticsTimeframe; onTimeframeChange: (value: AnalyticsTimeframe) => void; refreshKey: number }) {
  const [resource, setResource] = useState<{ data?: AnalyticsReport; error?: boolean; scope?: string }>({});
  const [attempt, setAttempt] = useState(0);
  const [metric, setMetric] = useState<keyof ReportMetrics>('pageViews');
  const scope = `${siteId}-${timeframe}-${refreshKey}-${attempt}`;
  useEffect(() => {
    let active = true;
    setResource({ scope });
    api.get<AnalyticsReport>(`/analytics/report?siteId=${encodeURIComponent(siteId)}&timeframe=${timeframe}`)
      .then(data => { if (active) setResource({ data, scope }); })
      .catch(() => { if (active) setResource({ error: true, scope }); });
    return () => { active = false; };
  }, [siteId, timeframe, scope]);
  const report = resource.scope === scope ? resource.data : undefined;
  const retry = () => setAttempt(value => value + 1);
  const choices: { key: keyof ReportMetrics; label: string }[] = [
    { key: 'pageViews', label: 'Visualizações' }, { key: 'sessions', label: 'Sessões' },
    { key: 'formStarts', label: 'Inícios de formulário' }, { key: 'formSubmits', label: 'Envios de formulário' },
    { key: 'conversions', label: 'Conversões' }, { key: 'ctaClicks', label: 'Cliques em CTA' },
  ];
  const selected = choices.find(choice => choice.key === metric)!;
  const comparable = report?.coverage.currentComplete && report.coverage.previousComplete;
  const current = report?.current;
  const previous = report?.previous;
  const maxEvents = Math.max(0, ...(report?.events.map(row => row.count) ?? []));
  const maxViews = Math.max(0, ...(report?.sections.map(row => row.views) ?? []));
  const metrics = current && previous ? [
    { label: 'Sessões', value: current.sessions, previous: previous.sessions },
    { label: 'Visualizações', value: current.pageViews, previous: previous.pageViews },
    { label: 'Conversões', value: current.conversions, previous: previous.conversions },
    { label: 'Conversões / visualização', value: current.pageViews ? current.conversions / current.pageViews : null, previous: previous.pageViews ? previous.conversions / previous.pageViews : null, rate: true },
    { label: 'Cliques em CTA', value: current.ctaClicks, previous: previous.ctaClicks },
    { label: 'CTA / visualização', value: current.pageViews ? current.ctaClicks / current.pageViews : null, previous: previous.pageViews ? previous.ctaClicks / previous.pageViews : null, rate: true },
    { label: 'Inícios de formulário', value: current.formStarts, previous: previous.formStarts },
    { label: 'Formulários concluídos', value: current.formCompletions, previous: previous.formCompletions },
    { label: 'Taxa de conclusão', value: current.formCompletionRate, previous: previous.formCompletionRate, rate: true },
  ] : [];
  const friction = [...(report?.sections ?? [])].map(row => ({
    id: row.section, label: row.section, value: row.views ? (row.deadClicks + row.rageClicks) / row.views * 100 : null,
    detail: `${metricValue(row.deadClicks)} sem resposta + ${metricValue(row.rageClicks)} repetidos · ${metricValue(row.views)} visualizações`,
    tone: 'negative' as const,
  })).sort((a, b) => (b.value ?? -1) - (a.value ?? -1));

  return <div>
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <h2 className="text-xl font-semibold tracking-tight">Indicadores</h2>
      <div className="w-full shrink-0 sm:w-52"><label htmlFor="overview-timeframe" className="mb-2 block text-sm font-medium">Período</label><select id="overview-timeframe" value={timeframe} onChange={event => onTimeframeChange(event.target.value as AnalyticsTimeframe)} className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm">{Object.entries(timeframeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
    </div>
    <ExperimentImpact siteId={siteId} timeframe={timeframe} refreshKey={refreshKey} />
    {resource.scope === scope && resource.error ? <DataState error title="Resultados indisponíveis" description="Confira a conexão e tente novamente." onRetry={retry} />
      : !report || !current || !previous ? <DataState loading title="Carregando indicadores…" /> : <>
        <p className="mb-4 text-xs text-muted-foreground">{dateSpan(report.range.from, report.range.to)} · comparado a {dateSpan(report.range.previousFrom, report.range.previousTo)}</p>
        {!comparable && <div role="status" className="mb-6 rounded-md border border-border bg-muted/40 p-4 text-sm">Histórico parcial desde {reportDate(report.coverage.availableFrom)}. Comparação indisponível.</div>}
        {!maxEvents && !previous.pageViews && <DataState title="Sem eventos no período" description="Amplie o período ou confira a instalação." href={`/sites/${siteId}`} action="Conferir instalação" />}
        <dl className="mb-10 mt-6 grid grid-cols-2 gap-x-6 gap-y-6 lg:grid-cols-3">
          {metrics.map(item => {
            const rawDelta = comparable ? metricDelta(item.value, item.previous, item.rate) : null;
            const delta = rawDelta === null ? null : Math.round(rawDelta * 10) / 10;
            return <div key={item.label} className="min-w-0 border-b border-border pb-4">
              <dt className="text-sm text-muted-foreground">{item.label}</dt>
              <dd className="mt-2 break-words text-3xl font-semibold tracking-tight tabular-nums">{metricValue(item.value, item.rate)}</dd>
              <dd className={`mt-2 text-sm font-semibold tabular-nums ${delta !== null && delta > 0 ? 'text-green-700' : delta !== null && delta < 0 ? 'text-red-700' : 'text-muted-foreground'}`}>{comparable ? changeLabel(item.value, item.previous, item.rate) : 'Sem comparação'}</dd>
              <dd className="mt-1 text-xs tabular-nums text-muted-foreground">Anterior: {metricValue(item.previous, item.rate)}</dd>
            </div>;
          })}
        </dl>
        <section aria-labelledby="traffic-heading" className="mb-10">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><h3 id="traffic-heading" className="text-lg font-semibold">Evolução</h3><div className="w-full sm:max-w-64"><label htmlFor="trend-metric" className="mb-2 block text-sm font-medium">Métrica</label><select id="trend-metric" value={metric} onChange={event => setMetric(event.target.value as keyof ReportMetrics)} className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm">{choices.map(choice => <option key={choice.key} value={choice.key}>{choice.label}</option>)}</select></div></div>
          <Card className="shadow-none"><TrendChart report={report} metric={metric} label={selected.label} /></Card>
        </section>
        {comparable && <Card className="mb-10 shadow-none"><ConversionDrivers current={current} previous={previous} /></Card>}
        <section aria-labelledby="journey-heading" className="mb-10">
          <h3 id="journey-heading" className="mb-5 text-lg font-semibold">Conclusão de formulários</h3>
          {!current.formStarts ? <DataState title="Sem inícios de formulário" description="Registre form_start e form_submit com a identificação do formulário." /> : <Card className="shadow-none"><ol className="space-y-6">
            {[{ label: 'Iniciaram', count: current.formStarts }, { label: 'Enviaram após iniciar', count: current.formCompletions }].map(step => <li key={step.label}><div className="mb-2 flex justify-between gap-4 text-sm"><span>{step.label}</span><span className="font-semibold tabular-nums">{metricValue(step.count)} sessões</span></div><div aria-hidden className="h-6 rounded-sm bg-muted"><div className="h-full rounded-sm bg-primary" style={{ width: `${barWidth(step.count, current.formStarts)}%` }} /></div></li>)}
          </ol><p className="mt-6 text-sm"><strong className="tabular-nums">{metricValue(current.formStarts - current.formCompletions)} sessões ({metricValue(1 - current.formCompletionRate!, true)})</strong> sem envio observado.</p>
          <details className="mt-4 text-xs leading-relaxed text-muted-foreground"><summary className="min-h-11 cursor-pointer py-3">Como a jornada é contada</summary><p>Uma sessão por jornada; início e envio do mesmo formulário e página, em ordem. Envios fora do período ou bloqueados não aparecem. O envio observado não confirma aceitação pelo servidor nem saída do visitante.</p></details></Card>}
          <h4 className="mb-4 mt-6 text-sm font-medium">Taxa de conclusão no tempo</h4><Card className="shadow-none"><TrendChart report={report} metric="formCompletionRate" label="Taxa de conclusão de formulários" rate /></Card>
        </section>
        <section id="eventos" aria-labelledby="events-heading" className="mb-10"><h3 id="events-heading" className="mb-5 text-lg font-semibold">Eventos</h3>
          {!maxEvents ? <DataState title="Sem eventos no período" description="Amplie o período ou aguarde a coleta." /> : <Card className="shadow-none"><BarChart title="Volume por evento" description="Eventos, incluindo ações repetidas" rows={[...report.events].sort((a, b) => b.count - a.count).map(row => ({ id: row.event, label: eventLabels[row.event] ?? row.event, value: row.count }))} /></Card>}
        </section>
        <section id="secoes" aria-labelledby="sections-heading"><h3 id="sections-heading" className="mb-5 text-lg font-semibold">Seções</h3>
          {!report.sections.length ? <DataState title="Sem dados por seção" description="Identifique as seções nos eventos do código de rastreamento." /> : <>
            <Card className="mb-6 shadow-none"><BarChart title="Fricção por seção" description="Cliques sem resposta + repetidos / 100 visualizações" rows={friction} formatValue={value => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} /><details className="mt-4 text-xs leading-relaxed text-muted-foreground"><summary className="min-h-11 cursor-pointer py-3">Como interpretar</summary><p>Frequência de eventos, não porcentagem de visitantes. Pode superar 100. Compare a amostra antes de priorizar.</p></details></Card>
            <Card className="overflow-x-auto shadow-none"><table className="w-full min-w-[620px] text-left text-sm"><caption className="sr-only">Desempenho por seção no período selecionado</caption><thead className="border-b border-border text-muted-foreground"><tr>{['Seção / visualizações', 'Sem resposta', 'Repetidos', 'Atenção total'].map(title => <th key={title} scope="col" className="px-3 pb-4 font-medium">{title}</th>)}</tr></thead><tbody className="divide-y divide-border tabular-nums">{report.sections.map(row => <tr key={row.section}><th scope="row" className="w-2/5 px-3 py-5 text-left font-normal"><div className="flex justify-between gap-4"><span className="max-w-64 break-all font-medium">{row.section}</span><span>{metricValue(row.views)}</span></div><div aria-hidden className="mt-3 h-2 rounded bg-muted"><div className="h-full rounded bg-primary/70" style={{ width: `${barWidth(row.views, maxViews)}%` }} /></div></th><td className="px-3 py-5">{metricValue(row.deadClicks)}</td><td className="px-3 py-5">{metricValue(row.rageClicks)}</td><td className="px-3 py-5">{metricValue(Math.round(row.dwellMs / 1000))} s</td></tr>)}</tbody></table><p className="mt-4 text-xs text-muted-foreground">Atenção = tempo acumulado, não média.</p></Card>
          </>}
        </section>
        <details className="mt-8 text-xs leading-relaxed text-muted-foreground"><summary className="min-h-11 cursor-pointer py-3">Definições e cobertura</summary><p>Dias completos em UTC, excluindo hoje e bots conhecidos. Histórico ausente é uma lacuna, não zero. Taxas de eventos = eventos / visualizações; ações podem se repetir. A conclusão usa sessões que iniciaram e enviaram o mesmo formulário; agrupamento pela data do primeiro início. Mudanças de taxas em pontos percentuais. Contagem anterior zero não tem variação percentual finita.</p></details>
        <Link href="/experiments" className="mt-6 inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4">Experimentos</Link>
      </>}
  </div>;
}
