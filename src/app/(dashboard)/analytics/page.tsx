'use client';

import type * as React from 'react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useSite } from '@/lib/site-context';
import { milestone, useJourney } from '@/lib/journey';
import { Card } from '@/components/ui/card';
import { InfoTip } from '@/components/ui/info-tip';
import { LockedFeature } from '@/components/locked-feature';
import { PageHeader } from '@/components/page-header';
import { EVENT_INFO } from '@/lib/kpi-copy';
import { formatNumber } from '@/lib/utils';

export default function AnalyticsPage(): React.ReactElement {
  const { siteId } = useSite();
  const { journey } = useJourney(siteId);
  const [funnel, setFunnel] = useState<{ event: string; count: number }[]>([]);

  useEffect(() => {
    if (!siteId) return;
    let active = true;
    api
      .get<{ event: string; count: number }[]>(`/analytics/funnel?siteId=${siteId}`)
      .then((f) => {
        if (active) setFunnel(f);
      })
      .catch(() => {
        if (active) setFunnel([]);
      });
    return () => {
      active = false;
    };
  }, [siteId]);

  const max = Math.max(1, ...funnel.map((f) => f.count));
  const installed = milestone(journey, 'snippet_installed');

  return (
    <div>
      <PageHeader title="Analytics" description="Aggregate event funnel. No individual profiles." />
      {funnel.length === 0 ? (
        <LockedFeature
          title={installed?.done ? 'First events are on their way' : 'Install the snippet to light this up'}
          description="This page ranks every behavioral signal we track — page views, scroll depth, CTA clicks, frustration signals — so you see at a glance where attention leaks."
          {...(installed?.done
            ? {}
            : { cta: { href: `/sites/${siteId}`, label: 'Get my snippet' } })}
          footnote="Events arrive within seconds of a visit; this page updates on reload."
        />
      ) : (
        <Card>
          <div className="space-y-2">
            {funnel.map((f) => (
              <div key={f.event} className="flex items-center gap-3">
                <span className="flex w-36 items-center gap-1.5 text-sm text-muted-foreground">
                  {f.event}
                  {EVENT_INFO[f.event] ? (
                    <InfoTip label={`About ${f.event}`}>{EVENT_INFO[f.event]}</InfoTip>
                  ) : null}
                </span>
                <div className="h-4 flex-1 rounded bg-muted">
                  <div
                    className="h-4 rounded bg-primary"
                    style={{ width: `${(f.count / max) * 100}%` }}
                  />
                </div>
                <span className="w-16 text-right text-sm tabular-nums">
                  {formatNumber(f.count)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
