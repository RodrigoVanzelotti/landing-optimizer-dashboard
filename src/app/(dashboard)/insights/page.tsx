'use client';

import { toast } from '@/components/ui/toast';

import type * as React from 'react';
import { useSession } from '@/lib/session';
import { canEdit } from '@/lib/permissions';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api, type InsightSuggestion } from '@/lib/api';
import { useSites } from '@/lib/use-sites';
import { Card, Badge } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { DataState } from '@/components/data-state';
import { InsightEvidence } from '@/components/insight-evidence';
import { experimentStatusLabels } from '@/lib/experiments';
import { InsightPreparationNotice } from '@/components/insight-preparation-notice';
import { userErrorMessage } from '@/lib/errors';

const filters = { all: 'Todos os status', accepted: 'Aceitos', generating: 'Experimentos sendo gerados', rejected: 'Rejeitados' } as const;
type Filter = keyof typeof filters;
function matchesFilter(s: InsightSuggestion, filter: Filter) {
  if (filter === 'rejected') return !!s.rejectedAt;
  if (filter === 'accepted') return !!s.approvedAt && !s.rejectedAt;
  if (filter === 'generating') return !!s.approvedAt && !s.experimentsReadyAt && !s.rejectedAt;
  return true;
}

const riskLabels: Record<string, string> = { low: 'baixo', medium: 'médio', high: 'alto' };
const suggestionKindLabels: Record<string, string> = {
  hypothesis: 'Hipótese', headline: 'Título', cta: 'Chamada para ação',
  friction: 'Dificuldade de uso', section: 'Seção', score: 'Pontuação', plan: 'Plano',
};

export default function InsightsPage(): React.ReactElement {
  return <Suspense fallback={<DataState loading title="Carregando insights…" />}><InsightsRoute /></Suspense>;
}

function InsightsRoute() {
  const params = useSearchParams();
  const insightId = params.get('insight');
  const { siteId } = useSites();
  return <InsightsContent key={`${siteId}:${insightId ?? 'all'}`} insightId={insightId} />;
}

function InsightsContent({ insightId }: { insightId: string | null }): React.ReactElement {
  const editable = canEdit(useSession().role);
  const { siteId, loading: sitesLoading, error: sitesError } = useSites();
  const [suggestions, setSuggestions] = useState<InsightSuggestion[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const pending = useRef(false);
  const request = useRef(0);
  const [decision, setDecision] = useState<'approve' | 'reject'>('approve');
  const [confirmReject, setConfirmReject] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  function load(id: string): Promise<void> {
    const version = ++request.current;
    setLoading(true); setError(false);
    return api
      .get<InsightSuggestion[]>(`/sites/${id}/ai/suggestions${insightId ? `?insightId=${encodeURIComponent(insightId)}` : ''}`)
      .then(items => { if (version === request.current) setSuggestions(items.filter(item => !['synthetic-demo', 'stub-v1'].includes(item.model) && !item.payload.title?.startsWith('[MOCK]'))); })
      .catch(() => { if (version === request.current) setError(true); })
      .finally(() => { if (version === request.current) setLoading(false); });
  }

  useEffect(() => {
    if (siteId) load(siteId);
    return () => { request.current++; };
  }, [siteId, insightId]);

  async function decideInsight(id: string, action: 'approve' | 'reject'): Promise<void> {
    if (!editable || pending.current) return;
    pending.current = true;
    request.current++;
    setLoading(false);
    setDecision(action); setPendingId(id);
    try {
      const result = await api.post<Partial<InsightSuggestion>>(`/ai/suggestions/${id}/${action}`);
      setSuggestions(items => items.map(item => item.id === id ? { ...item, ...result } : item));
      setConfirmReject(null);
      toast.success(action === 'reject' ? 'Insight rejeitado. Ele está disponível no filtro Rejeitados.' : result.experimentsReadyAt ? 'Insight aprovado. Os experimentos vinculados estão disponíveis na aba Experimentos.' : 'Insight aprovado. Os experimentos ficarão prontos em até 24 horas e já estarão aprovados.');
    } catch (e) {
      toast.error(userErrorMessage(e));
    } finally {
      pending.current = false;
      setPendingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Insights de IA"
      />
      {insightId && <div role="status" className="mb-6 flex flex-wrap items-center gap-4 text-sm"><p>Exibindo o insight de origem dos experimentos.</p><Link href="/insights" className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">Ver todos os insights</Link></div>}

      {sitesError || error ? <DataState error title="Não foi possível consultar os insights" description="Confira sua conexão e tente novamente." onRetry={() => siteId ? load(siteId) : window.location.reload()} />
        : sitesLoading ? <DataState loading title="Preparando seus insights…" />
        : !siteId ? <DataState title="Primeiro, conecte seu site" description="A análise precisa de um site cadastrado para gerar propostas de melhoria." href="/sites" action="Ir para sites" />
        : loading && !suggestions.length ? <DataState loading title="Consultando sugestões…" />
        : insightId && suggestions.length === 0 ? <DataState title="Insight indisponível neste site" description="Confira o site selecionado no topo da página ou consulte a lista de insights." href="/insights" action="Ver todos os insights" />
        : suggestions.length === 0 ? (
        <DataState title="Seus insights aparecerão aqui" description="Os insights serão gerados conforme os dados do seu site forem recebidos. Mantenha o código de rastreamento instalado para coletar as interações dos visitantes." />
      ) : (
        <div>
          <div role="group" aria-label="Filtrar insights por status" className="mb-3 flex flex-wrap gap-2">
            {(Object.keys(filters) as Filter[]).map(value => <Button key={value} className="min-h-11" variant={filter === value ? 'default' : 'outline'} aria-pressed={filter === value} onClick={() => { setFilter(value); setConfirmReject(null); }}>
              {filters[value]} <span className="ml-2 tabular-nums">{suggestions.filter(s => matchesFilter(s, value)).length}</span>
            </Button>)}
          </div>
          <p role="status" className="mb-6 text-xs text-muted-foreground">{suggestions.filter(s => matchesFilter(s, filter)).length} de {suggestions.length} insights nesta lista.{filter === 'accepted' ? ' Inclui insights com experimentos em preparação.' : ''}</p>
          {!suggestions.some(s => matchesFilter(s, filter)) && <DataState title="Nenhum insight neste status" description="Escolha outro filtro para continuar explorando os insights deste site." />}
          <div className="grid gap-4">
          {suggestions.filter(s => matchesFilter(s, filter)).map((s) => {
            const experiments = s.experiments ?? [];
            const proposals = s.payload.experimentProposals ?? (s.payload.selector && s.payload.proposedValue ? [{ selector: s.payload.selector, proposedValue: s.payload.proposedValue }] : []);
            return <Card key={s.id} id={`insight-${s.id}`} className="p-0">
              <details className="group" open={insightId === s.id ? true : undefined}>
              <summary className="list-none cursor-pointer rounded-lg p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary [&::-webkit-details-marker]:hidden sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="break-words text-lg font-semibold tracking-tight">{s.payload.title ?? suggestionKindLabels[s.kind] ?? 'Sugestão'}</h2>
                  <div className="mt-3 flex items-start gap-2 text-sm leading-relaxed">
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"><path d="M9 18h6m-5 3h4M8.5 15a6 6 0 1 1 7 0c-1 1-1 2-1 3h-5c0-1 0-2-1-3Z" /></svg>
                    <p className="min-w-0 break-words"><span className="font-medium">Hipótese da IA: </span>{s.payload.detail || 'A hipótese detalhada não foi registrada neste insight.'}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                  <Badge tone={s.rejectedAt ? 'red' : s.approvedAt ? 'green' : 'amber'}>{s.rejectedAt ? 'Insight rejeitado' : s.approvedAt ? (!s.experimentsReadyAt ? 'Experimentos sendo gerados' : 'Insight aceito') : 'Aguardando aprovação'}</Badge>
                  <Badge tone={s.riskLevel === 'high' ? 'red' : s.riskLevel === 'medium' ? 'amber' : s.riskLevel === 'low' ? 'green' : 'default'}>
                    Risco {riskLabels[s.riskLevel] ?? 'não informado'}
                  </Badge>
                </div>
              </div>
              <div className="mt-5 flex items-center gap-2 text-xs font-medium text-muted-foreground"><span className="group-open:hidden">Ver detalhes e evidências</span><span className="hidden group-open:inline">Recolher detalhes</span><svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4 group-open:rotate-180"><path d="m5 7 5 5 5-5" /></svg></div>
              </summary>
              <div className="border-t border-border px-5 pb-5 sm:px-6 sm:pb-6">
              {!s.payload.experimentProposals && s.payload.proposedValue && <p className="mt-4 break-words text-sm"><span className="font-medium">Mudança proposta: </span>{s.payload.proposedValue}</p>}
              <InsightEvidence payload={s.payload} />
              {s.expectedImpact && <p className="mt-4 break-words text-xs leading-relaxed text-muted-foreground">Impacto esperado (hipótese da IA): {s.expectedImpact}</p>}
              {!!s.payload.experimentProposals?.length && <details className="mt-4 border-t border-border pt-2">
                <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Ver possibilidades de experimento ({proposals.length})</summary>
                <ol className="space-y-4 text-sm">{s.payload.experimentProposals.map((proposal, index) => <li key={index}>
                  <p className="break-words font-medium">{proposal.name ?? `Proposta ${index + 1}`}</p>
                  <p className="mt-1 break-all text-xs text-muted-foreground">Elemento: {proposal.selector}</p>
                  <p className="mt-1 break-words">{proposal.proposedValue}</p>
                </li>)}</ol>
              </details>}
              {experiments.length > 0 && <section aria-label="Experimentos deste insight" className="mt-5 border-t border-border pt-4">
                <h3 className="text-sm font-semibold">Experimentos deste insight ({experiments.length})</h3>
                <ul className="mt-2 space-y-2">{experiments.map(experiment => <li key={experiment.id} className="flex flex-wrap items-center gap-3 text-sm">
                  <Link href={`/experiments?review=${encodeURIComponent(experiment.id)}`} className="inline-flex min-h-11 min-w-0 items-center break-words text-primary underline underline-offset-4 [overflow-wrap:anywhere]">{experiment.name}</Link>
                  <Badge>{experimentStatusLabels[experiment.status] ?? experiment.status}</Badge>
                </li>)}</ul>
                <Link href="/experiments" className="mt-2 inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4">Ver todos na aba Experimentos</Link>
              </section>}
              {s.experimentsReadyAt && !experiments.length && <p className="mt-4 text-xs text-muted-foreground">A preparação foi concluída, mas nenhum experimento está disponível nesta lista.</p>}
              </div>
              </details>
              {!s.approvedAt && !s.rejectedAt && <div className="border-t border-border px-5 py-4 sm:px-6">
                <p className="text-xs leading-relaxed text-muted-foreground">Ao aprovar este insight, os experimentos serão preparados em até 24 horas e ficarão aprovados, prontos para iniciar. Os experimentos já vinculados serão preservados.</p>
                {editable && (confirmReject === s.id ? <div className="mt-4" role="group" aria-label="Confirmar rejeição do insight">
                  <p className="text-sm font-medium">Rejeitar este insight?</p>
                  <p className="mt-1 text-sm text-muted-foreground">Ele ficará em Rejeitados e não autorizará novos experimentos. Os experimentos já vinculados serão preservados.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button autoFocus className="min-h-11" variant="outline" disabled={pendingId !== null} onClick={() => { setConfirmReject(null); requestAnimationFrame(() => document.getElementById(`reject-${s.id}`)?.focus()); }}>Cancelar</Button>
                    <Button className="min-h-11" variant="destructive" disabled={pendingId !== null} aria-busy={pendingId === s.id} onClick={() => decideInsight(s.id, 'reject')}>{pendingId === s.id ? 'Rejeitando insight…' : 'Confirmar rejeição'}</Button>
                  </div>
                </div> : <div className="mt-4 flex flex-wrap gap-2">
                  <Button className="min-h-11" disabled={pendingId !== null} aria-busy={pendingId === s.id && decision === 'approve'} onClick={() => decideInsight(s.id, 'approve')}>{pendingId === s.id ? 'Aprovando insight…' : 'Aprovar insight'}</Button>
                  <Button id={`reject-${s.id}`} variant="outline" className="min-h-11 text-red-700" disabled={pendingId !== null} onClick={() => setConfirmReject(s.id)}>Rejeitar insight</Button>
                </div>)}
              </div>}
              {s.approvedAt && !s.rejectedAt && !s.experimentsReadyAt && <div className="border-t border-border px-5 pb-5 sm:px-6 sm:pb-6">
                <InsightPreparationNotice approvedAt={s.approvedAt} />
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <Button className="min-h-11" variant="outline" disabled={pendingId !== null || loading} onClick={() => siteId && load(siteId)}>{loading ? 'Atualizando situação…' : 'Atualizar situação'}</Button>
                  <Link href="/experiments" className="inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4">Acompanhar na aba Experimentos</Link>
                </div>
              </div>}
            </Card>;
          })}
          </div>
        </div>
      )}
    </div>
  );
}
