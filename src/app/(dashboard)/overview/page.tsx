'use client';

import type * as React from 'react';
import { useEffect, useState } from 'react';
import { api, type Overview } from '@/lib/api';
import { useSites } from '@/lib/use-sites';
import { Card, CardTitle, CardValue } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';
import { formatNumber, formatPct } from '@/lib/utils';

export default function OverviewPage(): React.ReactElement {
  const { sites, loading: sitesLoading, error: sitesError } = useSites();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const siteId = sites[0]?.id;

  useEffect(() => {
    if (!siteId) return;
    api
      .get<Overview>(`/analytics/overview?siteId=${siteId}`)
      .then(setOverview)
      .catch((e: Error) => setError(e.message));
  }, [siteId]);

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Aggregate, privacy-preserving performance across your sites."
      />

      {sitesError ? (
        <p className="text-sm text-red-600">Could not load sites: {sitesError}</p>
      ) : sitesLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : sites.length === 0 ? (
        <Card>
          <CardTitle>No sites yet</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a site to generate your install snippet and start collecting aggregate metrics.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardTitle>Page views</CardTitle>
            <CardValue>{overview ? formatNumber(overview.pageViews) : '—'}</CardValue>
          </Card>
          <Card>
            <CardTitle>Conversions</CardTitle>
            <CardValue>{overview ? formatNumber(overview.conversions) : '—'}</CardValue>
          </Card>
          <Card>
            <CardTitle>Conversion rate</CardTitle>
            <CardValue>{overview ? formatPct(overview.conversionRate) : '—'}</CardValue>
          </Card>
          <Card>
            <CardTitle>CTA clicks</CardTitle>
            <CardValue>{overview ? formatNumber(overview.ctaClicks) : '—'}</CardValue>
          </Card>
        </div>
      )}

      {error ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Analytics unavailable ({error}). Metrics appear once events are ingested.
        </p>
      ) : null}
    </div>
  );
}
