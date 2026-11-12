'use client';

import type * as React from 'react';
import { useSession } from '@/lib/session';
import { canEdit } from '@/lib/permissions';
import { useCallback, useEffect, useId, useState } from 'react';
import { api, ApiRequestError, type ConversionGoal, type GoalKind } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type UrlOp = 'exact' | 'prefix' | 'contains' | 'regex';

const inputClass =
  'min-h-11 min-w-0 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

/** Per-site conversion goal management (create, list, delete). */
export function GoalsManager({ siteId }: { siteId: string }): React.ReactElement {
  const editable = canEdit(useSession().role);
  const [goals, setGoals] = useState<ConversionGoal[]>([]);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<GoalKind>('event');
  const [urlOp, setUrlOp] = useState<UrlOp>('exact');
  const [urlPath, setUrlPath] = useState('');
  const [selector, setSelector] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState('');
  const fieldId = useId();

  const load = useCallback(() => {
    api
      .get<ConversionGoal[]>(`/sites/${siteId}/goals`)
      .then(setGoals)
      .finally(() => setLoaded(true))
      .catch((e: Error) => setError(e.message));
  }, [siteId]);

  useEffect(() => {
    load();
  }, [load]);

  async function create(): Promise<void> {
    if (busy) return;
    setError(null);
    setNotice('');
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
      setNotice('Goal added. Incoming matching events will count as conversions.');
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
        Define the business outcome to measure. Event goals require a confirmed-success call;
        URL visits and native form submissions are matched automatically by the API.
        Labels alone do not define conversions.
      </p>

      {error ? <p role="alert" className="mt-3 text-sm text-red-600">{error}</p> : null}

      <p role="status" className="mt-2 text-sm text-muted-foreground">{notice}</p>

      <div className="mt-4 space-y-2">
        {!loaded ? <p className="text-sm text-muted-foreground">Loading goals...</p> : error && goals.length === 0 ? null : goals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No goals yet.</p>
        ) : (
          goals.map((g) => {
            const summary = matcherSummary(g);
            return (
              <div
                key={g.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
              >
                <div className="min-w-0 break-words text-sm">
                  <span className="font-medium">{g.name}</span>{' '}
                  <span className="text-muted-foreground">· {g.kind}</span>
                  {summary ? <span className="text-muted-foreground"> · {summary}</span> : null}
                </div>
                {editable && <Button size="sm" variant="destructive" onClick={() => remove(g.id)}>
                  Delete
                </Button>}
              </div>
            );
          })
        )}
      </div>

      {editable && <form onSubmit={(event) => { event.preventDefault(); void create(); }} className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4">
        <div className="flex min-w-0 flex-1 basis-44 flex-col">
          <label htmlFor={`${fieldId}-name`} className="mb-1 text-xs text-muted-foreground">Name</label>
          <input id={`${fieldId}-name`}
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="lead_received"
            maxLength={64}
            required
          />
        </div>
        <div className="flex min-w-0 flex-1 basis-44 flex-col">
          <label htmlFor={`${fieldId}-kind`} className="mb-1 text-xs text-muted-foreground">Kind</label>
          <select id={`${fieldId}-kind`}
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
            <div className="flex min-w-0 flex-1 basis-44 flex-col">
              <label htmlFor={`${fieldId}-match`} className="mb-1 text-xs text-muted-foreground">Match</label>
              <select id={`${fieldId}-match`}
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
            <div className="flex min-w-0 flex-1 basis-44 flex-col">
              <label htmlFor={`${fieldId}-path`} className="mb-1 text-xs text-muted-foreground">Path</label>
              <input id={`${fieldId}-path`}
                className={inputClass}
                value={urlPath}
                onChange={(e) => setUrlPath(e.target.value)}
                placeholder="/thank-you"
              />
            </div>
          </>
        ) : null}

        {kind === 'form_submit' ? (
          <div className="flex min-w-0 flex-1 basis-44 flex-col">
            <label htmlFor={`${fieldId}-selector`} className="mb-1 text-xs text-muted-foreground">Selector (optional)</label>
            <input id={`${fieldId}-selector`}
              className={inputClass}
              value={selector}
              onChange={(e) => setSelector(e.target.value)}
              placeholder={'[data-lo-id="lead-form"]'}
            />
          </div>
        ) : null}

        <p className="w-full text-sm text-muted-foreground">
          {kind === 'event' ? <>After confirmed success, call <code>LandingOptimizer.conversion({JSON.stringify(name.trim() || 'lead_received')})</code>. The name must match exactly.</> : null}
          {kind === 'url' ? 'Matches page views by pathname, without query parameters or fragments. Use a real success page, not a contact anchor.' : null}
          {kind === 'form_submit' ? 'Counts submission attempts, including requests that later fail. Leave the selector empty to match any tracked form, or use its exact data-lo-id selector.' : null}
        </p>
        <Button type="submit" disabled={busy}>
          {busy ? 'Adding…' : 'Add goal'}
        </Button>
      </form>}
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
    return sel ? `selector ${sel}` : 'any tracked form';
  }
  return '';
}

function errorMessage(e: unknown): string {
  if (e instanceof ApiRequestError) return e.error.message;
  if (e instanceof Error) return e.message;
  return 'Something went wrong';
}
