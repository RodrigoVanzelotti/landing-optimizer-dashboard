'use client';

import type * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSite } from '@/lib/site-context';
import { cn } from '@/lib/utils';

/**
 * Navigation grouped by intent — Measure (see what visitors do), Optimize
 * (act on it), Configure (setup & admin) — so a first-time user reads the
 * product's story top to bottom instead of scanning 13 flat links. The site
 * selector at the top drives every page (shared SiteProvider).
 */
const NAV_GROUPS: { label: string; items: { href: string; label: string }[] }[] = [
  {
    label: 'Measure',
    items: [
      { href: '/overview', label: 'Overview' },
      { href: '/analytics', label: 'Analytics' },
      { href: '/sections', label: 'Section performance' },
      { href: '/heatmap', label: 'Heatmap' },
    ],
  },
  {
    label: 'Optimize',
    items: [
      { href: '/insights', label: 'AI insights' },
      { href: '/experiments', label: 'Experiments' },
      { href: '/approvals', label: 'Experiment review' },
      { href: '/results', label: 'Results' },
    ],
  },
  {
    label: 'Configure',
    items: [
      { href: '/sites', label: 'Sites' },
      { href: '/guardrails', label: 'Brand guardrails' },
      { href: '/audit', label: 'Audit log' },
      { href: '/team', label: 'Team members' },
      { href: '/settings', label: 'Settings' },
      { href: '/billing', label: 'Billing' },
    ],
  },
];

/** Kept for compatibility with existing imports/tests. */
export const NAV_ITEMS: { href: string; label: string }[] = NAV_GROUPS.flatMap(
  (g) => g.items,
);

export function Sidebar(): React.ReactElement {
  const pathname = usePathname();
  const { sites, siteId, setSiteId } = useSite();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-muted/30 p-4">
      <div className="mb-4 px-2 text-lg font-semibold">
        Landing<span className="text-primary">Optimizer</span>
      </div>

      {sites.length > 0 ? (
        <div className="mb-5 px-2">
          <label htmlFor="site-select" className="mb-1 block text-xs text-muted-foreground">
            Site
          </label>
          <select
            id="site-select"
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <nav className="flex flex-col gap-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + '/');
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
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
