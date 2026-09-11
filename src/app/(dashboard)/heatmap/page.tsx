'use client';

import type * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  api,
  type HeatmapResult,
  type SnapshotDetail,
  type SnapshotMeta,
} from '@/lib/api';
import { useSite } from '@/lib/site-context';
import { milestone, useJourney } from '@/lib/journey';
import { Card, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { PageHeader } from '@/components/page-header';
import {
  formatMs,
  HeatmapLegend,
  HeatmapOverlay,
  type HeatmapLayers,
} from '@/components/heatmap-overlay';
import { formatNumber } from '@/lib/utils';

const selectClass =
  'h-9 rounded-md border border-border bg-background px-3 text-sm';

export default function HeatmapPage(): React.ReactElement {
  const { sites, siteId, loading: sitesLoading } = useSite();
  const { journey } = useJourney(siteId);
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [snapshotId, setSnapshotId] = useState<string>('');
  const [snapshot, setSnapshot] = useState<SnapshotDetail | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [heatmap, setHeatmap] = useState<HeatmapResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [layers, setLayers] = useState<HeatmapLayers>({
    clicks: true,
    hover: true,
    frustration: true,
    scroll: true,
  });

  // Load the site's snapshots; default to the newest.
  useEffect(() => {
    if (!siteId) return;
    let active = true;
    api
      .get<SnapshotMeta[]>(`/sites/${siteId}/snapshots`)
      .then((list) => {
        if (!active) return;
        setSnapshots(list);
        setSnapshotId(list[0]?.id ?? '');
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [siteId]);

  // Load the selected snapshot's geometry + image + matching analytics.
  useEffect(() => {
    if (!siteId || !snapshotId) {
      setSnapshot(null);
      setHeatmap(null);
      return;
    }
    let active = true;
    let objectUrl = '';
    setError(null);
    Promise.all([
      api.get<SnapshotDetail>(`/sites/${siteId}/snapshots/${snapshotId}`),
      api.getBlob(`/sites/${siteId}/snapshots/${snapshotId}/image`),
    ])
      .then(async ([detail, blob]) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setSnapshot(detail);
        setImageUrl(objectUrl);
        const hm = await api.get<HeatmapResult>(
          `/analytics/heatmap?siteId=${siteId}&path=${encodeURIComponent(detail.urlPath)}`,
        );
        if (active) setHeatmap(hm);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [siteId, snapshotId]);

  const site = useMemo(() => sites.find((s) => s.id === siteId), [sites, siteId]);
  const toggle = (key: keyof HeatmapLayers) => (checked: boolean) =>
    setLayers((prev) => ({ ...prev, [key]: checked }));

  return (
    <div>
      <PageHeader
        title="Heatmap"
        description="Where visitors click, hover, and stop scrolling — drawn over a snapshot of your page."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {snapshots.length > 0 ? (
          <select
            className={selectClass}
            value={snapshotId}
            onChange={(e) => setSnapshotId(e.target.value)}
            aria-label="Snapshot"
          >
            {snapshots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.urlPath} — {new Date(s.capturedAt).toLocaleString()}
              </option>
            ))}
          </select>
        ) : null}
        <div className="flex flex-wrap items-center gap-4">
          <Checkbox id="layer-clicks" label="Clicks" checked={layers.clicks} onChange={toggle('clicks')} />
          <Checkbox id="layer-hover" label="Hover" checked={layers.hover} onChange={toggle('hover')} />
          <Checkbox
            id="layer-frustration"
            label="Frustration"
            checked={layers.frustration}
            onChange={toggle('frustration')}
          />
          <Checkbox id="layer-scroll" label="Scroll depth" checked={layers.scroll} onChange={toggle('scroll')} />
        </div>
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      {!sitesLoading && sites.length === 0 ? (
        <p className="text-sm text-muted-foreground">Create a site first.</p>
      ) : snapshots.length === 0 ? (
        <CaptureInstructions domain={site?.primaryDomain} />
      ) : snapshot && heatmap ? (
        <div className="space-y-4">
          <WarmingBanner
            ready={milestone(journey, 'heatmap_ready')}
          />
          <HeatmapLegend layers={layers} />
          <HeatmapOverlay
            snapshot={snapshot}
            imageUrl={imageUrl}
            heatmap={heatmap}
            layers={layers}
          />
          <p className="text-xs text-muted-foreground">
            Based on {formatNumber(heatmap.pageViews)} page views on{' '}
            <span className="font-mono">{snapshot.urlPath}</span> over the last 30 days.
            Snapshot captured {new Date(snapshot.capturedAt).toLocaleString()}.
          </p>
          <ElementTable heatmap={heatmap} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Loading snapshot…</p>
      )}
    </div>
  );
}

/** Anticipation banner while the heatmap is still statistically thin. */
function WarmingBanner({
  ready,
}: {
  ready: { done: boolean; current?: number; target?: number } | undefined;
}): React.ReactElement | null {
  if (!ready || ready.done) return null;
  return (
    <Card className="py-4">
      <div className="flex items-center justify-between gap-6">
        <div>
          <CardTitle>Heatmap warming up</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            You can already explore, but patterns become trustworthy around{' '}
            {ready.target ?? 200} interactions. Just leave the snippet running.
          </p>
        </div>
        <div className="w-56 shrink-0">
          <Progress value={ready.current ?? 0} max={ready.target ?? 200} unit="interactions" />
        </div>
      </div>
    </Card>
  );
}

/** Shown when the site has no snapshot yet: how to capture one. */
function CaptureInstructions({ domain }: { domain?: string }): React.ReactElement {
  const example = `https://${domain ?? 'your-domain.com'}/?lo_capture=1`;
  return (
    <Card>
      <h3 className="mb-2 text-sm font-semibold">Capture a page snapshot</h3>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Make sure the tracking snippet is installed on the page.</li>
        <li>
          Open the page in your browser with <code className="rounded bg-muted px-1">?lo_capture=1</code>{' '}
          appended, e.g.{' '}
          <code className="rounded bg-muted px-1">{example}</code>
        </li>
        <li>
          Wait for the &ldquo;snapshot captured&rdquo; confirmation in the top-right corner of the
          page, then come back here and refresh.
        </li>
      </ol>
      <p className="mt-3 text-xs text-muted-foreground">
        The capture runs only for you — regular visitors never load the capture module. Form
        values and elements marked <code className="rounded bg-muted px-1">data-lo-ignore</code>{' '}
        are stripped before the image leaves your browser.
      </p>
    </Card>
  );
}

/** Accessible fallback: the same metrics as a plain table. */
function ElementTable({ heatmap }: { heatmap: HeatmapResult }): React.ReactElement {
  if (heatmap.elements.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No element-level events recorded yet for this page.
      </p>
    );
  }
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="py-2">Element</th>
            <th className="py-2 text-right">Clicks</th>
            <th className="py-2 text-right">Hover time</th>
            <th className="py-2 text-right">Dead clicks</th>
            <th className="py-2 text-right">Rage clicks</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {heatmap.elements.map((el) => (
            <tr key={el.selector} className="border-b border-border/50">
              <td className="max-w-md truncate py-2 font-mono text-xs">{el.selector}</td>
              <td className="py-2 text-right">{formatNumber(el.ctaClicks)}</td>
              <td className="py-2 text-right">{formatMs(el.hoverMs)}</td>
              <td className="py-2 text-right">{formatNumber(el.deadClicks)}</td>
              <td className="py-2 text-right">{formatNumber(el.rageClicks)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
