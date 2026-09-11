'use client';

import type * as React from 'react';
import Link from 'next/link';
import type { Journey, JourneyMilestone } from '@/lib/api';
import { MILESTONE_COPY, milestoneHref } from '@/lib/journey';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn, formatNumber } from '@/lib/utils';

/**
 * The "Getting started" activation checklist. The server computes every state
 * from real data; this panel makes the path — and the progress toward each
 * unlock — visible, so the next action is always obvious and the next feature
 * is something to look forward to. Collapses to one line once complete.
 */
export function JourneyPanel({
  journey,
  siteId,
}: {
  journey: Journey;
  siteId: string;
}): React.ReactElement {
  const allDone = journey.completed === journey.total;
  if (allDone) {
    return (
      <Card className="mb-6 flex items-center justify-between py-3">
        <p className="text-sm">
          <span className="font-medium text-green-700">Setup complete</span>{' '}
          <span className="text-muted-foreground">
            — all {journey.total} milestones reached. You&rsquo;re running the full loop.
          </span>
        </p>
        <LivePill journey={journey} />
      </Card>
    );
  }

  const activeIndex = journey.milestones.findIndex((m) => !m.done);

  return (
    <Card className="mb-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Getting started</h2>
          <p className="text-xs text-muted-foreground">
            {journey.completed} of {journey.total} milestones — each one unlocks something.
          </p>
        </div>
        <LivePill journey={journey} />
      </div>

      <ol className="space-y-1">
        {journey.milestones.map((m, i) => {
          const copy = MILESTONE_COPY[m.id];
          const active = i === activeIndex;
          const href = milestoneHref(copy, siteId);
          return (
            <li
              key={m.id}
              className={cn(
                'rounded-md px-3 py-2',
                active && 'border border-primary/40 bg-primary/5',
              )}
            >
              <div className="flex items-center gap-3">
                <StatusDot done={m.done} active={active} index={i + 1} />
                <span
                  className={cn(
                    'flex-1 text-sm',
                    m.done ? 'text-muted-foreground' : active ? 'font-medium' : 'text-muted-foreground',
                  )}
                >
                  {copy.title}
                </span>
                {!m.done && !active && m.target ? (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {formatNumber(m.current ?? 0)}/{formatNumber(m.target)}
                  </span>
                ) : null}
                {active && href && copy.cta ? (
                  <Link href={href}>
                    <Button size="sm">{copy.cta.label}</Button>
                  </Link>
                ) : null}
              </div>
              {active ? (
                <div className="ml-8 mt-1.5">
                  <p className="text-xs text-muted-foreground">{copy.description}</p>
                  {m.target ? (
                    <Progress
                      className="mt-2 max-w-xs"
                      value={m.current ?? 0}
                      max={m.target}
                      {...(copy.unit ? { unit: copy.unit } : {})}
                    />
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function StatusDot({
  done,
  active,
  index,
}: {
  done: boolean;
  active: boolean;
  index: number;
}): React.ReactElement {
  if (done) {
    return (
      <span
        aria-label="done"
        className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-[11px] font-bold text-green-700"
      >
        ✓
      </span>
    );
  }
  return (
    <span
      className={cn(
        'flex h-5 w-5 items-center justify-center rounded-full text-[11px] tabular-nums',
        active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
      )}
    >
      {index}
    </span>
  );
}

/**
 * The "it's working" signal: green + relative time while events are flowing,
 * a plain timestamp when stale, and a gentle pulse while waiting for the very
 * first event after install.
 */
export function LivePill({ journey }: { journey: Journey }): React.ReactElement {
  const last = journey.lastEventAt ? Date.parse(journey.lastEventAt) : null;
  const ageMs = last ? Date.now() - last : null;

  if (ageMs !== null && ageMs < 10 * 60 * 1000) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800">
        <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
        Live — last event {relative(ageMs)}
      </span>
    );
  }
  if (last) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
        Last event {new Date(last).toLocaleString()}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-600" />
      Waiting for your first event…
    </span>
  );
}

function relative(ageMs: number): string {
  const s = Math.round(ageMs / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return `${m}m ago`;
}
