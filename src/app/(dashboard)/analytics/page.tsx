'use client';

import type * as React from 'react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useSites } from '@/lib/use-sites';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';
import { formatNumber } from '@/lib/utils';

export default function AnalyticsPage(): React.ReactElement {
  const { sites } = useSites();
  const siteId = sites[0]?.id;
  const [funnel, setFunnel] = useState<{ event: string; count: number }[]>([]);

  useEffect(() => {
    if (!siteId) return;
    api
      .get<{ event: string; count: number }[]>(`/analytics/funnel?siteId=${siteId}`)
      .then(setFunnel)
      .catch(() => setFunnel([]));
  }, [siteId]);

  const max = Math.max(1, ...funnel.map((f) => f.count));

  return (
    <div>
      <PageHeader title="Analytics" description="Aggregate event funnel. No individual profiles." />
      {funnel.length === 0 ? (
        <p className="text-sm text-muted-foreground">No events yet.</p>
      ) : (
        <Card>
          <div className="space-y-2">
            {funnel.map((f) => (
              <div key={f.event} className="flex items-center gap-3">
                <span className="w-32 text-sm text-muted-foreground">{f.event}</span>
                <div className="h-4 flex-1 rounded bg-muted">
                  <div
                    className="h-4 rounded bg-primary"
                    style={{ width: `${(f.count / max) * 100}%` }}
                  />
                </div>
                <span className="w-16 text-right text-sm">{formatNumber(f.count)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
