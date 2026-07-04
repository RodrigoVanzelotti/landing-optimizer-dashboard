'use client';

import type * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export const NAV_ITEMS: { href: string; label: string }[] = [
  { href: '/overview', label: 'Overview' },
  { href: '/sites', label: 'Sites' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/sections', label: 'Section performance' },
  { href: '/insights', label: 'AI insights' },
  { href: '/experiments', label: 'Experiments' },
  { href: '/approvals', label: 'Experiment review' },
  { href: '/results', label: 'Results' },
  { href: '/guardrails', label: 'Brand guardrails' },
  { href: '/audit', label: 'Audit log' },
  { href: '/team', label: 'Team members' },
  { href: '/settings', label: 'Settings' },
  { href: '/billing', label: 'Billing' },
];

export function Sidebar(): React.ReactElement {
  const pathname = usePathname();
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-muted/30 p-4">
      <div className="mb-6 px-2 text-lg font-semibold">
        Landing<span className="text-primary">Optimizer</span>
      </div>
      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-md px-3 py-2 text-sm transition-colors',
                active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
