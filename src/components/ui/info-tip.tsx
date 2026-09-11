'use client';

import type * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Small ⓘ affordance with a hover/focus tooltip. Used beside every KPI so a
 * first-time user never has to guess what a number means or whether it's good.
 * Pure CSS visibility (group-hover / focus-within) — no portal needed.
 */
export function InfoTip({
  label,
  children,
  className,
}: {
  /** accessible name, e.g. "About conversion rate". */
  label: string;
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <span className={cn('group relative inline-flex', className)}>
      <button
        type="button"
        aria-label={label}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px] leading-none text-muted-foreground hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        i
      </button>
      <span
        role="tooltip"
        className="invisible absolute left-1/2 top-full z-40 mt-2 w-64 -translate-x-1/2 rounded-md bg-gray-900 px-3 py-2 text-left text-xs font-normal normal-case leading-relaxed text-white opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        {children}
      </span>
    </span>
  );
}
