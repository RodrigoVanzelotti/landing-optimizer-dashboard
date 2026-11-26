'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api, type AnalyticsTimeframe, type ConversionGoal, type ExperimentImpactReport } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataState } from '@/components/data-state';
import { dateSpan, metricValue, reportDate } from '@/components/trend-chart';
import { experimentStatusLabels } from '@/lib/experiments';

const rate = (value: number | null) => value === null ? 'Sem dados' : `${(value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
const pp = (value: number | null) => {
  if (value === null) return 'Sem dados';
  const rounded = Math.round(value * 100) / 100 || 0;
  return `${rounded > 0 ? '+' : ''}${rounded.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} p.p.`;
};

export function ExperimentImpact(props: { siteId: string; timeframe: AnalyticsTimeframe; refreshKey: number }) {
  return <ImpactContent key={props.siteId} {...props} />;
}

function ImpactContent({ siteId, timeframe, refreshKey }: { siteId: string; timeframe: AnalyticsTimeframe; refreshKey: number }) {
  const [goals, setGoals] = useState<ConversionGoal[] | null>(null);
  const [goalId, setGoalId] = useState('');
  const [goalError, setGoalError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const scope = `${siteId}:${goalId}:${timeframe}:${refreshKey}:${attempt}`;
  const [resource, setResource] = useState<{ scope?: string; data?: ExperimentImpactReport; error?: boolean }>({});
  useEffect(() => {
    let active = true;
    setGoalError(false);
    api.get<ConversionGoal[]>(`/sites/${encodeURIComponent(siteId)}/goals`).then(items => {
      if (!active) return;
      setGoals(items);
      setGoalId(current => items.some(goal => goal.id === current) ? current : items.find(goal => goal.isFavorite)?.id ?? items[0]?.id ?? '');
    }).catch(() => { if (active) setGoalError(true); });
    return () => { active = false; };
  }, [siteId, refreshKey, attempt]);
  useEffect(() => {
    if (!goalId) return;
    let active = true;
    api.get<ExperimentImpactReport>(`/analytics/experiment-impact?siteId=${encodeURIComponent(siteId)}&goalId=${encodeURIComponent(goalId)}&timeframe=${timeframe}`)
      .then(data => { if (active) setResource({ scope, data }); })
      .catch(() => { if (active) setResource({ scope, error: true }); });
    return () => { active = false; };
  }, [siteId, goalId, timeframe, scope]);
  const report = resource.scope === scope ? resource.data : undefined;
  const retry = () => setAttempt(n => n + 1);

  return <section aria-labelledby="experiment-impact-heading" className="mb-10">
    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h3 id="experiment-impact-heading" className="text-lg font-semibold">Resultado dos experimentos</h3><p className="mt-2 max-w-prose text-sm text-muted-foreground">Controle e variantes: acompanhe o resultado para a meta do seu cliente.</p></div>
      {goals && goals.length > 0 && <div className="w-full min-w-0 sm:max-w-72"><label htmlFor="impact-goal" className="mb-2 block text-sm font-medium">Meta de conversão</label><select id="impact-goal" value={goalId} onChange={event => setGoalId(event.target.value)} className="h-11 w-full min-w-0 rounded-md border border-border bg-background px-3 text-sm">{goals.map(goal => <option key={goal.id} value={goal.id}>{goal.name}{goal.isFavorite ? ' · Favorita' : ''}</option>)}</select></div>}
    </div>
    {goalError || (resource.scope === scope && resource.error) ? <DataState error title="Não foi possível consultar o resultado dos experimentos" description="Confira sua conexão e tente novamente." onRetry={retry} />
      : !goals ? <DataState loading title="Consultando metas de conversão…" />
      : !goals.length ? <DataState title="Defina o objetivo deste site" description="Cadastre uma meta de conversão e marque sua favorita para acompanhar os experimentos por esse objetivo." href={`/sites/${siteId}`} action="Configurar metas" />
      : !report ? <DataState loading title="Calculando o resultado dos experimentos…" />
      : <ImpactChart key={`${goalId}:${timeframe}`} report={report} />}
  </section>;
}

function ImpactChart({ report }: { report: ExperimentImpactReport }) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [point, setPoint] = useState<number | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const from = Date.parse(report.range.from), to = Date.parse(report.range.to);
  const x = (time: number) => 48 + (time - from) / (to - from) * (width - 76);
  const values = report.series.flatMap(row => [row.values?.control.rate ?? 0, row.values?.variants.rate ?? 0]);
  const maximum = Math.min(1, Math.max(.05, Math.ceil(Math.max(0, ...values) * 1.1 * 20) / 20));
  const y = (rate: number) => 200 - rate / maximum * 176;
  const index = Math.min(point ?? report.series.length - 1, report.series.length - 1);
  const currentPoint = report.series[index];
  const path = (group: 'control' | 'variants') => {
    let previous = false;
    return report.series.map(row => {
      const rate = row.values?.[group].rate;
      if (rate === null || rate === undefined) { previous = false; return ''; }
      const command = `${previous ? 'L' : 'M'}${x(Date.parse(row.to))},${y(rate)}`;
      previous = true;
      return command;
    }).join(' ');
  };
  type Change = { experiment: ExperimentImpactReport['experiments'][number]; at: string; label: string };
  const events: Change[] = [];
  for (const experiment of report.experiments) {
    for (const [at, label] of [[experiment.startedAt, 'Início'], [experiment.endedAt, 'Encerramento']] as const) {
      if (!at || Date.parse(at) < from || Date.parse(at) >= to) continue;
      events.push({ experiment, at, label });
    }
  }
  const changes = new Map<string, Change[]>();
  let group: Change[] | undefined;
  let groupTime = -Infinity;
  for (const change of events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
    const time = Date.parse(change.at);
    if (!group || x(time) - x(groupTime) >= 44) {
      group = []; groupTime = time;
      changes.set(change.at, group);
    }
    group.push(change);
  }
  const selectedChanges = selectedEvent ? changes.get(selectedEvent) : undefined;
  const comparable = report.coverage.currentComplete && report.coverage.previousComplete;
  const delta = (current: number | null, previous: number | null, rates: boolean) => comparable && current !== null && previous !== null ? `${pp((current - previous) * (rates ? 100 : 1))} em relação ao período anterior` : 'Sem base para comparar';
  const kpis = [
    { label: 'Controle · taxa no período', value: rate(report.current.control.rate), delta: delta(report.current.control.rate, report.previous.control.rate, true), sample: `${metricValue(report.current.control.conversions)} conversões / ${metricValue(report.current.control.exposures)} exposições` },
    { label: 'Variantes · taxa no período', value: rate(report.current.variants.rate), delta: delta(report.current.variants.rate, report.previous.variants.rate, true), sample: `${metricValue(report.current.variants.conversions)} conversões / ${metricValue(report.current.variants.exposures)} exposições` },
    { label: 'Diferença observada', value: pp(report.current.gainPp), delta: delta(report.current.gainPp, report.previous.gainPp, false), sample: 'Variantes menos controle, para a mesma meta' },
  ];

  return <Card className="shadow-none">
    <p className="mb-5 text-xs text-muted-foreground">{dateSpan(report.range.from, report.range.to)} · {report.goal.name}</p>
    <dl className="mb-6 grid gap-5 sm:grid-cols-3">{kpis.map(kpi => <div key={kpi.label} className="min-w-0"><dt className="text-sm text-muted-foreground">{kpi.label}</dt><dd className="mt-2 break-words text-3xl font-semibold tracking-tight tabular-nums">{kpi.value}</dd><dd className="mt-2 text-sm tabular-nums">{kpi.delta}</dd><dd className="mt-1 text-xs text-muted-foreground">{kpi.sample}</dd></div>)}</dl>
    {(!report.coverage.currentComplete || !report.coverage.previousComplete) && <p role="status" className="mb-4 text-sm text-muted-foreground">Histórico parcial desde {reportDate(report.coverage.availableFrom)}. O delta exige cobertura completa nos dois períodos.</p>}
    {report.experiments.some(experiment => experiment.partial) && <p role="status" className="mb-4 text-sm text-muted-foreground">Inclui experimentos em andamento. Seus resultados são parciais e podem mudar.</p>}
    {!report.current.control.exposures && !report.current.variants.exposures ? <DataState title="Ainda não há exposições comparáveis para esta meta" description="Amplie o período ou aguarde a coleta dos experimentos em execução." href="/experiments" action="Ver experimentos" /> : <>
      <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground"><span className="inline-flex items-center gap-2"><span aria-hidden className="w-6 border-t-2 border-dashed border-muted-foreground" />Controle</span><span className="inline-flex items-center gap-2"><span aria-hidden className="w-6 border-t-2 border-primary" />Variantes</span><span>Taxas acumuladas no período</span></div>
      <div className="relative">
        <div ref={container} role="group" tabIndex={0} aria-label="Resultado dos experimentos no tempo. Use as setas para explorar as taxas e Tab para acessar os marcos." className="rounded focus-visible:outline-primary" onKeyDown={event => {
          if (event.key === 'Escape') setSelectedEvent(null);
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); setPoint(Math.max(0, Math.min(report.series.length - 1, index + (event.key === 'ArrowLeft' ? -1 : 1)))); }
        }}>
          <svg viewBox={`0 0 ${width} 260`} className="block w-full" role="group" aria-label="Taxa de conversão do controle e das variantes ao longo do período. Dados completos na tabela abaixo.">
            {[0, 1, 2, 3, 4].map(tick => <g key={tick}><line x1={48} x2={width - 28} y1={24 + tick * 44} y2={24 + tick * 44} className="stroke-border" /><text x={40} y={28 + tick * 44} textAnchor="end" className="fill-muted-foreground text-[11px]">{metricValue(maximum * (4 - tick) / 4, true)}</text></g>)}
            {[from, from + (to - from) / 2, to].map((time, i) => <text key={time} x={x(time)} y={253} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} className="fill-muted-foreground text-[11px]">{reportDate(new Date(i === 2 ? time - 86_400_000 : time).toISOString()).slice(0, 5)}</text>)}
            <path d={path('control')} fill="none" strokeWidth={2} strokeDasharray="6 5" className="stroke-muted-foreground" /><path d={path('variants')} fill="none" strokeWidth={2.5} className="stroke-primary" />
            {report.series.map((row, i) => <rect key={row.from} x={x(Date.parse(row.from))} y={16} width={Math.max(1, x(Date.parse(row.to)) - x(Date.parse(row.from)))} height={194} fill="transparent" onMouseEnter={() => setPoint(i)} onPointerDown={() => setPoint(i)} />)}
            {currentPoint && <><line x1={x(Date.parse(currentPoint.to))} x2={x(Date.parse(currentPoint.to))} y1={24} y2={200} className="stroke-border" strokeDasharray="3 3" />{(['control', 'variants'] as const).map(group => currentPoint.values?.[group].rate !== null && currentPoint.values?.[group].rate !== undefined && <circle key={group} cx={x(Date.parse(currentPoint.to))} cy={y(currentPoint.values[group].rate!)} r={4} className={group === 'control' ? 'fill-muted-foreground' : 'fill-primary'} />)}</>}
            {[...changes].map(([key, items]) => <g key={key} role="button" tabIndex={0} aria-label={`${items.length} marco(s) de experimento a partir de ${reportDate(items[0].at)}`} aria-expanded={selectedEvent === key} aria-controls="impact-experiment-summary" className="cursor-pointer focus-visible:outline-primary" onMouseEnter={() => setSelectedEvent(key)} onFocus={() => setSelectedEvent(key)} onClick={() => setSelectedEvent(key)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedEvent(key); } }}><line x1={x(Date.parse(items[0].at))} x2={x(Date.parse(items[0].at))} y1={24} y2={225} className="stroke-border" strokeDasharray="3 4" /><circle cx={x(Date.parse(items[0].at))} cy={225} r={10} className="fill-background stroke-primary" strokeWidth={1.5} /><text x={x(Date.parse(items[0].at))} y={229} textAnchor="middle" className="fill-primary text-[11px]">{items.length}</text><rect x={x(Date.parse(items[0].at)) - 22} y={203} width={44} height={40} fill="transparent" /></g>)}
          </svg>
        </div>
        {selectedChanges && <aside id="impact-experiment-summary" aria-label="Resumo dos experimentos neste marco" className="z-10 mt-4 max-h-80 overflow-y-auto rounded-lg border border-border bg-card p-4 shadow-md md:absolute md:right-4 md:top-3 md:mt-0 md:w-80"><div className="mb-2 flex items-center justify-between gap-3"><h4 className="text-sm font-semibold">{reportDate(selectedChanges[0].at)}</h4><Button variant="ghost" size="sm" className="min-h-11" onClick={() => setSelectedEvent(null)}>Fechar resumo</Button></div><ul className="space-y-4">{selectedChanges.map(change => <li key={`${change.experiment.id}:${change.label}`} className="min-w-0 text-sm"><p className="text-xs text-muted-foreground">{change.label} em {reportDate(change.at)} · {experimentStatusLabels[change.experiment.status] ?? change.experiment.status}{change.experiment.partial ? ' · Parcial' : ''}</p><p className="mt-1 break-words font-medium">{change.experiment.name}</p><p className="mt-2">Controle {metricValue(change.experiment.control.rate, true)} · Variantes {metricValue(change.experiment.variants.rate, true)}</p><p className="tabular-nums">Diferença no período: {pp(change.experiment.gainPp)}</p><Link href={`/experiments?review=${encodeURIComponent(change.experiment.id)}`} className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">Ver mais</Link></li>)}</ul></aside>}
      </div>
      {currentPoint && <p aria-live="polite" className="mt-3 text-sm tabular-nums">Até {reportDate(new Date(Date.parse(currentPoint.to) - 86_400_000).toISOString())}: controle {metricValue(currentPoint.values?.control.rate ?? null, true)} · variantes {metricValue(currentPoint.values?.variants.rate ?? null, true)} · diferença {pp(currentPoint.values?.gainPp ?? null)}</p>}
      <details className="mt-4 text-sm"><summary className="min-h-11 cursor-pointer py-3 text-primary underline underline-offset-4">Ver dados em tabela</summary><div className="overflow-x-auto"><table className="w-full min-w-[460px] text-left text-xs tabular-nums"><caption className="sr-only">Taxas acumuladas dos experimentos no período</caption><thead><tr>{['Até', 'Controle', 'Variantes', 'Diferença'].map(label => <th key={label} scope="col" className="py-3 pr-3 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-border">{report.series.map(row => <tr key={row.from}><th scope="row" className="py-3 pr-3 font-normal">{reportDate(new Date(Date.parse(row.to) - 86_400_000).toISOString())}</th><td>{metricValue(row.values?.control.rate ?? null, true)}</td><td>{metricValue(row.values?.variants.rate ?? null, true)}</td><td>{pp(row.values?.gainPp ?? null)}</td></tr>)}</tbody></table></div></details>
    </>}
    <details className="mt-4 text-sm leading-relaxed text-muted-foreground"><summary className="min-h-11 cursor-pointer py-3">Como este resultado é calculado</summary><div className="max-w-prose space-y-3"><p>As linhas mostram conversões da meta selecionada divididas pelas exposições válidas, acumuladas desde o início do período. Cada sessão contribui uma vez; conversões entram na data em que ocorreram, após a exposição e antes do encerramento do teste e do período.</p><p>O controle é o grupo de referência dos experimentos, não uma reconstrução da página original. Incluímos testes desta meta e testes sem meta principal. As taxas são ponderadas pelas exposições; diferenças individuais não são somadas.</p><p>A diferença em p.p. compara taxas observadas. Ela não comprova que toda a mudança foi causada pelos experimentos. Testes em andamento são parciais. O delta compara com o período imediatamente anterior de igual duração, em dias completos de UTC, excluindo hoje.</p><p>Exposições de sessões atribuídas a mais de um experimento ou variante são excluídas para evitar sobreposição. Neste período: {metricValue(report.excludedExposures)} exposições excluídas. Histórico ausente aparece como lacuna, nunca como zero.</p></div></details>
  </Card>;
}
