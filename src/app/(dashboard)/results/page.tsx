'use client';

import type * as React from 'react';
import { useEffect, useState } from 'react';
import { api, type Experiment, type VariantResult } from '@/lib/api';
import { useSite } from '@/lib/site-context';
import { milestone, useJourney } from '@/lib/journey';
import { SIGNIFICANCE_INFO } from '@/lib/kpi-copy';
import { Card, CardTitle, Badge } from '@/components/ui/card';
import { InfoTip } from '@/components/ui/info-tip';
import { Progress } from '@/components/ui/progress';
import { LockedFeature } from '@/components/locked-feature';
import { PageHeader } from '@/components/page-header';
import { formatNumber, formatPct } from '@/lib/utils';

export default function ResultsPage(): React.ReactElement {
  const { siteId } = useSite();
  const { journey } = useJourney(siteId);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [results, setResults] = useState<VariantResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Experiment[]>('/experiments')
      .then((list) => {
        setExperiments(list);
        if (list[0]) setSelected(list[0].id);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!selected) return;
    api
      .get<{ variants: VariantResult[] }>(`/analytics/experiments/${selected}/results`)
      .then((r) => setResults(r.variants))
      .catch((e: Error) => setError(e.message));
  }, [selected]);

  const header = (
    <PageHeader
      title="Results"
      description="Exposures, conversions, lift, and statistical significance vs control."
    />
  );

  if (experiments.length === 0) {
    const live = milestone(journey, 'experiment_live');
    return (
      <div>
        {header}
        <LockedFeature
          title="Your first verdict lands here"
          description="Once an experiment is running, this page shows each variant's conversion rate, the lift vs control, and whether the difference is statistically real — plus a countdown to significance."
          cta={{ href: live?.done ? '/results' : '/experiments', label: 'Create an experiment' }}
          footnote="Tip: the fastest first experiment is materializing an AI suggestion."
        />
      </div>
    );
  }

  const resultsReady = milestone(journey, 'results_ready');
  const collecting = resultsReady && !resultsReady.done;

  return (
    <div>
      {header}
      <div className="mb-4 flex items-center gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="h-9 rounded-md border border-border px-3 text-sm"
        >
          {experiments.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <InfoTip label="About significance">{SIGNIFICANCE_INFO}</InfoTip>
      </div>

      {collecting ? (
        <Card className="mb-4">
          <div className="flex items-center justify-between gap-6">
            <div>
              <CardTitle>Collecting exposures…</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Significance needs 30 exposures per variant. Numbers below are live but treat
                any lift as noise until the bar fills.
              </p>
            </div>
            <div className="w-56 shrink-0">
              <Progress
                value={resultsReady.current ?? 0}
                max={resultsReady.target ?? 60}
                unit="exposures"
              />
            </div>
          </div>
        </Card>
      ) : null}

      {error ? <p className="text-sm text-muted-foreground">{error}</p> : null}

      {results ? (
        <div className="grid gap-3">
          {results.map((v) => (
            <Card key={v.variantId}>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>
                    {v.isControl ? 'Control' : 'Variant'} · {v.variantId.slice(0, 8)}
                  </CardTitle>
                  <p className="mt-2 text-sm">
                    {formatNumber(v.conversions)} / {formatNumber(v.exposures)} ={' '}
                    <strong>{formatPct(v.conversionRate)}</strong>
                  </p>
                  {v.lift !== null ? (
                    <p className="text-sm text-muted-foreground">
                      Lift {v.lift >= 0 ? '+' : ''}
                      {formatPct(v.lift)}
                      {v.pValue !== null ? ` · p=${v.pValue.toFixed(3)}` : ''}
                    </p>
                  ) : null}
                </div>
                {v.significant ? (
                  <Badge tone="green">Significant</Badge>
                ) : v.isControl ? (
                  <Badge>Baseline</Badge>
                ) : (
                  <Badge tone="amber">Not significant yet</Badge>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
