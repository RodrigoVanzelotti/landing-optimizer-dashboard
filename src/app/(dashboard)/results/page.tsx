'use client';

import type * as React from 'react';
import { useEffect, useState } from 'react';
import { api, type Experiment, type VariantResult } from '@/lib/api';
import { Card, CardTitle, Badge } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';
import { formatNumber, formatPct } from '@/lib/utils';

export default function ResultsPage(): React.ReactElement {
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

  return (
    <div>
      <PageHeader
        title="Results"
        description="Exposures, conversions, lift, and statistical significance vs control."
      />
      {experiments.length > 0 ? (
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="mb-4 h-9 rounded-md border border-border px-3 text-sm"
        >
          {experiments.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      ) : (
        <p className="text-sm text-muted-foreground">No experiments to report on yet.</p>
      )}

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
                  <Badge tone="amber">Not significant</Badge>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
