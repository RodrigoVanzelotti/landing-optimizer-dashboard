'use client';

import type * as React from 'react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';

interface AuditRow {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  createdAt: string;
}

export default function AuditPage(): React.ReactElement {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<AuditRow[]>('/audit')
      .then(setRows)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div>
      <PageHeader title="Audit log" description="Immutable record of every privileged action. No PII." />
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No audit entries yet.</p>
      ) : (
        <Card>
          <ul className="divide-y divide-border text-sm">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2">
                <span className="font-mono">{r.action}</span>
                <span className="text-muted-foreground">
                  {r.targetType}:{r.targetId.slice(0, 8)} · {new Date(r.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
