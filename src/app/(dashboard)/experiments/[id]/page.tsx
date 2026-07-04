'use client';

import type * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Card, CardTitle, Badge } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';

interface Change {
  id: string;
  selector: string;
  op: string;
  originalValue: string | null;
  proposedValue: string | null;
}
interface Variant {
  id: string;
  name: string;
  isControl: boolean;
  weight: number;
  changes: Change[];
}
interface ExperimentDetail {
  id: string;
  name: string;
  hypothesis: string | null;
  status: string;
  type: string;
  riskScore: number;
  allocation: number;
  variants: Variant[];
}

/** Lifecycle actions available per status (mirrors the API state machine). */
const ACTIONS: Record<string, { label: string; action: string; variant?: 'destructive' | 'outline' }[]> = {
  draft: [{ label: 'Submit for review', action: 'submit' }],
  ai_suggested: [{ label: 'Submit for review', action: 'submit' }],
  pending_review: [
    { label: 'Approve', action: 'approve' },
    { label: 'Reject', action: 'reject', variant: 'destructive' },
  ],
  approved: [{ label: 'Start', action: 'start' }],
  scheduled: [{ label: 'Start now', action: 'start' }],
  running: [
    { label: 'Pause', action: 'pause', variant: 'outline' },
    { label: 'Complete', action: 'complete' },
    { label: 'Rollback', action: 'rollback', variant: 'destructive' },
    { label: 'Kill switch', action: 'kill', variant: 'destructive' },
  ],
  paused: [
    { label: 'Resume', action: 'start' },
    { label: 'Rollback', action: 'rollback', variant: 'destructive' },
  ],
  completed: [{ label: 'Rollback', action: 'rollback', variant: 'destructive' }],
};

export default function ExperimentReviewPage(): React.ReactElement {
  const params = useParams<{ id: string }>();
  const [exp, setExp] = useState<ExperimentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .get<ExperimentDetail>(`/experiments/${params.id}`)
      .then(setExp)
      .catch((e: Error) => setError(e.message));
  }, [params.id]);

  useEffect(() => load(), [load]);

  async function run(action: string): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const body =
        action === 'reject'
          ? { reason: 'Rejected from review' }
          : action === 'approve'
            ? { reason: 'Approved from review', checklist: { privacy: true, brand: true } }
            : undefined;
      await api.post(`/experiments/${params.id}/${action}`, body);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !exp) return <p className="text-sm text-red-600">{error}</p>;
  if (!exp) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const actions = ACTIONS[exp.status] ?? [];

  return (
    <div>
      <PageHeader
        title={exp.name}
        description={exp.hypothesis ?? undefined}
        action={<Badge>{exp.status}</Badge>}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {actions.map((a) => (
          <Button key={a.action} variant={a.variant} disabled={busy} onClick={() => run(a.action)}>
            {a.label}
          </Button>
        ))}
      </div>
      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <Card className="mb-4">
        <CardTitle>Details</CardTitle>
        <dl className="mt-2 grid grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Type</dt>
            <dd>{exp.type}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Risk score</dt>
            <dd>{exp.riskScore}/100</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Traffic allocation</dt>
            <dd>{Math.round(exp.allocation * 100)}%</dd>
          </div>
        </dl>
      </Card>

      <div className="grid gap-3">
        {exp.variants.map((v) => (
          <Card key={v.id}>
            <div className="mb-2 flex items-center justify-between">
              <CardTitle>
                {v.name} {v.isControl ? '(control)' : ''}
              </CardTitle>
              <span className="text-xs text-muted-foreground">weight {v.weight}</span>
            </div>
            {v.changes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No changes (baseline).</p>
            ) : (
              <ul className="space-y-2">
                {v.changes.map((c) => (
                  <li key={c.id} className="rounded border border-border p-3 text-sm">
                    <p className="font-mono text-xs text-muted-foreground">
                      {c.op} · {c.selector}
                    </p>
                    {c.originalValue ? (
                      <p className="mt-1 line-through opacity-60">{c.originalValue}</p>
                    ) : null}
                    {c.proposedValue ? <p className="mt-0.5">{c.proposedValue}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
