'use client';

import type * as React from 'react';
import { useSession } from '@/lib/session';
import { canEdit } from '@/lib/permissions';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useSites } from '@/lib/use-sites';
import { Card, CardTitle, Badge } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { DataState } from '@/components/data-state';

interface Suggestion {
  id: string;
  model: string;
  kind: string;
  riskLevel: string;
  expectedImpact: string | null;
  experimentId: string | null;
  payload: { title?: string; detail?: string; selector?: string; proposedValue?: string };
}

const riskLabels: Record<string, string> = { low: 'baixo', medium: 'médio', high: 'alto' };
const suggestionKindLabels: Record<string, string> = {
  hypothesis: 'Hipótese', headline: 'Título', cta: 'Chamada para ação',
  friction: 'Dificuldade de uso', section: 'Seção', score: 'Pontuação', plan: 'Plano',
};

export default function InsightsPage(): React.ReactElement {
  const editable = canEdit(useSession().role);
  const { siteId, loading: sitesLoading, error: sitesError } = useSites();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  function load(id: string): void {
    setLoading(true); setError(false);
    api
      .get<Suggestion[]>(`/sites/${id}/ai/suggestions`)
      .then(items => setSuggestions(items.filter(item => item.model !== 'synthetic-demo' && !item.payload.title?.startsWith('[MOCK]'))))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (siteId) load(siteId);
  }, [siteId]);

  async function materialize(id: string): Promise<void> {
    try {
      await api.post(`/ai/suggestions/${id}/materialize`);
      setMsg('Rascunho criado. Aprovação necessária.');
      if (siteId) load(siteId);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  return (
    <div>
      <PageHeader
        title="Insights de IA"
        description="Publicação exige aprovação."
      />
      {msg ? <p className="mb-4 text-sm text-muted-foreground">{msg}</p> : null}

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
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>{s.payload.title ?? suggestionKindLabels[s.kind] ?? 'Sugestão'}</CardTitle>
                  <p className="mt-1 text-sm">{s.payload.detail}</p>
                  {s.payload.proposedValue ? (
                    <p className="mt-2 text-sm">
                      Proposta: <span className="font-medium">{s.payload.proposedValue}</span>
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge tone={s.riskLevel === 'high' ? 'red' : s.riskLevel === 'medium' ? 'amber' : 'green'}>
                    Risco {riskLabels[s.riskLevel] ?? 'não informado'}
                  </Badge>
                  {editable && s.payload.selector && s.payload.proposedValue && !s.experimentId ? (
                    <Button size="sm" variant="outline" onClick={() => materialize(s.id)}>
                      Criar experimento
                    </Button>
                  ) : s.experimentId ? (
                    <span className="text-xs text-muted-foreground">Experimento criado</span>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
