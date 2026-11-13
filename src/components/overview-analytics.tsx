'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, type AnalyticsReport, type AnalyticsTimeframe, type ReportMetrics } from '@/lib/api';
import { barWidth, changeLabel, eventLabels, timeframeLabels } from '@/lib/analytics';
import { Card } from '@/components/ui/card';
import { DataState } from '@/components/data-state';
import { TrendChart, dateSpan, metricValue, reportDate } from '@/components/trend-chart';

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
    { key: 'formStarts', label: 'Sessões com início de formulário' }, { key: 'formSubmits', label: 'Eventos de envio de formulário' },
    { key: 'conversions', label: 'Eventos de conversão' }, { key: 'ctaClicks', label: 'Cliques em CTA' },
  ];
  const selected = choices.find(choice => choice.key === metric)!;
  const comparable = report?.coverage.currentComplete && report.coverage.previousComplete;
  const current = report?.current;
  const maxEvents = Math.max(0, ...(report?.events.map(row => row.count) ?? []));
  const maxViews = Math.max(0, ...(report?.sections.map(row => row.views) ?? []));

  return <div>
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0"><h2 className="text-xl font-semibold tracking-tight">Resultados ao longo do tempo</h2><p className="mt-2 text-sm text-muted-foreground">Compare com o período anterior de mesma duração e encontre perdas no preenchimento de formulários.</p></div>
      <div className="w-full shrink-0 sm:w-52"><label htmlFor="overview-timeframe" className="mb-2 block text-sm font-medium">Período</label><select id="overview-timeframe" value={timeframe} onChange={event => onTimeframeChange(event.target.value as AnalyticsTimeframe)} className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm">{Object.entries(timeframeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
    </div>
    {resource.scope === scope && resource.error ? <DataState error title="Não foi possível consultar os resultados" description="Confira sua conexão e tente novamente. O período selecionado foi mantido." onRetry={retry} />
      : !report || !current ? <DataState loading title="Consultando períodos e jornadas…" /> : <>
        <p className="mb-3 text-sm text-muted-foreground">{dateSpan(report.range.from, report.range.to)} · Comparação: {dateSpan(report.range.previousFrom, report.range.previousTo)}</p>
        <p className="mb-6 text-xs text-muted-foreground">Dias completos em UTC, sem o dia de hoje. {report.granularity === 'day' ? 'Pontos diários.' : 'Pontos em blocos de até 7 dias, alinhados entre os períodos.'} Bots conhecidos excluídos.</p>
        {!comparable && <div role="status" className="mb-6 rounded-md border border-border bg-muted/40 p-4 text-sm leading-relaxed"><p className="font-medium">Histórico parcial para esta comparação</p><p className="mt-1 text-muted-foreground">O histórico disponível começa em {reportDate(report.coverage.availableFrom)}, conforme o cadastro do site e a retenção da base. Os totais consideram somente os registros disponíveis. Lacunas aparecem como “Sem dados”; variações ficam indisponíveis quando os períodos não são completos.</p></div>}
        {!maxEvents && !report.previous.pageViews && <DataState title="Ainda não há eventos nestes períodos" description="Escolha outro período ou confira a instalação do snippet. Os gráficos serão preenchidos com dados reais assim que houver registros." href={`/sites/${siteId}`} action="Conferir instalação" />}
        <dl className="mb-10 mt-6 grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-3">
          {[
            { key: 'sessions' as const, label: 'Sessões', detail: 'Sessões anônimas com visualização' },
            { key: 'pageViews' as const, label: 'Visualizações', detail: 'Eventos de visita às páginas' },
            { key: 'conversions' as const, label: 'Conversões', detail: 'Eventos de metas atingidas; pode haver mais de um por sessão' },
            { key: 'formStarts' as const, label: 'Iniciaram um formulário', detail: 'Sessões com início observado' },
            { key: 'formCompletions' as const, label: 'Concluíram um formulário', detail: 'Envio após início do mesmo formulário' },
            { key: 'formCompletionRate' as const, label: 'Taxa de conclusão', detail: 'Sessões com envio / sessões com início', rate: true },
          ].map(item => <div key={item.key} className="min-w-0 border-b border-border pb-5"><dt className="text-sm text-muted-foreground">{item.label}</dt><dd className="mt-2 break-words text-3xl font-semibold tracking-tight tabular-nums">{metricValue(current[item.key], item.rate)}</dd><dd className="mt-2 text-xs font-medium">{comparable ? changeLabel(current[item.key], report.previous[item.key], item.rate) : 'Comparação indisponível'}<span className="font-normal text-muted-foreground">{comparable ? ' vs. período anterior' : ''}</span></dd><dd className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.detail}</dd></div>)}
        </dl>
        <section aria-labelledby="traffic-heading" className="mb-10">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h3 id="traffic-heading" className="text-lg font-semibold">Tráfego e ações</h3><p className="mt-2 text-sm text-muted-foreground">Duas linhas, a mesma escala. Alterne a métrica para comparar sua evolução.</p></div><div className="w-full sm:max-w-64"><label htmlFor="trend-metric" className="mb-2 block text-sm font-medium">Métrica do gráfico</label><select id="trend-metric" value={metric} onChange={event => setMetric(event.target.value as keyof ReportMetrics)} className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm">{choices.map(choice => <option key={choice.key} value={choice.key}>{choice.label}</option>)}</select></div></div>
          <Card className="shadow-none"><TrendChart report={report} metric={metric} label={selected.label} /></Card>
        </section>
        <section aria-labelledby="journey-heading" className="mb-10">
          <h3 id="journey-heading" className="text-lg font-semibold">Onde o formulário perde oportunidades</h3><p className="mb-5 mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">A jornada acompanha sessões que iniciaram um formulário e enviaram esse mesmo formulário na mesma página, em ordem, dentro do período. Cada sessão conta uma vez; envios repetidos não inflacionam a conclusão.</p>
          {!current.formStarts ? <DataState title="Ainda não há inícios de formulário registrados" description="A jornada precisa dos eventos form_start e form_submit com identificação do formulário. Envios isolados não permitem calcular abandono." /> : <Card className="shadow-none"><ol className="space-y-6">
            {[{ label: 'Iniciaram um formulário', count: current.formStarts }, { label: 'Enviaram após iniciar', count: current.formCompletions }].map(step => <li key={step.label}><div className="mb-2 flex justify-between gap-4 text-sm"><span>{step.label}</span><span className="font-semibold tabular-nums">{metricValue(step.count)} sessões</span></div><div aria-hidden className="h-6 rounded-sm bg-muted"><div className="h-full rounded-sm bg-primary" style={{ width: `${barWidth(step.count, current.formStarts)}%` }} /></div></li>)}
          </ol><p className="mt-6 text-sm"><strong className="tabular-nums">{metricValue(current.formStarts - current.formCompletions)} sessões ({metricValue(1 - current.formCompletionRate!, true)})</strong> ficaram sem envio observado.</p><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Este é um sinal de abandono, não uma confirmação de saída. Um envio após o fim do período ou bloqueado na coleta não aparece aqui. O evento de envio não confirma que o servidor aceitou o formulário.</p></Card>}
          <h4 className="mb-4 mt-6 text-sm font-medium">Evolução da taxa de conclusão</h4><Card className="shadow-none"><TrendChart report={report} metric="formCompletionRate" label="Taxa de conclusão de formulários" rate /><p className="mt-3 text-xs leading-relaxed text-muted-foreground">Sessões agrupadas pela data do primeiro início de formulário em cada período. A taxa usa os totais de cada intervalo; sem inícios, não há taxa.</p></Card>
        </section>
        <section aria-labelledby="events-heading" className="mb-10"><h3 id="events-heading" className="text-lg font-semibold">Volume de interações</h3><p className="mb-5 mt-2 text-sm text-muted-foreground">Eventos no período selecionado. Contagens de eventos podem superar o número de sessões.</p>
          {!maxEvents ? <DataState title="Sem interações no período" description="Experimente um intervalo maior ou aguarde os primeiros registros." /> : <Card className="shadow-none"><ul className="space-y-5">{report.events.map(row => <li key={row.event}><div className="mb-2 flex justify-between gap-4 text-sm"><span className="break-all">{eventLabels[row.event] ?? row.event}</span><span className="font-semibold tabular-nums">{metricValue(row.count)}</span></div><div aria-hidden className="h-4 rounded-sm bg-muted"><div className="h-full rounded-sm bg-primary" style={{ width: `${barWidth(row.count, maxEvents)}%` }} /></div></li>)}</ul></Card>}
        </section>
        <section aria-labelledby="sections-heading"><h3 id="sections-heading" className="text-lg font-semibold">Quais seções merecem atenção</h3><p className="mb-5 mt-2 text-sm text-muted-foreground">Visibilidade, atenção e frustração no mesmo período selecionado.</p>
          {!report.sections.length ? <DataState title="Sem dados por seção no período" description="As seções aparecem quando o snippet envia eventos com identificação de seção." /> : <Card className="overflow-x-auto shadow-none"><table className="w-full min-w-[620px] text-left text-sm"><caption className="sr-only">Desempenho por seção no período selecionado</caption><thead className="border-b border-border text-muted-foreground"><tr>{['Seção / visualizações', 'Cliques sem resposta', 'Cliques repetidos', 'Atenção total'].map(title => <th key={title} scope="col" className="px-3 pb-4 font-medium">{title}</th>)}</tr></thead><tbody className="divide-y divide-border tabular-nums">{report.sections.map(row => <tr key={row.section}><th scope="row" className="w-2/5 px-3 py-5 text-left font-normal"><div className="flex justify-between gap-4"><span className="max-w-64 break-all font-medium">{row.section}</span><span>{metricValue(row.views)}</span></div><div aria-hidden className="mt-3 h-2 rounded bg-muted"><div className="h-full rounded bg-primary/70" style={{ width: `${barWidth(row.views, maxViews)}%` }} /></div></th><td className="px-3 py-5">{metricValue(row.deadClicks)}</td><td className="px-3 py-5">{metricValue(row.rageClicks)}</td><td className="px-3 py-5">{metricValue(Math.round(row.dwellMs / 1000))} s</td></tr>)}</tbody></table><p className="mt-4 text-xs leading-relaxed text-muted-foreground">Atenção total é a soma dos tempos registrados, não uma média.</p></Card>}
        </section>
        <div className="mt-10 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">Transforme estas observações em uma próxima ação.</p><Link href="/experiments" className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4">Acompanhar experimentos</Link></div>
      </>}
  </div>;
}
