'use client';

import { useEffect, useState } from 'react';
import { api, type Experiment, type VariantResult } from '@/lib/api';
import { Card, CardTitle, Badge } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';
import { DataState } from '@/components/data-state';
import { formatNumber, formatPct } from '@/lib/utils';

export default function ResultsPage() {
  const [experiments, setExperiments] = useState<Experiment[] | null>(null);
  const [selected, setSelected] = useState('');
  const [results, setResults] = useState<VariantResult[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    api.get<Experiment[]>('/experiments').then(list => {
      if (active) { setExperiments(list); setSelected(current => current || list[0]?.id || ''); }
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [attempt]);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    setResults(null); setError(false);
    api.get<{ variants: VariantResult[] }>(`/analytics/experiments/${selected}/results`)
      .then(r => { if (active) setResults(r.variants); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [selected, attempt]);

  return <div lang="pt-BR">
    <PageHeader title="Resultados" description="Compare exposições, conversões e o efeito de cada variante em relação ao controle." />
    {experiments && experiments.length > 0 && <div className="mb-6"><label htmlFor="result-experiment" className="mb-2 block text-sm font-medium">Experimento</label><select id="result-experiment" value={selected} onChange={e => setSelected(e.target.value)} className="h-11 w-full min-w-0 rounded-md border border-border bg-background px-3 text-sm">{experiments.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>}
    {error ? <DataState error title="Os resultados não carregaram" description="Tente novamente. Uma falha na consulta não significa que o experimento está sem dados." onRetry={() => setAttempt(n => n + 1)} />
      : !experiments ? <DataState loading title="Consultando experimentos…" />
      : !experiments.length ? <DataState title="Os resultados começam com seu primeiro teste" description="Depois que um experimento começar a receber exposições, você poderá comparar suas variantes aqui." href="/experiments" action="Ver experimentos" />
      : !results ? <DataState loading title="Calculando resultados…" />
      : !results.some(r => r.exposures > 0) ? <DataState title="O teste ainda precisa receber visitantes" description="Ainda não há exposições registradas para este experimento. Confira se ele está em execução e se o snippet está instalado. As métricas aparecerão quando a coleta começar." href={`/experiments?review=${encodeURIComponent(selected)}`} action="Conferir experimento" />
      : <div className="space-y-4">{results.map(v => <Card key={v.variantId} className="shadow-none"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="min-w-0"><CardTitle>{v.isControl ? 'Controle' : 'Variante'} · {v.variantId.slice(0, 8)}</CardTitle><p className="mt-3 text-2xl font-semibold tabular-nums">{v.exposures ? formatPct(v.conversionRate) : '—'}</p><p className="mt-2 text-sm text-muted-foreground">{formatNumber(v.conversions)} conversões em {formatNumber(v.exposures)} exposições</p>{v.lift !== null && <p className="mt-2 text-sm">Efeito relativo: {v.lift >= 0 ? '+' : ''}{formatPct(v.lift)}{v.pValue !== null ? ` · p=${v.pValue.toFixed(3)}` : ''}</p>}</div>{v.isControl ? <Badge>Referência</Badge> : v.significant ? <Badge tone="green">Estatisticamente significativo</Badge> : <Badge>Aguardando evidência estatística</Badge>}</div>{!v.isControl && !v.significant && <p className="mt-4 border-t border-border pt-4 text-sm leading-relaxed text-muted-foreground">Ainda não há evidência estatística suficiente para declarar uma diferença. Continue acompanhando antes de escolher uma variante vencedora.</p>}</Card>)}</div>}
  </div>;
}
