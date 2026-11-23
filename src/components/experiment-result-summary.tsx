'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, type ExperimentReport } from '@/lib/api';
import { DataState } from './data-state';
import { ExperimentOutcome } from './experiment-outcome';
import { ExperimentTrend } from './experiment-trend';
import { Badge } from './ui/card';

export function ExperimentResultSummary({ id, siteId, status, onStateChanged, showMore = true }: { id: string; siteId: string; status?: string; onStateChanged?: () => void; showMore?: boolean }) {
  const [result, setResult] = useState<ExperimentReport | null>();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    setError(false);
    function read() {
      void api.get<ExperimentReport>(`/analytics/experiments/${encodeURIComponent(id)}/report`).then(data => {
        if (!active) return;
        const matched = data.experimentId === id && data.experiment?.siteId === siteId;
        setResult(matched ? data : null);
        setError(false);
        if (matched && status && data.experiment.status !== status) onStateChanged?.();
        if (matched && (['running', 'paused'].includes(data.experiment.status) || (data.experiment.status === 'completed' && !data.conclusive))) timer = setTimeout(read, 30_000);
      }).catch(() => { if (active) setError(true); });
    }
    read();
    return () => { active = false; clearTimeout(timer); };
  }, [id, siteId, status, onStateChanged, attempt]);
  const control = result?.variants.find(variant => variant.isControl);
  const variants = result?.variants.filter(variant => !variant.isControl) ?? [];
  return <section aria-label="Resultado principal" className="mb-6 border-b border-border pb-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-semibold">{result && ['running', 'paused'].includes(result.experiment.status) ? 'Acompanhamento do experimento' : 'Resultado principal'}</h3>{result && <Badge tone={result.experiment.status === 'running' || result.conclusive ? 'green' : 'amber'} className="items-center gap-1.5"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />{result.experiment.status === 'running' ? 'Em andamento · Resultado parcial' : result.experiment.status === 'paused' ? 'Experimento pausado' : result.conclusive ? 'Resultado consolidado' : result.experiment.status === 'completed' ? 'Resultado em verificação' : 'Resultado não conclusivo'}</Badge>}</div>
    {error ? <DataState error title="Não foi possível carregar o resultado" description="Tente novamente para consultar os indicadores deste experimento." onRetry={() => setAttempt(value => value + 1)} />
      : result === undefined ? <DataState loading title="Consultando o resultado…" />
      : !result || !variants.length ? <DataState title="Resultado ainda indisponível" description="Ainda não há dados de variantes disponíveis para este experimento." />
      : <>
        <p className="mb-4 mt-2 break-words text-sm text-muted-foreground">Taxa de conversão · {result.goal?.name ?? 'Todas as metas de conversão'}</p>
        {result.coverageComplete === false && <p role="status" className="mb-4 text-sm text-muted-foreground">Parte do histórico não está disponível. O experimento não será concluído automaticamente com dados incompletos.</p>}
        <div className="space-y-5">{variants.map((variant, index) => <div key={variant.variantId}><ExperimentOutcome variant={{ ...variant, name: variants.length === 1 ? 'Mudança proposta' : `Mudança proposta ${index + 1}` }} control={control} partial={['running', 'paused'].includes(result.experiment.status)} /><ExperimentTrend report={result} variantId={variant.variantId} /></div>)}</div>
        {result.plan && !result.conclusive && <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Coleta planejada a partir de {result.plan.monthlyVisits.toLocaleString('pt-BR')} visitas mensais: pelo menos {result.plan.minimumPerArm.toLocaleString('pt-BR')} exposições por versão, para detectar uma diferença relativa de 10%. O encerramento também exige evidência suficiente; atingir a amostra mínima não garante uma conclusão.</p>}
      </>}
    {showMore && <Link href={`/results?experiment=${encodeURIComponent(id)}`} aria-label="Ver mais sobre o resultado deste experimento" className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4">Ver mais</Link>}
  </section>;
}
