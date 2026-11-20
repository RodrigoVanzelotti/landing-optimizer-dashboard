'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, type Experiment } from '@/lib/api';
import { Badge } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { DataState } from '@/components/data-state';
import { ExperimentDetail } from '@/components/experiment-detail';
import { experimentStatusLabels as labels } from '@/lib/experiments';
import { useSites } from '@/lib/use-sites';
import { PersistentPanel, TabLink } from '@/components/persistent-tabs';

interface Approval { id: string; riskScore: number; experiment: Experiment }

export default function ExperimentsPage() {
  return <Suspense fallback={<DataState loading title="Carregando experimentos…" />}><ExperimentsContent /></Suspense>;
}

function ExperimentsContent() {
  const { siteId } = useSites();
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
      api.get<Experiment[]>(`/experiments?siteId=${encodeURIComponent(siteId)}`).then(data => { if (active) setExperiments(data); }).catch(() => { if (active) setError(true); }),
      api.get<Approval[]>(`/approvals?status=pending&siteId=${encodeURIComponent(siteId)}`).then(data => { if (active) setApprovals(data); }).catch(() => { if (active) setQueueError(true); }),
    ]);
    return () => { active = false; };
  }, [attempt, siteId]);

  function href(tab: string, id?: string | null) {
    const query = new URLSearchParams();
    if (tab === 'review') query.set('filter', 'review');
    if (id) query.set('review', id);
    return `/experiments${query.size ? `?${query}` : ''}`;
  }

  function rows(items: Experiment[], tab: string) {
    return <ul className="space-y-3">{items.map(exp => {
      const open = filter === tab && selected === exp.id;
      const panelId = `experiment-${tab}-${exp.id}`;
      return <li key={exp.id} className="rounded-lg border border-border">
        <h2><TabLink href={href(tab, open ? null : exp.id)} role="button" aria-expanded={open} aria-controls={panelId} onKeyDown={event => { if (event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
          className="flex min-h-11 flex-col gap-3 rounded-lg p-5 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:flex-row sm:items-center sm:justify-between">
          <span className="min-w-0"><span className="block break-words font-medium">{exp.name}</span><span className="mt-1 block text-sm font-normal text-muted-foreground">{exp.type} · Risco {exp.riskScore}/100{tab === 'review' ? ' · Conferir proposta e decidir' : ` · ${Math.round(exp.allocation * 100)}% do tráfego`}</span></span>
          <span className="flex shrink-0 items-center gap-3 text-sm font-normal"><Badge>{labels[exp.status] ?? exp.status}</Badge><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={`h-5 w-5 ${open ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6" /></svg></span>
        </TabLink></h2>
        <div id={panelId}><PersistentPanel active={open}><section aria-label={`Detalhes de ${exp.name}`} className="border-t border-border p-5"><ExperimentDetail key={attempt} id={exp.id} siteId={siteId} onChanged={refresh} /></section></PersistentPanel></div>
      </li>;
    })}</ul>;
  }

  return <div lang="pt-BR">
    <PageHeader title="Experimentos" description="Publicação exige aprovação."
      action={<Button variant="outline" className="h-11" onClick={refresh}>Atualizar</Button>} />
    <dl className="mb-8 grid grid-cols-1 gap-5 border-y border-border py-5 sm:grid-cols-3">
      {[['Experimentos carregados', error ? '—' : experiments?.length ?? '—'], ['Em execução', error ? '—' : experiments?.filter(e => e.status === 'running').length ?? '—'], ['Aguardando revisão', queueError ? '—' : approvals?.length ?? '—']].map(([label, value]) => <div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-2 text-3xl font-semibold tabular-nums">{value}</dd></div>)}
    </dl>
    <nav aria-label="Lista de experimentos" className="mb-6 flex flex-wrap gap-3">
      <TabLink href={href('all', selected)} aria-current={filter === 'all' ? 'page' : undefined} className={`inline-flex min-h-11 items-center rounded-md border px-4 text-sm ${filter === 'all' ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted'}`}>Todos os experimentos</TabLink>
      <TabLink href={href('review', selected)} aria-current={filter === 'review' ? 'page' : undefined} className={`inline-flex min-h-11 items-center rounded-md border px-4 text-sm ${filter === 'review' ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted'}`}>Revisões pendentes{approvals && !queueError ? ` (${approvals.length})` : ''}</TabLink>
    </nav>
    <PersistentPanel active={filter === 'review'}>
      {queueError ? <DataState error title="As revisões não carregaram" description="Tente novamente para consultar a fila de aprovações." onRetry={refresh} />
        : !approvals ? <DataState loading title="Consultando revisões…" />
        : !approvals.length ? <DataState title="Nenhuma revisão pendente" description="Quando um experimento for enviado para aprovação, você poderá conferir a proposta e tomar uma decisão aqui." />
        : rows(approvals.map(row => ({ ...row.experiment, riskScore: row.riskScore })), 'review')}
    </PersistentPanel>
    <PersistentPanel active={filter === 'all'}>
      {error ? <DataState error title="Não foi possível carregar os experimentos" description="Confira sua conexão e tente novamente." onRetry={refresh} />
        : !experiments ? <DataState loading title="Consultando experimentos…" />
        : !experiments.length ? <DataState title="Sua próxima melhoria começa com uma hipótese" description="Gere uma sugestão em Insights de IA e transforme-a em um experimento. Você poderá revisar cada alteração antes de publicar." href="/insights" action="Explorar insights de IA" />
        : rows(experiments, 'all')}
      {selected && experiments && !experiments.some(exp => exp.id === selected) && <DataState error title="Experimento indisponível neste site" description="Selecione o site correspondente no topo da página ou escolha um experimento da lista." />}
    </PersistentPanel>
  </div>;
}
