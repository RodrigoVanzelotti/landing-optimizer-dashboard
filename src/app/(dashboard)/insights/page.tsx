'use client';

import type * as React from 'react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useSites } from '@/lib/use-sites';
import { Card, CardTitle, Badge } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';

interface Suggestion {
  id: string;
  kind: string;
  riskLevel: string;
  expectedImpact: string | null;
  experimentId: string | null;
  payload: { title?: string; detail?: string; selector?: string; proposedValue?: string };
}

export default function InsightsPage(): React.ReactElement {
  const { sites } = useSites();
  const siteId = sites[0]?.id;
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function load(id: string): void {
    api
      .get<Suggestion[]>(`/sites/${id}/ai/suggestions`)
      .then(setSuggestions)
      .catch(() => setSuggestions([]));
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
        action={
          <Button onClick={analyze} disabled={busy || !siteId}>
            {busy ? 'Analyzing…' : 'Run analysis'}
          </Button>
        }
      />
      {msg ? <p className="mb-4 text-sm text-muted-foreground">{msg}</p> : null}

      {suggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No suggestions yet. Run an analysis.</p>
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
                  {s.payload.selector && s.payload.proposedValue && !s.experimentId ? (
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
