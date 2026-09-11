'use client';

import type * as React from 'react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useSite } from '@/lib/site-context';
import { Card } from '@/components/ui/card';
import { LockedFeature } from '@/components/locked-feature';
import { PageHeader } from '@/components/page-header';
import { formatNumber } from '@/lib/utils';

interface SectionRow {
  section: string;
  views: number;
  deadClicks: number;
  rageClicks: number;
  dwellMs: number;
}

export default function SectionsPage(): React.ReactElement {
  const { siteId } = useSite();
  const [rows, setRows] = useState<SectionRow[]>([]);

  useEffect(() => {
    if (!siteId) return;
    api
      .get<SectionRow[]>(`/analytics/sections?siteId=${siteId}`)
      .then(setRows)
      .catch(() => setRows([]));
  }, [siteId]);

  return (
    <div>
      <PageHeader
        title="Section performance"
        description="Heat-style view of visibility, dwell, and frustration signals per section."
      />
      {rows.length === 0 ? (
        <LockedFeature
          title="Section performance is warming up"
          description="As visitors scroll, each page section (hero, pricing, FAQ…) is scored on views, dwell time, and frustration clicks — so you learn which section loses people before they convert."
          footnote="Fills automatically once the snippet is installed and visitors scroll your page."
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2">Section</th>
                <th className="py-2">Views</th>
                <th className="py-2">Dead clicks</th>
                <th className="py-2">Rage clicks</th>
                <th className="py-2">Dwell (s)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.section} className="border-b border-border/50">
                  <td className="py-2 font-medium">{r.section}</td>
                  <td className="py-2">{formatNumber(r.views)}</td>
                  <td className="py-2">{formatNumber(r.deadClicks)}</td>
                  <td className="py-2">{formatNumber(r.rageClicks)}</td>
                  <td className="py-2">{Math.round(r.dwellMs / 1000)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
