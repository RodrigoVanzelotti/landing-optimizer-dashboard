'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api, type ExperimentResult, type InsightSuggestion } from '@/lib/api';
import { Card, Badge } from '@/components/ui/card';
import { ExperimentResultSummary } from '@/components/experiment-result-summary';
import { BarChart } from '@/components/bar-chart';
import { PageHeader } from '@/components/page-header';
import { DataState } from '@/components/data-state';
import { useSites } from '@/lib/use-sites';
import { Button } from '@/components/ui/button';
import { PersistentPanel, TabLink } from '@/components/persistent-tabs';
import { experimentStatusLabels } from '@/lib/experiments';
import { orderResults, relativeEffect, resultEvidence, resultLift, resultRate } from '@/lib/results';

const count = (value: number) => value.toLocaleString('pt-BR');
const date = (value: string) => new Date(value).toLocaleDateString('pt-BR');

export default function ResultsPage() {
  return <Suspense fallback={<DataState loading title="Carregando resultados…" />}><ResultsContent /></Suspense>;
}

function ResultsContent() {
  const { siteId } = useSites();
  return <ResultsCollection key={siteId} siteId={siteId} />;
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
    <h3 className="font-medium">Insight de IA que originou este experimento</h3>
    <Link href={`/insights?insight=${encodeURIComponent(insightId)}`} className="inline-block min-h-11 max-w-full break-words py-3 text-primary underline underline-offset-4">{insight?.payload.title ?? 'Ver insight de origem'}</Link>
    {error ? <div role="alert"><p>Não foi possível carregar a referência do insight.</p><Button variant="outline" className="mt-2 h-11" onClick={() => setAttempt(n => n + 1)}>Tentar novamente</Button></div>
      : insight === undefined ? <p role="status" className="text-muted-foreground">Consultando insight de origem…</p>
      : insight === null ? <p className="text-muted-foreground">O insight vinculado está indisponível para consulta.</p>
      : <p className="text-muted-foreground">{insight.approvedAt ? <>Aprovado em <time dateTime={insight.approvedAt}>{new Date(insight.approvedAt).toLocaleString('pt-BR')}</time>.</> : 'A data de aprovação deste insight não está registrada.'}</p>}
  </aside>;
}

function ResultsCollection({ siteId }: { siteId: string }) {
  const params = useSearchParams();
  const selected = params.get('experiment');
  const search = params.get('q') ?? '';
  const order = params.get('sort') ?? 'lift-desc';
  const [results, setResults] = useState<ExperimentResult[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const refresh = useCallback(() => setAttempt(value => value + 1), []);
  useEffect(() => {
    let active = true;
    setError(false);
    api.get<ExperimentResult[]>(`/analytics/experiments/results?siteId=${encodeURIComponent(siteId)}`)
      .then(data => { if (active) setResults(data); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [siteId, attempt]);
  const visible = orderResults((results ?? []).filter(result => result.experiment.name.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'))), order);
  const selectedExists = results?.some(result => result.experimentId === selected);
  useEffect(() => {
    if (selected && selectedExists) document.getElementById(`result-card-${selected}`)?.scrollIntoView?.({ block: 'start' });
  }, [selected, selectedExists]);
  function href(id: string, open: boolean) {
    const query = new URLSearchParams(params.toString());
    if (open) query.delete('experiment'); else query.set('experiment', id);
    return `/results${query.size ? `?${query}` : ''}`;
  }
  function update(key: string, value: string) {
    const query = new URLSearchParams(window.location.search);
    if (value && !(key === 'sort' && value === 'lift-desc')) query.set(key, value); else query.delete(key);
    if (key === 'q') query.delete('experiment');
    window.history.replaceState(null, '', `/results${query.size ? `?${query}` : ''}`);
  }

  return <div lang="pt-BR">
    <PageHeader title="Resultados" description="Veja o que cada experimento revelou — e as melhorias que fizeram diferença."
      action={<Button variant="outline" className="h-11" onClick={() => setAttempt(n => n + 1)}>Atualizar resultados</Button>} />
    <div className="mb-6 flex flex-wrap items-end gap-4"><div className="min-w-0 flex-1 basis-60"><label htmlFor="result-search" className="mb-2 block text-sm font-medium">Buscar experimento</label><input id="result-search" type="search" value={search} onChange={event => update('q', event.target.value)} placeholder="Nome do experimento" className="h-11 w-full min-w-0 rounded-md border border-border bg-background px-3 text-sm" /></div><div className="w-full sm:w-80"><label htmlFor="result-order" className="mb-2 block text-sm font-medium">Ordenar por</label><select id="result-order" value={order} onChange={event => update('sort', event.target.value)} className="h-11 w-full min-w-0 rounded-md border border-border bg-background px-3 text-sm"><option value="lift-desc">Maior efeito relativo</option><option value="lift-asc">Menor efeito relativo</option><option value="exposures-desc">Mais exposições</option><option value="exposures-asc">Menos exposições</option><option value="start-desc">Início mais recente</option><option value="start-asc">Início mais antigo</option></select></div></div>
    {error ? <DataState error title="Resultados indisponíveis" description="Tente novamente para consultar os experimentos." onRetry={() => setAttempt(n => n + 1)} />
      : !results ? <DataState loading title="Carregando resultados dos experimentos…" />
      : !results.length ? <DataState title="Seus próximos resultados começam com um experimento" description="Aprove um insight de IA e acompanhe os testes na aba Experimentos." href="/experiments" action="Ver experimentos" />
      : <>
        <p role="status" className="mb-4 text-sm text-muted-foreground">{visible.length} de {results.length} experimentos. Expanda um card para explorar a evidência e os dados.</p>
        {selected && !selectedExists && <DataState error title="Experimento indisponível neste site" description="Confira o site selecionado ou abra um dos experimentos abaixo." />}
        {!visible.length && <DataState title="Nenhum experimento corresponde à busca" description="Tente outro nome para consultar os resultados." />}
        <div className="space-y-5">{visible.map(result => {
          const experiment = result.experiment;
          const control = result.variants.find(variant => variant.isControl);
          const variants = result.variants.filter(variant => !variant.isControl);
          const partial = ['running', 'paused'].includes(experiment.status);
          const open = selected === result.experimentId;
          const total = result.variants.reduce((sum, variant) => sum + variant.exposures, 0);
          return <Card key={result.experimentId} id={`result-card-${result.experimentId}`} className="overflow-hidden p-0 shadow-none">
            <h2><TabLink href={href(result.experimentId, open)} role="button" aria-expanded={open} aria-controls={`result-details-${result.experimentId}`} aria-label={`Resultados de ${experiment.name}`} aria-describedby={`result-summary-${result.experimentId}`} onKeyDown={event => { if (event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }} className="block rounded-lg p-5 text-left hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:p-6">
              <span className="flex items-start justify-between gap-4"><span className="min-w-0"><span className="block break-words text-lg font-semibold leading-snug">{experiment.name}</span><span className="mt-2 block text-sm font-normal text-muted-foreground">{result.goal?.name ?? 'Todas as metas de conversão'} · {experiment.startedAt ? `Iniciado em ${date(experiment.startedAt)}` : 'Não iniciado'} · {count(total)} exposições</span><span className="mt-2 flex flex-wrap items-center gap-2"><Badge>{experimentStatusLabels[experiment.status] ?? experiment.status}</Badge>{partial && <Badge>Resultado parcial</Badge>}</span></span><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={`mt-1 h-5 w-5 shrink-0 ${open ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6" /></svg></span>
              <span id={`result-summary-${result.experimentId}`} className={open ? 'sr-only' : 'mt-5 grid gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3'}>{variants.length ? variants.map(variant => {
                const evidence = resultEvidence(variant, control);
                const effect = relativeEffect(variant, control);
                return <span key={variant.variantId} className="min-w-0"><span className="block break-words text-xs font-normal text-muted-foreground">{variant.name} · Efeito relativo</span><span className={`mt-1 block text-3xl font-semibold tracking-tight tabular-nums ${evidence.kind === 'improvement' ? 'text-green-800' : evidence.kind === 'decline' ? 'text-red-700' : ''}`}>{variant.exposures && control?.exposures ? resultLift(effect) : 'Sem dados'}</span><Badge tone={evidence.tone} className="mt-2">{evidence.label}</Badge></span>;
              }) : <span className="text-sm font-normal text-muted-foreground">Aguardando dados das variantes.</span>}</span>
              <span className="mt-4 block text-xs font-normal text-muted-foreground">{open ? 'Recolher resultado' : 'Ver evidência, conversões e insight de origem'}</span>
            </TabLink></h2>
            <div id={`result-details-${result.experimentId}`}><PersistentPanel active={open}><ResultDetails result={result} onChanged={refresh} /></PersistentPanel></div>
          </Card>;
        })}</div>
      </>}
  </div>;
}

function ResultDetails({ result, onChanged }: { result: ExperimentResult; onChanged: () => void }) {
  const control = result.variants.find(variant => variant.isControl);
  const ordered = [...result.variants].sort((a, b) => Number(b.isControl) - Number(a.isControl));
  return <section aria-label={`Detalhes do resultado de ${result.experiment.name}`} className="border-t border-border p-5 sm:p-6">
    <ExperimentResultSummary id={result.experimentId} siteId={result.experiment.siteId} status={result.experiment.status} onStateChanged={onChanged} showMore={false} />
    {result.experiment.insightId ? <ResultInsight siteId={result.experiment.siteId} insightId={result.experiment.insightId} /> : <p className="mb-6 text-sm text-muted-foreground">Este experimento não possui um insight de IA vinculado.</p>}
    {!result.variants.some(variant => variant.exposures > 0) ? <DataState title="Sem exposições" description="Confira a execução do teste e a instalação do código de rastreamento." href={`/experiments?review=${encodeURIComponent(result.experimentId)}`} action="Conferir experimento" /> : <>
      <div className="mb-8 grid items-start gap-6 lg:grid-cols-2"><div><BarChart title="Taxa de conversão" description="Conversões / exposições" formatValue={resultRate} reference={control && control.exposures > 0 ? { value: control.conversionRate, label: control.name } : undefined} rows={ordered.map(variant => ({ id: variant.variantId, label: variant.name, value: variant.exposures > 0 ? variant.conversionRate : null, tone: resultEvidence(variant, control).kind === 'improvement' ? 'positive' : resultEvidence(variant, control).kind === 'decline' ? 'negative' : 'neutral', detail: `${count(variant.conversions)} conversões / ${count(variant.exposures)} exposições` }))} /></div><div><BarChart title="Exposições" rows={ordered.map(variant => ({ id: variant.variantId, label: variant.name, value: variant.exposures, tone: 'neutral' }))} /></div></div>
      <h3 className="mb-4 text-lg font-semibold">Evidência estatística</h3>
      <div role="region" aria-label="Evidência por variante" tabIndex={0} className="overflow-x-auto focus-visible:outline-primary"><table className="w-full min-w-[560px] text-left text-sm tabular-nums"><thead className="border-b border-border text-muted-foreground"><tr>{['Variante', 'Efeito relativo', 'p-valor', 'Evidência'].map(title => <th key={title} scope="col" className="px-3 py-3 font-medium">{title}</th>)}</tr></thead><tbody className="divide-y divide-border">{ordered.map(variant => <tr key={variant.variantId}>
        <th scope="row" className="px-3 py-4 font-medium">{variant.name}</th>
        <td className="whitespace-nowrap px-3 py-4">{variant.isControl ? 'Referência' : relativeEffect(variant, control) === null ? 'Indisponível' : resultLift(relativeEffect(variant, control))}</td>
        <td className="px-3 py-4">{variant.isControl ? 'Referência' : variant.pValue === null ? 'Indisponível' : variant.pValue < .001 ? '<0,001' : variant.pValue.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</td>
        <td className="px-3 py-4"><Badge tone={resultEvidence(variant, control).tone}>{resultEvidence(variant, control).label}</Badge></td>
      </tr>)}</tbody></table></div>
      <details className="mt-4 text-sm leading-relaxed text-muted-foreground"><summary className="min-h-11 cursor-pointer py-3">Definições</summary><dl className="max-w-prose space-y-4">
        <div><dt className="font-medium text-foreground">Referência</dt><dd>A variante de controle é a base da comparação. Seu efeito relativo e p-valor são identificados como Referência porque ela não é comparada consigo mesma.</dd></div>
        <div><dt className="font-medium text-foreground">Efeito relativo</dt><dd>Variação percentual da taxa de conversão da variante em relação ao controle: (taxa da variante − taxa do controle) / taxa do controle. Por exemplo, passar de 10% para 12% representa +20% de efeito relativo, ou 2 pontos percentuais. Valores negativos indicam queda; o efeito fica indisponível quando a taxa do controle é zero.</dd></div>
        <div><dt className="font-medium text-foreground">p-valor</dt><dd>Supondo que não exista diferença real entre variante e controle, é a probabilidade de observar uma diferença pelo menos tão extrema quanto a medida. Quanto menor o valor, maior a evidência contra essa suposição. Ele não representa a probabilidade de a variante ser melhor nem o tamanho da melhoria.</dd></div>
        <div><dt className="font-medium text-foreground">Evidência estatística</dt><dd>A API considera a diferença significativa quando o p-valor é menor que 0,05; a diferença pode indicar melhora ou piora. Indisponível significa que não há base válida para calcular a comparação. Taxas observadas isoladamente não definem uma vencedora.</dd></div>
      </dl></details>
    </>}
  </section>;
}
