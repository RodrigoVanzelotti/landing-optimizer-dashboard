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
  kind: string;
  riskLevel: string;
  expectedImpact: string | null;
  experimentId: string | null;
  payload: { title?: string; detail?: string; selector?: string; proposedValue?: string };
}

export default function InsightsPage(): React.ReactElement {
  const editable = canEdit(useSession().role);
  const { sites, loading: sitesLoading, error: sitesError } = useSites();
  const siteId = sites[0]?.id;
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  function load(id: string): void {
    setLoading(true); setError(false);
    api
      .get<Suggestion[]>(`/sites/${id}/ai/suggestions`)
      .then(setSuggestions)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (siteId) load(siteId);
  }, [siteId]);

  async function analyze(): Promise<void> {
    if (!siteId) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.post<{ count: number; score: number }>(`/sites/${siteId}/ai/analyze`);
      setMsg(`Generated ${r.count} suggestions · page score ${r.score}/100`);
      load(siteId);
    } catch (e) {
      setMsg(`Analysis failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function materialize(id: string): Promise<void> {
    try {
      await api.post(`/ai/suggestions/${id}/materialize`);
      setMsg('Created a draft experiment (requires approval before running).');
      if (siteId) load(siteId);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  return (
    <div>
      <PageHeader
        title="AI insights"
        description="AI proposes CRO experiments. It never publishes — everything requires approval."
        action={editable ?
          <Button onClick={analyze} disabled={busy || !siteId}>
            {busy ? 'Analyzing…' : 'Run analysis'}
          </Button> : undefined
        }
      />
      {msg ? <p className="mb-4 text-sm text-muted-foreground">{msg}</p> : null}

      {sitesError || error ? <DataState error title="Não foi possível consultar os insights" description="Confira sua conexão e tente novamente." onRetry={() => siteId ? load(siteId) : window.location.reload()} />
        : sitesLoading ? <DataState loading title="Preparando seus insights…" />
        : !siteId ? <DataState title="Primeiro, conecte seu site" description="A análise precisa de um site cadastrado para gerar propostas de melhoria." href="/sites" action="Ir para sites" />
        : loading ? <DataState loading title="Consultando sugestões…" />
        : suggestions.length === 0 ? (
        <DataState title="Suas próximas ideias vão aparecer aqui" description={editable ? 'Execute uma análise para buscar oportunidades. Se ainda não houver sugestões, confira a instalação do snippet e aguarde mais interações dos visitantes.' : 'Um editor ou administrador pode executar uma análise. As sugestões geradas ficarão disponíveis aqui para consulta.'} />
      ) : (
        <div className="grid gap-3">
          {suggestions.map((s) => (
            <Card key={s.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>{s.payload.title ?? s.kind}</CardTitle>
                  <p className="mt-1 text-sm">{s.payload.detail}</p>
                  {s.payload.proposedValue ? (
                    <p className="mt-2 text-sm">
                      Proposed: <span className="font-medium">{s.payload.proposedValue}</span>
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge tone={s.riskLevel === 'high' ? 'red' : s.riskLevel === 'medium' ? 'amber' : 'green'}>
                    {s.riskLevel} risk
                  </Badge>
                  {editable && s.payload.selector && s.payload.proposedValue && !s.experimentId ? (
                    <Button size="sm" variant="outline" onClick={() => materialize(s.id)}>
                      Create experiment
                    </Button>
                  ) : s.experimentId ? (
                    <span className="text-xs text-muted-foreground">materialized</span>
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
