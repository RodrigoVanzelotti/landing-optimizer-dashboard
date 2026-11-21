'use client';

import type * as React from 'react';
import { useSession } from '@/lib/session';
import { canEdit } from '@/lib/permissions';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, type InsightSuggestion } from '@/lib/api';
import { useSites } from '@/lib/use-sites';
import { Card, CardTitle, Badge } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { DataState } from '@/components/data-state';
import { InsightEvidence } from '@/components/insight-evidence';

const riskLabels: Record<string, string> = { low: 'baixo', medium: 'médio', high: 'alto' };
const suggestionKindLabels: Record<string, string> = {
  hypothesis: 'Hipótese', headline: 'Título', cta: 'Chamada para ação',
  friction: 'Dificuldade de uso', section: 'Seção', score: 'Pontuação', plan: 'Plano',
};

export default function InsightsPage(): React.ReactElement {
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
      .get<InsightSuggestion[]>(`/sites/${id}/ai/suggestions`)
      .then(items => setSuggestions(items.filter(item => !['synthetic-demo', 'stub-v1'].includes(item.model) && !item.payload.title?.startsWith('[MOCK]'))))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (siteId) load(siteId);
  }, [siteId]);

  async function materialize(id: string): Promise<void> {
    if (pendingId) return;
    setPendingId(id); setMsg(null); setMessageError(false);
    try {
      await api.post(`/ai/suggestions/${id}/materialize`);
      setMsg('Rascunho criado. Aprovação necessária.');
      if (siteId) await load(siteId);
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
        description="Explore as hipóteses e confira os dados de suporte disponíveis."
      />
      {msg ? <p role={messageError ? 'alert' : 'status'} className="mb-4 text-sm text-muted-foreground">{msg}</p> : null}

      {sitesError || error ? <DataState error title="Não foi possível consultar os insights" description="Confira sua conexão e tente novamente." onRetry={() => siteId ? load(siteId) : window.location.reload()} />
        : sitesLoading ? <DataState loading title="Preparando seus insights…" />
        : !siteId ? <DataState title="Primeiro, conecte seu site" description="A análise precisa de um site cadastrado para gerar propostas de melhoria." href="/sites" action="Ir para sites" />
        : loading ? <DataState loading title="Consultando sugestões…" />
        : suggestions.length === 0 ? (
        <DataState title="Seus insights aparecerão aqui" description="Os insights serão gerados conforme os dados do seu site forem recebidos. Mantenha o código de rastreamento instalado para coletar as interações dos visitantes." />
      ) : (
        <div className="grid gap-3">
          {suggestions.map((s) => (
            <Card key={s.id}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <CardTitle>{s.payload.title ?? suggestionKindLabels[s.kind] ?? 'Sugestão'}</CardTitle>
                  {s.payload.detail && <p className="mt-1 break-words text-sm"><span className="font-medium">Hipótese da IA: </span>{s.payload.detail}</p>}
                  {s.payload.proposedValue ? (
                    <p className="mt-2 text-sm">
                      Proposta: <span className="font-medium">{s.payload.proposedValue}</span>
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                  <Badge tone={s.riskLevel === 'high' ? 'red' : s.riskLevel === 'medium' ? 'amber' : 'green'}>
                    Risco {riskLabels[s.riskLevel] ?? 'não informado'}
                  </Badge>
                  {editable && s.payload.selector && s.payload.proposedValue && !s.experimentId ? (
                    <Button size="sm" variant="outline" disabled={pendingId !== null} aria-busy={pendingId === s.id} onClick={() => materialize(s.id)}>
                      {pendingId === s.id ? 'Criando experimento…' : 'Criar experimento'}
                    </Button>
                  ) : s.experimentId ? (
                    <Link href={`/experiments?review=${encodeURIComponent(s.experimentId)}`} className="inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4">Ver experimento</Link>
                  ) : null}
                </div>
              </div>
              <InsightEvidence payload={s.payload} />
              {s.expectedImpact && <p className="mt-4 break-words text-xs leading-relaxed text-muted-foreground">Impacto esperado (hipótese da IA): {s.expectedImpact}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
