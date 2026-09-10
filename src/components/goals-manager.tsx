'use client';

import type * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiRequestError, type ConversionGoal, type GoalKind } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type UrlOp = 'exact' | 'prefix' | 'contains' | 'regex';

const inputClass =
  'rounded-md border border-border bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

/** Per-site conversion goal management (create, list, delete). */
export function GoalsManager({ siteId }: { siteId: string }): React.ReactElement {
  const [goals, setGoals] = useState<ConversionGoal[]>([]);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<GoalKind>('event');
  const [urlOp, setUrlOp] = useState<UrlOp>('exact');
  const [urlPath, setUrlPath] = useState('');
  const [selector, setSelector] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .get<ConversionGoal[]>(`/sites/${siteId}/goals`)
      .then(setGoals)
      .catch((e: Error) => setError(e.message));
  }, [siteId]);

  useEffect(() => {
    load();
  }, [load]);

  async function create(): Promise<void> {
    setError(null);
    if (!name.trim()) {
      setError('Goal name is required.');
      return;
    }
    if (kind === 'url' && !urlPath.trim()) {
      setError('A URL path is required for url goals.');
      return;
    }
    setBusy(true);
    try {
      const matcher =
        kind === 'url'
          ? { op: urlOp, path: urlPath.trim() }
          : kind === 'form_submit' && selector.trim()
            ? { selector: selector.trim() }
            : undefined;
      await api.post<ConversionGoal>(`/sites/${siteId}/goals`, {
        name: name.trim(),
        kind,
        ...(matcher ? { matcher } : {}),
      });
      setName('');
      setUrlPath('');
      setSelector('');
      load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string): Promise<void> {
    setError(null);
    try {
      await api.del(`/sites/${siteId}/goals/${id}`);
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Card>
      <CardTitle>Conversion goals</CardTitle>
      <p className="mt-1 text-xs text-muted-foreground">
        Goals define what counts as a conversion. <code>event</code> goals are recorded when the
        snippet calls <code>conversion(&quot;name&quot;)</code>.
      </p>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <div className="mt-4 space-y-2">
        {goals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No goals yet.</p>
        ) : (
          goals.map((g) => {
            const summary = matcherSummary(g);
            return (
              <div
                key={g.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <div className="text-sm">
                  <span className="font-medium">{g.name}</span>{' '}
                  <span className="text-muted-foreground">· {g.kind}</span>
                  {summary ? <span className="text-muted-foreground"> · {summary}</span> : null}
                </div>
                <Button size="sm" variant="destructive" onClick={() => remove(g.id)}>
                  Delete
                </Button>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-border pt-4">
        <div className="flex flex-col">
          <label className="mb-1 text-xs text-muted-foreground">Name</label>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="signup"
            maxLength={80}
          />
        </div>
        <div className="flex flex-col">
          <label className="mb-1 text-xs text-muted-foreground">Kind</label>
          <select
            className={inputClass}
            value={kind}
            onChange={(e) => setKind(e.target.value as GoalKind)}
          >
            <option value="event">event</option>
            <option value="url">url</option>
            <option value="form_submit">form_submit</option>
          </select>
        </div>

        {kind === 'url' ? (
          <>
            <div className="flex flex-col">
              <label className="mb-1 text-xs text-muted-foreground">Match</label>
              <select
                className={inputClass}
                value={urlOp}
                onChange={(e) => setUrlOp(e.target.value as UrlOp)}
              >
                <option value="exact">exact</option>
                <option value="prefix">prefix</option>
                <option value="contains">contains</option>
                <option value="regex">regex</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="mb-1 text-xs text-muted-foreground">Path</label>
              <input
                className={inputClass}
                value={urlPath}
                onChange={(e) => setUrlPath(e.target.value)}
                placeholder="/thank-you"
              />
            </div>
          </>
        ) : null}

        {kind === 'form_submit' ? (
          <div className="flex flex-col">
            <label className="mb-1 text-xs text-muted-foreground">Selector (optional)</label>
            <input
              className={inputClass}
              value={selector}
              onChange={(e) => setSelector(e.target.value)}
              placeholder="#signup-form"
            />
          </div>
        ) : null}

        <Button onClick={create} disabled={busy}>
          {busy ? 'Adding…' : 'Add goal'}
        </Button>
      </div>
    </Card>
  );
}

function matcherSummary(goal: ConversionGoal): string {
  const m = goal.matcher ?? {};
  if (goal.kind === 'url') {
    const op = (m as { op?: string }).op ?? 'exact';
    const path = (m as { path?: string }).path ?? '';
    return `${op} ${path}`.trim();
  }
  if (goal.kind === 'form_submit') {
    const sel = (m as { selector?: string }).selector;
    return sel ? `selector ${sel}` : '';
  }
  return '';
}

function errorMessage(e: unknown): string {
  if (e instanceof ApiRequestError) return e.error.message;
  if (e instanceof Error) return e.message;
  return 'Something went wrong';
}
