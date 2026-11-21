'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api, type Experiment, type InsightSuggestion, type VariantResult } from '@/lib/api';
import { Card, Badge } from '@/components/ui/card';
import { BarChart } from '@/components/bar-chart';
import { PageHeader } from '@/components/page-header';
import { DataState } from '@/components/data-state';
import { formatPct } from '@/lib/utils';
import { useSites } from '@/lib/use-sites';
import { Button } from '@/components/ui/button';

export default function ResultsPage() {
  return <Suspense fallback={<DataState loading title="Carregando resultados…" />}><ResultsContent /></Suspense>;
}

function ResultsContent() {
  const requested = useSearchParams().get('experiment');
  return <ExperimentResults key={requested ?? 'all'} requested={requested} />;
}

function ResultInsight({ siteId, insightId }: { siteId: string; insightId: string }) {
  const [insight, setInsight] = useState<InsightSuggestion | null>();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    api.get<InsightSuggestion[]>(`/sites/${encodeURIComponent(siteId)}/ai/suggestions?insightId=${encodeURIComponent(insightId)}`)
      .then(items => { if (active) setInsight(items.find(item => item.id === insightId) ?? null); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [siteId, insightId, attempt]);

  return <aside aria-label="Insight de origem" className="mb-6 border-b border-border pb-5 text-sm">
    <h2 className="font-medium">Insight de IA que originou este experimento</h2>
    <Link href={`/insights?insight=${encodeURIComponent(insightId)}`} className="inline-flex min-h-11 items-center break-words text-primary underline underline-offset-4">{insight?.payload.title ?? 'Ver insight de origem'}</Link>
    {error ? <div role="alert"><p>Não foi possível carregar a referência do insight.</p><Button variant="outline" className="mt-2 h-11" onClick={() => setAttempt(n => n + 1)}>Tentar novamente</Button></div>
      : insight === undefined ? <p role="status" className="text-muted-foreground">Consultando insight de origem…</p>
      : insight === null ? <p className="text-muted-foreground">O insight vinculado está indisponível para consulta.</p>
      : <p className="text-muted-foreground">{insight.approvedAt ? <>Aprovado em <time dateTime={insight.approvedAt}>{new Date(insight.approvedAt).toLocaleString('pt-BR')}</time>.</> : 'A data de aprovação deste insight não está registrada.'}</p>}
  </aside>;
}

function ExperimentResults({ requested }: { requested: string | null }) {
  const { siteId } = useSites();
  const [experiments, setExperiments] = useState<Experiment[] | null>(null);
  const [selected, setSelected] = useState('');
  const [results, setResults] = useState<VariantResult[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    api.get<Experiment[]>(`/experiments?siteId=${encodeURIComponent(siteId)}`).then(list => {
      if (active) { setExperiments(list); setSelected(current => current || (requested && list.some(exp => exp.id === requested) ? requested : requested ? '' : list[0]?.id || '')); }
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [attempt, siteId, requested]);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    setResults(null); setError(false);
    api.get<{ variants: VariantResult[] }>(`/analytics/experiments/${encodeURIComponent(selected)}/results`)
      .then(r => { if (active) setResults(r.variants); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [selected, attempt]);
  const control = results?.find(row => row.isControl);
  const experiment = experiments?.find(item => item.id === selected);
  const ordered = [...(results ?? [])].sort((a, b) => Number(b.isControl) - Number(a.isControl));
  const label = (row: VariantResult) => `${row.isControl ? 'Controle' : 'Variante'} · ${row.variantId.slice(0, 8)}`;
  const format = (value: number) => value.toLocaleString('pt-BR');

  return <div lang="pt-BR">
    <PageHeader title="Resultados" />
    {experiments && experiments.length > 0 && <div className="mb-6"><label htmlFor="result-experiment" className="mb-2 block text-sm font-medium">Experimento</label><select id="result-experiment" value={selected} onChange={e => setSelected(e.target.value)} className="h-11 w-full min-w-0 rounded-md border border-border bg-background px-3 text-sm">{experiments.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>}
    {experiment && (experiment.insightId ? <ResultInsight key={`${siteId}:${experiment.id}`} siteId={siteId} insightId={experiment.insightId} /> : <p className="mb-6 text-sm text-muted-foreground">Este experimento não possui um insight de IA vinculado.</p>)}
    {error ? <DataState error title="Resultados indisponíveis" description="Tente novamente." onRetry={() => setAttempt(n => n + 1)} />
      : !experiments ? <DataState loading title="Carregando experimentos…" />
      : !experiments.length ? <DataState title="Nenhum experimento" description="Crie um teste para comparar variantes." href="/experiments" action="Ver experimentos" />
      : !selected ? <DataState error title="Experimento indisponível neste site" description="Selecione um experimento para consultar os resultados." />
      : !results ? <DataState loading title="Carregando resultados…" />
      : !results.some(row => row.exposures > 0) ? <DataState title="Sem exposições" description="Confira a execução do teste e a instalação do código de rastreamento." href={`/experiments?review=${encodeURIComponent(selected)}`} action="Conferir experimento" />
      : <>
        <div className="mb-6 grid items-start gap-6 lg:grid-cols-2">
          <Card className="shadow-none"><BarChart title="Taxa de conversão" description="Conversões / exposições" formatValue={formatPct} reference={control && control.exposures > 0 ? { value: control.conversionRate, label: 'Controle' } : undefined} rows={ordered.map(row => ({
            id: row.variantId, label: label(row), value: row.exposures > 0 ? row.conversionRate : null,
            tone: row.isControl ? 'neutral' : row.significant && control ? (row.conversionRate > control.conversionRate ? 'positive' : 'negative') : undefined,
            detail: `${format(row.conversions)} conversões / ${format(row.exposures)} exposições`,
          }))} /></Card>
          <Card className="shadow-none"><BarChart title="Exposições" rows={ordered.map(row => ({ id: row.variantId, label: label(row), value: row.exposures, tone: 'neutral' }))} /></Card>
        </div>
        <Card className="shadow-none">
          <h2 className="mb-4 text-lg font-semibold">Evidência estatística</h2>
          <div role="region" aria-label="Evidência por variante" tabIndex={0} className="overflow-x-auto focus-visible:outline-primary"><table className="w-full min-w-[560px] text-left text-sm tabular-nums"><thead className="border-b border-border text-muted-foreground"><tr>{['Variante', 'Efeito relativo', 'p-valor', 'Evidência'].map(title => <th key={title} scope="col" className="px-3 py-3 font-medium">{title}</th>)}</tr></thead><tbody className="divide-y divide-border">{ordered.map(row => <tr key={row.variantId}>
            <th scope="row" title={row.variantId} className="px-3 py-4 font-medium">{label(row)}</th>
            <td className="whitespace-nowrap px-3 py-4">{row.isControl ? 'Referência' : row.lift === null ? 'Indisponível' : `${row.lift > 0 ? '+' : ''}${formatPct(row.lift)}`}</td>
            <td className="px-3 py-4">{row.isControl ? 'Referência' : row.pValue === null ? 'Indisponível' : row.pValue < .001 ? '<0,001' : row.pValue.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</td>
            <td className="px-3 py-4"><Badge tone={row.isControl ? 'default' : row.significant && control ? (row.conversionRate > control.conversionRate ? 'green' : 'red') : 'default'}>{row.isControl ? 'Referência' : row.pValue === null ? 'Dados insuficientes' : row.significant ? 'Diferença significativa' : 'Sem diferença significativa'}</Badge></td>
          </tr>)}</tbody></table></div>
          <details className="mt-4 text-sm leading-relaxed text-muted-foreground"><summary className="min-h-11 cursor-pointer py-3">Definições</summary><dl className="max-w-prose space-y-4">
            <div><dt className="font-medium text-foreground">Referência</dt><dd>A variante de controle é a base da comparação. Seu efeito relativo e p-valor são identificados como Referência porque ela não é comparada consigo mesma.</dd></div>
            <div><dt className="font-medium text-foreground">Efeito relativo</dt><dd>Variação percentual da taxa de conversão da variante em relação ao controle: (taxa da variante − taxa do controle) / taxa do controle. Por exemplo, passar de 10% para 12% representa +20% de efeito relativo, ou 2 pontos percentuais. Valores negativos indicam queda; o efeito fica indisponível quando a taxa do controle é zero.</dd></div>
            <div><dt className="font-medium text-foreground">p-valor</dt><dd>Supondo que não exista diferença real entre variante e controle, é a probabilidade de observar uma diferença pelo menos tão extrema quanto a medida. Quanto menor o valor, maior a evidência contra essa suposição. Ele não representa a probabilidade de a variante ser melhor nem o tamanho da melhoria.</dd></div>
            <div><dt className="font-medium text-foreground">Evidência estatística</dt><dd>A API considera a diferença significativa quando o p-valor é menor que 0,05; a diferença pode indicar melhora ou piora. Indisponível significa que não há base válida para calcular a comparação. Taxas observadas isoladamente não definem uma vencedora.</dd></div>
          </dl></details>
        </Card>
      </>}
  </div>;
}
