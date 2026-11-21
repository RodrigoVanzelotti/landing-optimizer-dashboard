'use client';

import type * as React from 'react';
import { useSession } from '@/lib/session';
import { canEdit } from '@/lib/permissions';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api, type InsightSuggestion } from '@/lib/api';
import { useSites } from '@/lib/use-sites';
import { Card, CardTitle, Badge } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { DataState } from '@/components/data-state';
import { InsightEvidence } from '@/components/insight-evidence';
import { experimentStatusLabels } from '@/lib/experiments';
import { InsightPreparationNotice } from '@/components/insight-preparation-notice';

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
  return <InsightsContent key={insightId ?? 'all'} insightId={insightId} />;
}

function InsightsContent({ insightId }: { insightId: string | null }): React.ReactElement {
  const editable = canEdit(useSession().role);
  const { siteId, loading: sitesLoading, error: sitesError } = useSites();
  const [suggestions, setSuggestions] = useState<InsightSuggestion[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [messageError, setMessageError] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  function load(id: string): Promise<void> {
    setLoading(true); setError(false);
    return api
      .get<InsightSuggestion[]>(`/sites/${id}/ai/suggestions${insightId ? `?insightId=${encodeURIComponent(insightId)}` : ''}`)
      .then(items => setSuggestions(items.filter(item => !['synthetic-demo', 'stub-v1'].includes(item.model) && !item.payload.title?.startsWith('[MOCK]'))))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (siteId) load(siteId);
  }, [siteId, insightId]);

  async function approveInsight(id: string): Promise<void> {
    if (pendingId) return;
    setPendingId(id); setMsg(null); setMessageError(false);
    try {
      const approved = await api.post<{ approvedAt: string; experimentsReadyAt: string | null; experiments: InsightSuggestion['experiments'] }>(`/ai/suggestions/${id}/approve`);
      setSuggestions(items => items.map(item => item.id === id ? { ...item, ...approved } : item));
      setMsg(approved.experimentsReadyAt ? 'Insight aprovado. Os experimentos vinculados estão disponíveis na aba Experimentos.' : 'Insight aprovado. Os experimentos ficarão prontos em até 24 horas e já estarão aprovados.');
    } catch (e) {
      setMessageError(true);
      setMsg((e as Error).message);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Insights de IA"
        description="Aprove um insight para receber os experimentos em até 24 horas, já aprovados. Novos insights aparecerão conforme o site acumular dados."
      />
      {insightId && <div role="status" className="mb-6 flex flex-wrap items-center gap-4 text-sm"><p>Exibindo o insight de origem dos experimentos.</p><Link href="/insights" className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">Ver todos os insights</Link></div>}
      {msg ? <p role={messageError ? 'alert' : 'status'} className="mb-4 text-sm text-muted-foreground">{msg}</p> : null}

      {sitesError || error ? <DataState error title="Não foi possível consultar os insights" description="Confira sua conexão e tente novamente." onRetry={() => siteId ? load(siteId) : window.location.reload()} />
        : sitesLoading ? <DataState loading title="Preparando seus insights…" />
        : !siteId ? <DataState title="Primeiro, conecte seu site" description="A análise precisa de um site cadastrado para gerar propostas de melhoria." href="/sites" action="Ir para sites" />
        : loading ? <DataState loading title="Consultando sugestões…" />
        : insightId && suggestions.length === 0 ? <DataState title="Insight indisponível neste site" description="Confira o site selecionado no topo da página ou consulte a lista de insights." href="/insights" action="Ver todos os insights" />
        : suggestions.length === 0 ? (
        <DataState title="Seus insights aparecerão aqui" description="Os insights serão gerados conforme os dados do seu site forem recebidos. Mantenha o código de rastreamento instalado para coletar as interações dos visitantes." />
      ) : (
        <div className="grid gap-3">
          {suggestions.map((s) => {
            const experiments = s.experiments ?? [];
            const proposals = s.payload.experimentProposals ?? (s.payload.selector && s.payload.proposedValue ? [{ selector: s.payload.selector, proposedValue: s.payload.proposedValue }] : []);
            return <Card key={s.id} id={`insight-${s.id}`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <CardTitle>{s.payload.title ?? suggestionKindLabels[s.kind] ?? 'Sugestão'}</CardTitle>
                  {s.payload.detail && <p className="mt-1 break-words text-sm"><span className="font-medium">Hipótese da IA: </span>{s.payload.detail}</p>}
                  {!s.payload.experimentProposals && s.payload.proposedValue ? (
                    <p className="mt-2 text-sm">
                      Proposta: <span className="font-medium">{s.payload.proposedValue}</span>
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                  <Badge tone={s.approvedAt ? 'green' : 'amber'}>{s.approvedAt ? 'Insight aprovado' : 'Aguardando aprovação'}</Badge>
                  <Badge tone={s.riskLevel === 'high' ? 'red' : s.riskLevel === 'medium' ? 'amber' : 'green'}>
                    Risco {riskLabels[s.riskLevel] ?? 'não informado'}
                  </Badge>
                  {editable && !s.approvedAt && (
                    <Button size="sm" disabled={pendingId !== null} aria-busy={pendingId === s.id} onClick={() => approveInsight(s.id)}>
                      {pendingId === s.id ? 'Aprovando insight…' : 'Aprovar insight'}
                    </Button>
                  )}
                </div>
              </div>
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
              {!s.approvedAt && <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Ao aprovar este insight, os experimentos serão preparados em até 24 horas e ficarão aprovados, prontos para iniciar. Os experimentos já vinculados serão preservados.</p>}
              {s.approvedAt && !s.experimentsReadyAt && <>
                <InsightPreparationNotice approvedAt={s.approvedAt} />
                <div className="mt-2 flex flex-wrap items-center gap-4">
                  <Button variant="outline" disabled={pendingId !== null} onClick={() => siteId && load(siteId)}>Atualizar situação</Button>
                  <Link href={`/experiments?insight=${encodeURIComponent(s.id)}`} className="inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4">Acompanhar na aba Experimentos</Link>
                </div>
              </>}
              {experiments.length > 0 && <section aria-label="Experimentos deste insight" className="mt-5 border-t border-border pt-4">
                <h3 className="text-sm font-semibold">Experimentos deste insight ({experiments.length})</h3>
                <ul className="mt-2 space-y-2">{experiments.map(experiment => <li key={experiment.id} className="flex flex-wrap items-center gap-3 text-sm">
                  <Link href={`/experiments?insight=${encodeURIComponent(s.id)}&review=${encodeURIComponent(experiment.id)}`} className="inline-flex min-h-11 min-w-0 items-center break-words text-primary underline underline-offset-4 [overflow-wrap:anywhere]">{experiment.name}</Link>
                  <Badge>{experimentStatusLabels[experiment.status] ?? experiment.status}</Badge>
                </li>)}</ul>
                <Link href={`/experiments?insight=${encodeURIComponent(s.id)}`} className="mt-2 inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4">Ver todos na aba Experimentos</Link>
              </section>}
              {s.experimentsReadyAt && !experiments.length && <p className="mt-4 text-xs text-muted-foreground">A preparação foi concluída, mas nenhum experimento está disponível nesta lista.</p>}
            </Card>;
          })}
        </div>
      )}
    </div>
  );
}
