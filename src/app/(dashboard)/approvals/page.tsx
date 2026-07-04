'use client';

import type * as React from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, CardTitle, Badge } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';

interface ApprovalRow {
  id: string;
  status: string;
  riskScore: number;
  createdAt: string;
  experiment: { id: string; name: string; type: string };
}

export default function ApprovalsPage(): React.ReactElement {
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<ApprovalRow[]>('/approvals?status=pending')
      .then(setRows)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader title="Experiment review" description="Pending approvals awaiting a decision." />
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing pending review.</p>
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => (
            <Link key={r.id} href={`/experiments/${r.experiment.id}`}>
              <Card className="transition-colors hover:border-primary">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{r.experiment.name}</p>
                    <p className="text-sm text-muted-foreground">{r.experiment.type}</p>
                  </div>
                  <Badge tone={r.riskScore >= 60 ? 'red' : r.riskScore >= 30 ? 'amber' : 'green'}>
                    risk {r.riskScore}
                  </Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
