'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api, type Experiment, type InsightSuggestion } from '@/lib/api';
import { Badge, Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { DataState } from '@/components/data-state';
import { ExperimentDetail } from '@/components/experiment-detail';
import { ExperimentStatus } from '@/components/experiment-status';
import { experimentTypeLabels, experimentStages, experimentStage, experimentExpiry, filterExperiments } from '@/lib/experiments';
import { useSites } from '@/lib/use-sites';
import { PersistentPanel, TabLink } from '@/components/persistent-tabs';
import { InsightPreparationNotice } from '@/components/insight-preparation-notice';

const control = 'min-h-11 w-full min-w-0 rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-primary';
const dateLabel = (value: number) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
const filterKeys = ['q', 'type', 'risk', 'origin', 'period', 'sort', 'filter', 'review'];

export default function ExperimentsPage() {
  return <Suspense fallback={<DataState loading title="Carregando experimentos…" />}><ExperimentsContent /></Suspense>;
}

function ExperimentsContent() {
  const params = useSearchParams();
  const { siteId } = useSites();
  return <ExperimentsList key={siteId} siteId={siteId} insightId={params.get('insight')} />;
}

function ExperimentsList({ siteId, insightId }: { siteId: string; insightId: string | null }) {
  const params = useSearchParams();
  const selected = params.get('review');
  const dialog = useRef<HTMLDialogElement>(null);
  const [experiments, setExperiments] = useState<Experiment[] | null>(null);
  const previousStatuses = useRef(new Map<string, string>());
  const [error, setError] = useState(false);
  const [originResource, setOriginResource] = useState<{ id?: string; data?: InsightSuggestion | null; error?: boolean }>({});
  const [attempt, setAttempt] = useState(0);
  const [detailAttempt, setDetailAttempt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const refreshList = useCallback(() => { setNow(Date.now()); setAttempt(n => n + 1); }, []);
  const refresh = useCallback(() => { refreshList(); setDetailAttempt(n => n + 1); }, [refreshList]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    setError(false);
    api.get<Experiment[]>(`/experiments?siteId=${encodeURIComponent(siteId)}`)
      .then(data => { if (active) setExperiments(data); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [attempt, siteId]);
  useEffect(() => {
    if (!insightId) return;
    let active = true;
    setOriginResource({ id: insightId });
    api.get<InsightSuggestion[]>(`/sites/${encodeURIComponent(siteId)}/ai/suggestions?insightId=${encodeURIComponent(insightId)}`)
      .then(data => { if (active) setOriginResource({ id: insightId, data: data.find(item => item.id === insightId) ?? null }); })
      .catch(() => { if (active) setOriginResource({ id: insightId, error: true }); });
    return () => { active = false; };
  }, [attempt, siteId, insightId]);
  const origin = originResource.id === insightId ? originResource.data : undefined;
  const originError = originResource.id === insightId && originResource.error;

  const filters = { search: params.get('q') ?? '', type: params.get('type') ?? '', risk: params.get('risk') ?? '', origin: params.get('origin') ?? '', period: params.get('period') ?? '', sort: params.get('sort') ?? 'newest' };
  const legacyReview = params.get('filter') === 'review';
  const requestedStage = params.get('stage') ?? (legacyReview ? 'waiting' : '');
  const selectedStage = experimentStages.find(item => item.id === requestedStage);
  const stage = selectedStage?.id ?? '';
  const view = params.get('view') === 'list' ? 'list' : 'board';
  const activeFilters = [filters.search, filters.type, filters.risk, filters.origin, filters.period, legacyReview].filter(Boolean).length;
  const scoped = (experiments ?? []).filter(exp => !insightId || exp.insightId === insightId);
  const matches = filterExperiments(scoped, filters, now).filter(exp => !legacyReview || exp.status === 'pending_review');
  const visible = matches.filter(exp => !stage || experimentStage(exp, now) === stage);
  const stageCount = (id: string, items = matches) => items.filter(exp => experimentStage(exp, now) === id).length;

  function href(id?: string | null) {
    const query = new URLSearchParams(params.toString());
    if (id) query.set('review', id); else query.delete('review');
    return `/experiments${query.size ? `?${query}` : ''}`;
  }
  const clearQuery = new URLSearchParams(params.toString());
  filterKeys.forEach(key => clearQuery.delete(key));
  const clearHref = `/experiments${clearQuery.size ? `?${clearQuery}` : ''}`;
  function updateFilter(key: string, value: string, push = false) {
    const query = new URLSearchParams(window.location.search);
    if (value && !(key === 'sort' && value === 'newest') && !(key === 'view' && value === 'board')) query.set(key, value);
    else query.delete(key);
    if (key !== 'view') query.delete('review');
    if (key === 'stage') query.delete('filter');
    const url = `/experiments${query.size ? `?${query}` : ''}`;
    if (push) window.history.pushState(null, '', url);
    else window.history.replaceState(null, '', url);
  }

  const failed = error || originError;
  const loading = !experiments || (insightId && origin === undefined);
  const ready = !failed && !loading && !(insightId && origin === null);
  const selectedVisible = scoped.some(exp => exp.id === selected);
  useEffect(() => {
    if (!experiments) return;
    for (const exp of experiments) {
      const previous = previousStatuses.current.get(exp.id);
      if (previous && previous !== exp.status && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        for (const id of [`pipeline-card-${exp.id}`, `experiment-detail-${exp.id}`]) {
          document.getElementById(id)?.animate?.([
            { transform: 'perspective(1200px) rotateX(0deg)', opacity: 1, offset: 0 },
            { transform: 'perspective(1200px) rotateX(90deg)', opacity: 0, offset: 0.45 },
            { transform: 'perspective(1200px) rotateX(-90deg)', opacity: 0, offset: 0.46 },
            { transform: 'perspective(1200px) rotateX(0deg)', opacity: 1 },
          ], { duration: 500, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
        }
      }
    }
    previousStatuses.current = new Map(experiments.map(exp => [exp.id, exp.status]));
  }, [experiments]);
  useEffect(() => {
    if (!selected || !ready || !selectedVisible) return;
    const modal = dialog.current;
    if (!modal) return;
    modal.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      modal.close();
      document.body.style.overflow = overflow;
      const card = document.getElementById(`card-${selected}`);
      card?.focus({ preventScroll: true });
      card?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    };
  }, [selected, ready, selectedVisible]);

  function closeDetails() {
    window.history.pushState(null, '', href());
  }

  function experimentCard(exp: Experiment, list = false) {
    const column = experimentStage(exp, now);
    const open = selected === exp.id;
    const expiry = experimentExpiry(exp);
    const age = Math.max(0, Math.floor((now - Date.parse(exp.createdAt)) / 86_400_000));
    return <li key={exp.id} id={`pipeline-card-${exp.id}`} className={`relative min-w-0 origin-center rounded-lg border bg-card p-3 hover:border-foreground focus-within:border-foreground ${open ? 'border-foreground' : 'border-border'}`}>
      <div className={list ? 'grid items-center gap-x-5 gap-y-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' : ''}>
        <div className="min-w-0"><h3><TabLink id={`card-${exp.id}`} href={href(exp.id)} role="button" aria-haspopup="dialog" aria-expanded={open} aria-controls="experiment-dialog" onKeyDown={event => { if (event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }} className="block min-h-11 break-words rounded py-2 text-left text-sm font-medium leading-snug after:absolute after:inset-0 after:rounded-lg focus-visible:outline-primary">{exp.name}</TabLink></h3>
          <p className="text-xs leading-relaxed text-muted-foreground">{experimentTypeLabels[exp.type] ?? 'Outro tipo'}</p>
        </div>
        <div className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 ${list ? 'sm:mt-0 sm:justify-end' : ''}`}>
          {exp.insightId && <Link href={`/insights?insight=${encodeURIComponent(exp.insightId)}`} aria-label={`Ver insight de IA de origem de ${exp.name}`} className="relative z-10 inline-flex min-h-11 items-center text-xs text-primary underline underline-offset-4">Insight de origem</Link>}
          {column === 'results' && <Link href={`/results?experiment=${encodeURIComponent(exp.id)}`} className="relative z-10 inline-flex min-h-11 items-center text-xs text-primary underline underline-offset-4">Ver resultados</Link>}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border pt-2 text-xs tabular-nums">
        <span title={`Criado em ${dateLabel(Date.parse(exp.createdAt))}`} className="text-muted-foreground">{age === 0 ? 'Criado hoje' : `Criado há ${age} ${age === 1 ? 'dia' : 'dias'}`}</span>
        <span>Risco {exp.riskScore}/100</span>
      </div>
      {expiry !== null && <p className="mt-1 text-xs text-muted-foreground">{column === 'expired' ? 'Venceu em' : 'Válido até'} <time dateTime={new Date(expiry).toISOString()}>{dateLabel(expiry)}</time></p>}
      <footer className="mt-3 flex justify-end"><ExperimentStatus experiment={exp} now={now} /></footer>
    </li>;
  }

  return <div lang="pt-BR">
    <PageHeader title="Experimentos" description="Acompanhe as propostas, os testes em execução e seus resultados."
      action={<Button variant="outline" className="h-11" onClick={refresh}>Atualizar</Button>} />
    {insightId && <div role="status" className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm"><p>Exibindo os experimentos vinculados a um insight de IA.</p><Link href={`/insights?insight=${encodeURIComponent(insightId)}`} className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">Ver insight de origem</Link><Link href="/experiments" className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">Ver todos os experimentos</Link></div>}
    {origin?.payload.title && <p className="mb-4 break-words text-sm"><span className="font-medium">Insight de origem:</span> {origin.payload.title}</p>}
    {origin?.approvedAt && !origin.experimentsReadyAt && <div className="mb-6"><InsightPreparationNotice approvedAt={origin.approvedAt} /></div>}

    <dl className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{[
      ['Experimentos no pipeline', scoped.length], ['Em experimentação', stageCount('running', scoped)],
      ['Resultados disponíveis', stageCount('results', scoped)], ['Vencidos e negados', stageCount('expired', scoped) + stageCount('rejected', scoped)],
    ].map(([label, value], index) => <Card key={label} className={`p-4 shadow-none ${index === 0 ? 'border-foreground' : ''}`}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-2 text-2xl font-semibold tabular-nums">{experiments && !error ? value : '—'}</dd></Card>)}</dl>

    <section aria-label="Controles do pipeline" className="mb-4 overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-3"><h2 className="text-sm font-medium">Experimentos por etapa</h2>
        <div role="group" aria-label="Visualização dos experimentos" className="inline-flex rounded-lg border border-border bg-background p-1">{[['board', 'Quadro'], ['list', 'Lista']].map(([value, label]) => <Button key={value} variant="ghost" className={`h-11 ${view === value ? 'bg-foreground text-background hover:bg-foreground' : ''}`} aria-pressed={view === value} onClick={() => updateFilter('view', value, true)}>{label}</Button>)}</div>
      </div>
      <div className="px-4 py-3">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2"><div className="w-full sm:max-w-sm"><label htmlFor="experiment-search" className="mb-1.5 block text-xs font-medium">Buscar experimento</label><input id="experiment-search" type="search" value={filters.search} onChange={event => updateFilter('q', event.target.value)} placeholder="Nome do experimento" className={control} /></div><p role="status" className="py-3 text-xs tabular-nums text-muted-foreground">{experiments ? `${visible.length} de ${scoped.length} experimentos${activeFilters ? ' com os filtros aplicados' : ''}` : 'Carregando experimentos…'}</p></div>
        <nav aria-label="Etapas dos experimentos" className="mt-3 flex flex-wrap gap-1 rounded-lg border border-border p-1 sm:w-fit">{[{ id: '', label: 'Todas as etapas' }, ...experimentStages].map(item => <Button key={item.id} variant="ghost" className={`min-h-11 h-auto max-w-full whitespace-normal px-3 py-2 text-xs ${stage === item.id ? 'bg-foreground text-background hover:bg-foreground' : 'text-muted-foreground'}`} aria-pressed={stage === item.id} onClick={() => updateFilter('stage', item.id, true)}>{item.label}<span className="ml-2 tabular-nums opacity-80">{experiments ? item.id ? stageCount(item.id) : matches.length : '—'}</span></Button>)}</nav>
        <details className="mt-2">
          <summary className="min-h-11 w-fit cursor-pointer py-3 text-sm font-medium focus-visible:outline-primary">Filtros{activeFilters > 0 ? ` (${activeFilters})` : ''}</summary>
          {legacyReview && <p className="mb-3 text-xs text-muted-foreground">Somente revisões pendentes. Use Limpar filtros para ver a etapa completa.</p>}
          <div className="grid gap-4 pb-3 sm:grid-cols-2 lg:grid-cols-5">
            <div><label htmlFor="experiment-type" className="mb-1.5 block text-xs">Tipo de alteração</label><select id="experiment-type" value={filters.type} onChange={event => updateFilter('type', event.target.value)} className={control}><option value="">Todos os tipos</option>{Object.entries(experimentTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <div><label htmlFor="experiment-risk" className="mb-1.5 block text-xs">Pontuação de risco</label><select id="experiment-risk" value={filters.risk} onChange={event => updateFilter('risk', event.target.value)} className={control}><option value="">Qualquer risco</option><option value="low">Baixo: 0 a 30</option><option value="medium">Médio: 31 a 60</option><option value="high">Alto: 61 a 100</option></select></div>
            <div><label htmlFor="experiment-origin" className="mb-1.5 block text-xs">Origem</label><select id="experiment-origin" value={filters.origin} onChange={event => updateFilter('origin', event.target.value)} className={control}><option value="">Todas as origens</option><option value="insight">Insight de IA</option><option value="other">Sem insight vinculado</option></select></div>
            <div><label htmlFor="experiment-period" className="mb-1.5 block text-xs">Criado em</label><select id="experiment-period" value={filters.period} onChange={event => updateFilter('period', event.target.value)} className={control}><option value="">Todo o histórico</option><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option></select></div>
            <div><label htmlFor="experiment-sort" className="mb-1.5 block text-xs">Ordenar por</label><select id="experiment-sort" value={filters.sort} onChange={event => updateFilter('sort', event.target.value)} className={control}><option value="newest">Mais recentes</option><option value="oldest">Mais antigos</option><option value="risk">Maior risco</option><option value="name">Nome de A a Z</option></select></div>
          </div>
        </details>
        {activeFilters > 0 && <TabLink href={clearHref} className="inline-flex min-h-11 items-center text-xs text-primary underline underline-offset-4">Limpar filtros</TabLink>}
      </div>
    </section>

    {failed ? <DataState error title="Não foi possível carregar os experimentos" description="Confira sua conexão e tente novamente." onRetry={refresh} />
      : loading ? <DataState loading title="Consultando experimentos…" />
      : insightId && origin === null ? <DataState error title="Insight indisponível neste site" description="Confira o site selecionado ou consulte todos os experimentos." href="/experiments" action="Ver todos os experimentos" />
      : null}
    {ready && <>
      <p className="mb-4 text-xs leading-relaxed text-muted-foreground">Propostas vencem após 7 dias sem iniciar. Testes iniciados e resultados não vencem.</p>
      {!scoped.length && (origin?.approvedAt && !origin.experimentsReadyAt
        ? <p className="mb-6 text-sm text-muted-foreground">Os experimentos aparecerão aqui quando estiverem prontos. Use Atualizar para consultar a situação.</p>
        : <div className="mb-6"><DataState title="Sua próxima melhoria começa com uma hipótese" description="Após aprovar um insight de IA, seus experimentos ficarão prontos em até 24 horas e aparecerão aqui já aprovados." href="/insights" action="Explorar insights de IA" /></div>)}
      {scoped.length > 0 && !visible.length && <p role="status" className="mb-4 text-sm">Nenhum experimento corresponde aos filtros. Ajuste os parâmetros ou use Limpar filtros e Todas as etapas.</p>}
      {view === 'board' ? <div role="region" aria-label="Pipeline de experimentos" tabIndex={0} className="overflow-x-auto pb-4 focus-visible:outline-primary">
        <div className={stage ? 'grid grid-cols-1' : 'grid grid-cols-1 items-start gap-3 md:grid-cols-[repeat(6,minmax(208px,1fr))]'}>
          {(selectedStage ? [selectedStage] : experimentStages).map(column => {
            const items = visible.filter(exp => experimentStage(exp, now) === column.id);
            return <section key={column.id} aria-labelledby={`stage-${column.id}`} className={`min-w-0 rounded-lg border border-t-2 ${column.id === 'accepted' ? 'border-green-200 border-t-green-700 bg-green-50/60' : column.id === 'rejected' ? 'border-red-200 border-t-red-700 bg-red-50/60' : 'border-border border-t-foreground bg-muted/40'}`}>
              <header className="flex min-h-11 items-center justify-between gap-3 border-b border-border bg-card px-3 py-2"><h2 id={`stage-${column.id}`} className="flex min-w-0 items-center gap-2 text-xs font-medium"><span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-foreground" />{column.label}</h2><Badge className="shrink-0 border border-border bg-background tabular-nums">{items.length}</Badge></header>
              <ul className={stage ? 'grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3' : 'space-y-2 p-2'}>{items.map(exp => experimentCard(exp))}</ul>
              {!items.length && <p className="px-3 pb-5 pt-2 text-xs text-muted-foreground">Nenhum experimento nesta etapa.</p>}
            </section>;
          })}
        </div>
      </div> : <section aria-labelledby="experiment-list-title" className="rounded-lg border border-border bg-muted/40"><header className="flex min-h-11 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3"><h2 id="experiment-list-title" className="text-sm font-medium">{selectedStage?.label ?? 'Todos os experimentos'}</h2><Badge className="tabular-nums">{visible.length}</Badge></header><ul className="space-y-2 p-3">{visible.map(exp => experimentCard(exp, true))}</ul>{!visible.length && <p className="px-4 pb-5 text-sm text-muted-foreground">Nenhum experimento nesta seleção.</p>}</section>}
      <dialog ref={dialog} id="experiment-dialog" aria-label="Detalhes do experimento" className="mx-auto mb-auto mt-4 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto overscroll-contain rounded-xl bg-background p-0 text-foreground shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-sm sm:mt-8 sm:max-h-[calc(100dvh-4rem)]"
        onCancel={event => { event.preventDefault(); closeDetails(); }}
        onClick={event => { if (event.target === event.currentTarget) closeDetails(); }}>
        <div className="p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3"><p className="text-sm font-medium">Detalhes do experimento</p><Button variant="ghost" autoFocus aria-label="Fechar detalhes do experimento" className="h-11 w-11 shrink-0 p-0" onClick={closeDetails}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><path d="m6 6 12 12M6 18 18 6" /></svg></Button></div>
          {experiments!.map(exp => <PersistentPanel key={exp.id} active={selected === exp.id && selectedVisible}><section id={`experiment-detail-${exp.id}`} aria-label={`Detalhes de ${exp.name}`} className="min-w-0 origin-center break-words"><ExperimentDetail key={detailAttempt} id={exp.id} siteId={siteId} onChanged={refreshList} /></section></PersistentPanel>)}
        </div>
      </dialog>
      {selected && !selectedVisible && <DataState error title="Experimento indisponível nesta seleção" description="Confira o site, o insight e os filtros ou escolha outro experimento do quadro." />}
    </>}
  </div>;
}
