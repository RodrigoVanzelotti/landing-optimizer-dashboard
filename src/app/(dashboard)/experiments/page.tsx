'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, type Experiment } from '@/lib/api';
import { Badge, Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { DataState } from '@/components/data-state';
import { ExperimentDetail } from '@/components/experiment-detail';
import { experimentStatusLabels as labels } from '@/lib/experiments';

interface Approval { id: string; riskScore: number; experiment: { id: string; name: string; type: string } }

export default function ExperimentsPage() {
  return <Suspense fallback={<DataState loading title="Carregando experimentos…" />}><ExperimentsContent /></Suspense>;
}

function ExperimentsContent() {
  const router = useRouter();
  const params = useSearchParams();
  const selected = params.get('review');
  const filter = params.get('filter') === 'review' ? 'review' : 'all';
  const [experiments, setExperiments] = useState<Experiment[] | null>(null);
  const [approvals, setApprovals] = useState<Approval[] | null>(null);
  const [error, setError] = useState(false);
  const [queueError, setQueueError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const refresh = useCallback(() => setAttempt(n => n + 1), []);

  useEffect(() => {
    let active = true;
    setError(false); setQueueError(false);
    void Promise.allSettled([
      api.get<Experiment[]>('/experiments').then(data => { if (active) setExperiments(data); }).catch(() => { if (active) setError(true); }),
      api.get<Approval[]>('/approvals?status=pending').then(data => { if (active) setApprovals(data); }).catch(() => { if (active) setQueueError(true); }),
    ]);
    return () => { active = false; };
  }, [attempt]);

  return <div lang="pt-BR">
    <PageHeader title="Experimentos" description="Da hipótese à decisão: acompanhe testes e revise alterações no mesmo lugar. Toda publicação exige aprovação humana."
      action={<Button variant="outline" className="h-11" onClick={refresh}>Atualizar</Button>} />
    <dl className="mb-8 grid grid-cols-1 gap-5 border-y border-border py-5 sm:grid-cols-3">
      {[['Experimentos carregados', error ? '—' : experiments?.length ?? '—'], ['Em execução', error ? '—' : experiments?.filter(e => e.status === 'running').length ?? '—'], ['Aguardando revisão', queueError ? '—' : approvals?.length ?? '—']].map(([label, value]) => <div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-2 text-3xl font-semibold tabular-nums">{value}</dd></div>)}
    </dl>
    <nav aria-label="Lista de experimentos" className="mb-6 flex flex-wrap gap-3">
      <Link href="/experiments" aria-current={filter === 'all' ? 'page' : undefined} className={`inline-flex min-h-11 items-center rounded-md border px-4 text-sm ${filter === 'all' ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted'}`}>Todos os experimentos</Link>
      <Link href="/experiments?filter=review" aria-current={filter === 'review' ? 'page' : undefined} className={`inline-flex min-h-11 items-center rounded-md border px-4 text-sm ${filter === 'review' ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted'}`}>Revisões pendentes{approvals && !queueError ? ` (${approvals.length})` : ''}</Link>
    </nav>
    {selected && <section className="mb-8 border-y border-border py-6" aria-label="Revisão do experimento">
      <Link href={filter === 'review' ? '/experiments?filter=review' : '/experiments'} className="mb-6 inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4">Fechar detalhes e voltar à lista</Link>
      <ExperimentDetail key={selected} id={selected} onChanged={refresh} />
    </section>}
    {filter === 'review'
      ? queueError ? <DataState error title="As revisões não carregaram" description="Tente novamente para consultar a fila de aprovações." onRetry={refresh} />
        : !approvals ? <DataState loading title="Consultando revisões…" />
        : !approvals.length ? <DataState title="Nenhuma revisão pendente" description="Quando um experimento for enviado para aprovação, você poderá conferir a proposta e tomar uma decisão aqui." />
        : <ul className="space-y-3">{approvals.map(row => <li key={row.id}><button type="button" onClick={() => router.push(`/experiments?filter=review&review=${encodeURIComponent(row.experiment.id)}`)} className="w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Card className="flex flex-col justify-between gap-3 shadow-none hover:border-primary sm:flex-row sm:items-center"><div className="min-w-0"><h2 className="break-words font-medium">{row.experiment.name}</h2><p className="mt-1 text-sm text-muted-foreground">{row.experiment.type} · Conferir proposta e decidir</p></div><Badge>Risco {row.riskScore}/100</Badge></Card></button></li>)}</ul>
      : error ? <DataState error title="Não foi possível carregar os experimentos" description="Confira sua conexão e tente novamente." onRetry={refresh} />
        : !experiments ? <DataState loading title="Consultando experimentos…" />
        : !experiments.length ? <DataState title="Sua próxima melhoria começa com uma hipótese" description="Gere uma sugestão em Insights de IA e transforme-a em um experimento. Você poderá revisar cada alteração antes de publicar." href="/insights" action="Explorar insights de IA" />
        : <ul className="space-y-3">{experiments.map(exp => <li key={exp.id}><Link href={`/experiments?review=${encodeURIComponent(exp.id)}`} aria-current={selected === exp.id ? 'true' : undefined} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Card className={`flex flex-col justify-between gap-3 shadow-none hover:border-primary sm:flex-row sm:items-center ${selected === exp.id ? 'border-primary' : ''}`}><div className="min-w-0"><h2 className="break-words font-medium">{exp.name}</h2><p className="mt-1 text-sm text-muted-foreground">{exp.type} · Risco {exp.riskScore}/100 · {Math.round(exp.allocation * 100)}% do tráfego</p></div><Badge>{labels[exp.status] ?? exp.status}</Badge></Card></Link></li>)}</ul>}
  </div>;
}
