import type * as React from 'react';
import { cn, formatNumber } from '@/lib/utils';

/** Thin progress bar with an optional "current / target unit" caption. */
export function Progress({
  value,
  max,
  unit,
  className,
}: {
  value: number;
  max: number;
  unit?: string;
  className?: string;
}): React.ReactElement {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={cn('w-full', className)}>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-xs tabular-nums text-muted-foreground">
        {formatNumber(value)} / {formatNumber(max)}
        {unit ? ` ${unit}` : ''}
      </p>
    </div>
  );
}
