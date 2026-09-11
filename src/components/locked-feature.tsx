import type * as React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

/**
 * Replaces a dead empty state with anticipation: says what the feature WILL
 * show, how close the user is to unlocking it (live progress from the
 * journey), and the one action that gets them there. Unlocks are honest —
 * they exist because the feature genuinely needs that much data.
 */
export function LockedFeature({
  title,
  description,
  progress,
  cta,
  footnote,
}: {
  title: string;
  /** what the user will get once unlocked — value, not mechanics. */
  description: string;
  progress?: { current: number; target: number; unit?: string };
  cta?: { href: string; label: string };
  footnote?: string;
}): React.ReactElement {
  return (
    <Card className="mx-auto max-w-xl py-10 text-center">
      <LockIcon />
      <h3 className="mt-3 text-base font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      {progress ? (
        <div className="mx-auto mt-5 max-w-xs">
          <Progress
            value={progress.current}
            max={progress.target}
            {...(progress.unit ? { unit: progress.unit } : {})}
          />
        </div>
      ) : null}
      {cta ? (
        <div className="mt-5">
          <Link href={cta.href}>
            <Button>{cta.label}</Button>
          </Link>
        </div>
      ) : null}
      {footnote ? <p className="mt-4 text-xs text-muted-foreground">{footnote}</p> : null}
    </Card>
  );
}

function LockIcon(): React.ReactElement {
  return (
    <svg
      aria-hidden
      className="mx-auto h-8 w-8 text-muted-foreground"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
