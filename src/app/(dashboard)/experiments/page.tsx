'use client';

import type * as React from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, type Experiment } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';

const STATUS_TONE: Record<string, 'default' | 'green' | 'amber' | 'red'> = {
  running: 'green',
  completed: 'green',
  pending_review: 'amber',
  ai_suggested: 'amber',
  rejected: 'red',
  rolled_back: 'red',
};

export default function ExperimentsPage(): React.ReactElement {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Experiment[]>('/experiments')
      .then(setExperiments)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        title="Experiments"
        description="Every change is human-approved before it can run. AI never auto-publishes."
      />
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : experiments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No experiments yet.</p>
      ) : (
        <div className="grid gap-3">
          {experiments.map((exp) => (
            <Link key={exp.id} href={`/experiments/${exp.id}`}>
              <Card className="transition-colors hover:border-primary">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{exp.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {exp.type} · risk {exp.riskScore} · {Math.round(exp.allocation * 100)}% traffic
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[exp.status] ?? 'default'}>{exp.status}</Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
