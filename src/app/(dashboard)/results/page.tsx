'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, type Experiment, type VariantResult } from '@/lib/api';
import { Card, Badge } from '@/components/ui/card';
import { BarChart } from '@/components/bar-chart';
import { PageHeader } from '@/components/page-header';
import { DataState } from '@/components/data-state';
import { formatPct } from '@/lib/utils';
import { useSites } from '@/lib/use-sites';

export default function ResultsPage() {
  return <Suspense fallback={<DataState loading title="Carregando resultados…" />}><ResultsContent /></Suspense>;
}

function ResultsContent() {
  const requested = useSearchParams().get('experiment');
  return <ExperimentResults key={requested ?? 'all'} requested={requested} />;
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
  const ordered = [...(results ?? [])].sort((a, b) => Number(b.isControl) - Number(a.isControl));
  const label = (row: VariantResult) => `${row.isControl ? 'Controle' : 'Variante'} · ${row.variantId.slice(0, 8)}`;
  const format = (value: number) => value.toLocaleString('pt-BR');

  return <div lang="pt-BR">
    <PageHeader title="Resultados" />
    {experiments && experiments.length > 0 && <div className="mb-6"><label htmlFor="result-experiment" className="mb-2 block text-sm font-medium">Experimento</label><select id="result-experiment" value={selected} onChange={e => setSelected(e.target.value)} className="h-11 w-full min-w-0 rounded-md border border-border bg-background px-3 text-sm">{experiments.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>}
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
            <td className="whitespace-nowrap px-3 py-4">{row.lift === null ? 'N/D' : `${row.lift > 0 ? '+' : ''}${formatPct(row.lift)}`}</td>
            <td className="px-3 py-4">{row.pValue === null ? 'N/D' : row.pValue < .001 ? '<0,001' : row.pValue.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</td>
            <td className="px-3 py-4"><Badge tone={row.isControl ? 'default' : row.significant && control ? (row.conversionRate > control.conversionRate ? 'green' : 'red') : 'default'}>{row.isControl ? 'Referência' : row.pValue === null ? 'Dados insuficientes' : row.significant ? 'Diferença significativa' : 'Sem diferença significativa'}</Badge></td>
          </tr>)}</tbody></table></div>
          <details className="mt-4 text-xs leading-relaxed text-muted-foreground"><summary className="min-h-11 cursor-pointer py-3">Definições</summary><p>Significância informada pela API contra o controle; pode indicar melhora ou piora. N/D = comparação indisponível. Taxas observadas isoladamente não definem uma vencedora.</p></details>
        </Card>
      </>}
  </div>;
}
