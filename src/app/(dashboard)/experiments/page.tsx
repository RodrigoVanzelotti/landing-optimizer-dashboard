'use client';

import { Suspense, useCallback, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api, type Experiment, type InsightSuggestion } from '@/lib/api';
import { Badge } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { DataState } from '@/components/data-state';
import { ExperimentDetail } from '@/components/experiment-detail';
import { experimentStatusLabels as labels, experimentTypeLabels, experimentStages, experimentStage, experimentExpiry, filterExperiments } from '@/lib/experiments';
import { useSites } from '@/lib/use-sites';
import { PersistentPanel, TabLink } from '@/components/persistent-tabs';
import { InsightPreparationNotice } from '@/components/insight-preparation-notice';

const control = 'min-h-11 w-full min-w-0 rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-primary';
const dateLabel = (value: number) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

export default function ExperimentsPage() {
  return <Suspense fallback={<DataState loading title="Carregando experimentos…" />}><ExperimentsContent /></Suspense>;
}

function ExperimentsContent() {
  const params = useSearchParams();
  const { siteId } = useSites();
  const insightId = params.get('insight');
  return <ExperimentsList key={`${siteId}:${insightId ?? 'all'}`} siteId={siteId} insightId={insightId} />;
}

function ExperimentsList({ siteId, insightId }: { siteId: string; insightId: string | null }) {
  const params = useSearchParams();
  const selected = params.get('review');
  const [experiments, setExperiments] = useState<Experiment[] | null>(null);
  const [error, setError] = useState(false);
  const [origin, setOrigin] = useState<InsightSuggestion | null>();
  const [originError, setOriginError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const refresh = useCallback(() => { setNow(Date.now()); setAttempt(n => n + 1); }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    setError(false); setOriginError(false);
    void Promise.allSettled([
      api.get<Experiment[]>(`/experiments?siteId=${encodeURIComponent(siteId)}${insightId ? `&insightId=${encodeURIComponent(insightId)}` : ''}`).then(data => { if (active) setExperiments(data); }).catch(() => { if (active) setError(true); }),
      ...(insightId ? [api.get<InsightSuggestion[]>(`/sites/${siteId}/ai/suggestions?insightId=${encodeURIComponent(insightId)}`).then(data => { if (active) setOrigin(data[0] ?? null); }).catch(() => { if (active) setOriginError(true); })] : []),
    ]);
    return () => { active = false; };
  }, [attempt, siteId, insightId]);

  const filters = { search: params.get('q') ?? '', type: params.get('type') ?? '', risk: params.get('risk') ?? '', origin: params.get('origin') ?? '', period: params.get('period') ?? '', sort: params.get('sort') ?? 'newest' };
  const stage = params.get('stage') ?? (params.get('filter') === 'review' ? 'waiting' : '');
  const activeFilters = [filters.search, filters.type, filters.risk, filters.origin, filters.period, stage].filter(Boolean).length;
  const visible = filterExperiments(experiments ?? [], filters, now).filter(exp => (!stage || experimentStage(exp, now) === stage) && (params.get('filter') !== 'review' || exp.status === 'pending_review'));

  function href(id?: string | null) {
    const query = new URLSearchParams(params.toString());
    if (id) query.set('review', id); else query.delete('review');
    return `/experiments${query.size ? `?${query}` : ''}`;
  }
  const clearHref = `/experiments${insightId ? `?insight=${encodeURIComponent(insightId)}` : ''}`;
  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const query = new URLSearchParams();
    if (insightId) query.set('insight', insightId);
    for (const key of ['q', 'type', 'risk', 'origin', 'period', 'stage', 'sort']) {
      const value = String(data.get(key) ?? '').trim();
      if (value && !(key === 'sort' && value === 'newest')) query.set(key, value);
    }
    window.history.pushState(null, '', `/experiments${query.size ? `?${query}` : ''}`);
  }

  const failed = error || originError;
  const loading = !experiments || (insightId && origin === undefined);
  const ready = !failed && !loading && !(insightId && origin === null);
  useEffect(() => {
    if (!selected || !ready) return;
    const detail = document.getElementById(`experiment-${selected}`);
    detail?.scrollIntoView?.({ block: 'start' });
    detail?.focus({ preventScroll: true });
  }, [selected, ready]);

  return <div lang="pt-BR">
    <PageHeader title="Experimentos" description="Da proposta ao resultado: acompanhe cada experimento pelo quadro."
      action={<Button variant="outline" className="h-11" onClick={refresh}>Atualizar</Button>} />
    {insightId && <div role="status" className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm"><p>Exibindo os experimentos vinculados a um insight de IA.</p><Link href={`/insights?insight=${encodeURIComponent(insightId)}`} className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">Ver insight de origem</Link><Link href="/experiments" className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">Ver todos os experimentos</Link></div>}
    {origin?.payload.title && <p className="mb-4 break-words text-sm"><span className="font-medium">Insight de origem:</span> {origin.payload.title}</p>}
    {origin?.approvedAt && !origin.experimentsReadyAt && <div className="mb-6"><InsightPreparationNotice approvedAt={origin.approvedAt} /></div>}

    <form key={params.toString()} onSubmit={applyFilters} aria-label="Filtrar experimentos" className="mb-6 border-y border-border py-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 basis-60"><label htmlFor="experiment-search" className="mb-1.5 block text-sm font-medium">Buscar experimento</label><input id="experiment-search" name="q" type="search" defaultValue={filters.search} placeholder="Nome do experimento" className={control} /></div>
        <div className="min-w-0 flex-1 basis-44 sm:max-w-56"><label htmlFor="experiment-sort" className="mb-1.5 block text-sm font-medium">Ordenar por</label><select id="experiment-sort" name="sort" defaultValue={filters.sort} className={control}><option value="newest">Mais recentes</option><option value="oldest">Mais antigos</option><option value="risk">Maior risco</option><option value="name">Nome de A a Z</option></select></div>
        <Button type="submit" variant="outline" className="h-11">Aplicar</Button>
        {activeFilters > 0 && <TabLink href={clearHref} className="inline-flex min-h-11 items-center px-2 text-sm text-primary underline underline-offset-4">Limpar filtros</TabLink>}
      </div>
      <details className="mt-3" open={activeFilters > 0 || undefined}>
        <summary className="min-h-11 w-fit cursor-pointer py-3 text-sm font-medium focus-visible:outline-primary">Filtros{activeFilters > 0 ? ` (${activeFilters})` : ''}</summary>
        <div className="grid gap-4 pb-2 pt-2 sm:grid-cols-2 lg:grid-cols-5">
          <div><label htmlFor="experiment-stage" className="mb-1.5 block text-sm">Etapa</label><select id="experiment-stage" name="stage" defaultValue={stage} className={control}><option value="">Todas as etapas</option>{experimentStages.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
          <div><label htmlFor="experiment-type" className="mb-1.5 block text-sm">Tipo de alteração</label><select id="experiment-type" name="type" defaultValue={filters.type} className={control}><option value="">Todos os tipos</option>{Object.entries(experimentTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <div><label htmlFor="experiment-risk" className="mb-1.5 block text-sm">Pontuação de risco</label><select id="experiment-risk" name="risk" defaultValue={filters.risk} className={control}><option value="">Qualquer risco</option><option value="low">Baixo: 0 a 30</option><option value="medium">Médio: 31 a 60</option><option value="high">Alto: 61 a 100</option></select></div>
          <div><label htmlFor="experiment-origin" className="mb-1.5 block text-sm">Origem</label><select id="experiment-origin" name="origin" defaultValue={filters.origin} className={control}><option value="">Todas as origens</option><option value="insight">Insight de IA</option><option value="other">Sem insight vinculado</option></select></div>
          <div><label htmlFor="experiment-period" className="mb-1.5 block text-sm">Criado em</label><select id="experiment-period" name="period" defaultValue={filters.period} className={control}><option value="">Todo o histórico</option><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option></select></div>
        </div>
      </details>
    </form>

    {failed ? <DataState error title="Não foi possível carregar os experimentos" description="Confira sua conexão e tente novamente." onRetry={refresh} />
      : loading ? <DataState loading title="Consultando experimentos…" />
      : insightId && origin === null ? <DataState error title="Insight indisponível neste site" description="Confira o site selecionado ou consulte todos os experimentos." href="/experiments" action="Ver todos os experimentos" />
      : null}
    {ready && <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-2 text-sm"><p role="status" className="tabular-nums">{visible.length} de {experiments!.length} experimentos{activeFilters ? ' com os filtros aplicados' : ''}</p><p className="max-w-prose text-muted-foreground">Propostas vencem após 7 dias sem iniciar. Testes iniciados e resultados não vencem.</p></div>
      {!experiments!.length && (origin?.approvedAt && !origin.experimentsReadyAt
        ? <p className="mb-6 text-sm text-muted-foreground">Os experimentos aparecerão aqui quando estiverem prontos. Use Atualizar para consultar a situação.</p>
        : <div className="mb-6"><DataState title="Sua próxima melhoria começa com uma hipótese" description="Após aprovar um insight de IA, seus experimentos ficarão prontos em até 24 horas e aparecerão aqui já aprovados." href="/insights" action="Explorar insights de IA" /></div>)}
      {!!experiments!.length && !visible.length && <p role="status" className="mb-6 text-sm">Nenhum experimento corresponde aos filtros. Ajuste os parâmetros ou use Limpar filtros.</p>}
      <div role="region" aria-label="Pipeline de experimentos" tabIndex={0} className="overflow-x-auto pb-4 focus-visible:outline-primary">
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[repeat(5,minmax(208px,1fr))]">
          {experimentStages.map(column => {
            const items = visible.filter(exp => experimentStage(exp, now) === column.id);
            return <section key={column.id} aria-labelledby={`stage-${column.id}`} className="min-w-0 rounded-lg bg-muted/50 p-3">
              <header className="mb-4 md:min-h-20"><div className="flex items-start justify-between gap-2"><h2 id={`stage-${column.id}`} className="text-sm font-semibold">{column.label}</h2><span aria-label={`${items.length} experimentos`} className="text-xs tabular-nums text-muted-foreground">{items.length}</span></div><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{column.description}</p></header>
              <ul className="space-y-3">{items.map(exp => {
                const open = selected === exp.id;
                const expiry = experimentExpiry(exp);
                return <li key={exp.id} className={`min-w-0 rounded-lg border bg-card p-4 ${open ? 'border-primary' : 'border-border'}`}>
                  <h3><TabLink id={`card-${exp.id}`} href={href(open ? null : exp.id)} role="button" aria-expanded={open} aria-controls={`experiment-${exp.id}`} onKeyDown={event => { if (event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }} className="block min-h-11 break-words rounded text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-primary">{exp.name}</TabLink></h3>
                  <Badge>{column.id === 'expired' ? 'Vencido' : labels[exp.status] ?? exp.status}</Badge>
                  {exp.status === 'approved' && column.id !== 'expired' && <p className="mt-2 text-xs font-medium">Aprovado · Pronto para iniciar</p>}
                  <dl className="mt-3 space-y-1 text-xs text-muted-foreground"><div className="flex flex-wrap gap-x-1"><dt>Tipo:</dt><dd>{experimentTypeLabels[exp.type] ?? 'Outro tipo'}</dd></div><div className="flex gap-1"><dt>Risco:</dt><dd>{exp.riskScore}/100</dd></div><div className="flex flex-wrap gap-x-1"><dt>Criado em:</dt><dd>{dateLabel(Date.parse(exp.createdAt))}</dd></div>{expiry !== null && <div className="flex flex-wrap gap-x-1"><dt>{column.id === 'expired' ? 'Venceu em:' : 'Válido até:'}</dt><dd><time dateTime={new Date(expiry).toISOString()}>{dateLabel(expiry)}</time></dd></div>}</dl>
                  <div className="mt-2 flex flex-col text-xs">{exp.insightId && <Link href={`/insights?insight=${encodeURIComponent(exp.insightId)}`} className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">Ver insight de IA de origem</Link>}{column.id === 'results' && <Link href={`/results?experiment=${encodeURIComponent(exp.id)}`} className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">Ver resultados</Link>}</div>
                </li>;
              })}</ul>
              {!items.length && <p className="py-5 text-xs text-muted-foreground">Nenhum experimento nesta etapa.</p>}
            </section>;
          })}
        </div>
      </div>
      {experiments!.map(exp => <div key={exp.id} id={`experiment-${exp.id}`} tabIndex={-1} className="focus-visible:outline-primary"><PersistentPanel active={selected === exp.id && visible.some(item => item.id === exp.id)}><section aria-label={`Detalhes de ${exp.name}`} className="mt-6 border-t border-border pt-6"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-medium">Detalhes do experimento selecionado</p><TabLink href={href()} onClick={() => { const card = document.getElementById(`card-${exp.id}`); card?.focus(); }} className="inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4">Fechar detalhes</TabLink></div><ExperimentDetail key={attempt} id={exp.id} siteId={siteId} onChanged={refresh} /></section></PersistentPanel></div>)}
      {selected && !visible.some(exp => exp.id === selected) && <DataState error title="Experimento indisponível nesta seleção" description="Confira o site, o insight e os filtros ou escolha outro experimento do quadro." />}
    </>}
  </div>;
}
