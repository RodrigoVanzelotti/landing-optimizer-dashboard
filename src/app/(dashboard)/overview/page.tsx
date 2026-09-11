'use client';

import type * as React from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, type Overview } from '@/lib/api';
import { useSite } from '@/lib/site-context';
import { useJourney } from '@/lib/journey';
import { KPI_INFO } from '@/lib/kpi-copy';
import { Card, CardTitle, CardValue } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InfoTip } from '@/components/ui/info-tip';
import { JourneyPanel } from '@/components/journey-panel';
import { PageHeader } from '@/components/page-header';
import { formatNumber, formatPct } from '@/lib/utils';

export default function OverviewPage(): React.ReactElement {
  const { sites, siteId, loading: sitesLoading, error: sitesError } = useSite();
  const { journey } = useJourney(siteId);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) return;
    let active = true;
    api
      .get<Overview>(`/analytics/overview?siteId=${siteId}`)
      .then((o) => {
        if (active) setOverview(o);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [siteId]);

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Aggregate, privacy-preserving performance — last 30 days."
      />

      {sitesError ? (
        <p className="text-sm text-red-600">Could not load sites: {sitesError}</p>
      ) : sitesLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : sites.length === 0 ? (
        <Card className="mx-auto max-w-xl py-10 text-center">
          <h3 className="text-base font-semibold">Welcome to Landing Optimizer</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            See where visitors click, hover, and drop off — then fix it with A/B tests applied
            as a safe overlay, no code changes. First step: register your site to get your
            one-line install snippet.
          </p>
          <div className="mt-5">
            <Link href="/sites">
              <Button>Create your first site</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {journey ? <JourneyPanel journey={journey} siteId={siteId} /> : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              title="Page views"
              info={KPI_INFO['pageViews']}
              value={overview ? formatNumber(overview.pageViews) : '—'}
            />
            <Kpi
              title="Conversions"
              info={KPI_INFO['conversions']}
              value={overview ? formatNumber(overview.conversions) : '—'}
            />
            <Kpi
              title="Conversion rate"
              info={KPI_INFO['conversionRate']}
              value={overview ? formatPct(overview.conversionRate) : '—'}
            />
            <Kpi
              title="CTA clicks"
              info={KPI_INFO['ctaClicks']}
              value={overview ? formatNumber(overview.ctaClicks) : '—'}
            />
          </div>

          {error ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Analytics unavailable ({error}). Metrics appear once events are ingested.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function Kpi({
  title,
  value,
  info,
}: {
  title: string;
  value: string;
  info?: { what: string; expect: string };
}): React.ReactElement {
  return (
    <Card>
      <div className="flex items-center gap-1.5">
        <CardTitle>{title}</CardTitle>
        {info ? (
          <InfoTip label={`About ${title}`}>
            <span className="block font-medium">{info.what}</span>
            <span className="mt-1 block text-gray-300">{info.expect}</span>
          </InfoTip>
        ) : null}
      </div>
      <CardValue>{value}</CardValue>
    </Card>
  );
}
