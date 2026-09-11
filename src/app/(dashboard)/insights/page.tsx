'use client';

import type * as React from 'react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useSite } from '@/lib/site-context';
import { milestone, useJourney, MILESTONE_COPY } from '@/lib/journey';
import { Card, CardTitle, Badge } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LockedFeature } from '@/components/locked-feature';
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
  const { siteId } = useSite();
  const { journey } = useJourney(siteId);
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

  // Progressive unlock: the AI needs real traffic before its suggestions are
  // worth the operator's attention. Existing suggestions always stay visible.
  const aiReady = milestone(journey, 'ai_ready');
  const locked = aiReady ? !aiReady.done && suggestions.length === 0 : false;

  if (locked && aiReady) {
    return (
      <div>
        <PageHeader
          title="AI insights"
          description="AI proposes CRO experiments. It never publishes — everything requires approval."
        />
        <LockedFeature
          title="AI insights unlock at 500 page views"
          description={MILESTONE_COPY.ai_ready.description}
          progress={{
            current: aiReady.current ?? 0,
            target: aiReady.target ?? 500,
            unit: 'page views',
          }}
          cta={{ href: `/sites/${siteId}`, label: 'Check my install' }}
          footnote="Keep the snippet running — this unlocks by itself. The page structure map your snippet sends is what the AI reads."
        />
      </div>
    );
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
        <Card className="mx-auto max-w-xl py-8 text-center">
          <CardTitle>Ready to analyze</CardTitle>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            You have enough traffic. Run an analysis and the AI will score your page and
            propose copy and CTA experiments — each one lands here for your review, never
            auto-published.
          </p>
        </Card>
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
