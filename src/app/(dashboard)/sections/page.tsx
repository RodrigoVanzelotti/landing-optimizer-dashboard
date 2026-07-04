'use client';

import type * as React from 'react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useSites } from '@/lib/use-sites';
import { Card } from '@/components/ui/card';
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
  const { sites } = useSites();
  const siteId = sites[0]?.id;
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
        <p className="text-sm text-muted-foreground">No section data yet.</p>
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
