'use client';

import type * as React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useSession } from '@/lib/session';
import { canViewRoute, roleLabels } from '@/lib/permissions';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

export const NAV_ITEMS: { href: string; label: string }[] = [
  { href: '/overview', label: 'Overview' },
  { href: '/sites', label: 'Sites' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/sections', label: 'Section performance' },
  { href: '/heatmap', label: 'Heatmap' },
  { href: '/insights', label: 'AI insights' },
  { href: '/experiments', label: 'Experiments' },
  { href: '/approvals', label: 'Experiment review' },
  { href: '/results', label: 'Results' },
  { href: '/guardrails', label: 'Brand guardrails' },
  { href: '/audit', label: 'Audit log' },
  { href: '/team', label: 'Team members' },
  { href: '/settings', label: 'Settings' },
  { href: '/billing', label: 'Billing' },
  { href: '/tenants', label: 'Clientes' },
];

export function Sidebar(): React.ReactElement {
  const pathname = usePathname();
  const user = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function logout(): Promise<void> {
    setBusy(true);
    setError(false);
    try {
      await api.logout();
      window.location.replace('/login');
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-border bg-muted/30 p-4 md:w-60 md:border-b-0 md:border-r">
      <div className="mb-6 px-2 text-lg font-semibold">
        Landing<span className="text-primary">Optimizer</span>
      </div>
      <p className="mb-4 px-2 text-xs text-muted-foreground">{roleLabels[user.role]}</p>
      <nav className="flex flex-row gap-0.5 overflow-x-auto md:flex-col">
        {NAV_ITEMS.filter((item) => canViewRoute(user.role, item.href, user.platformOwner)).map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'shrink-0 rounded-md px-3 py-2 text-sm transition-colors',
                active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto pt-4 md:pt-6">
        <Button
          type="button"
          variant="ghost"
          className="h-11 w-full justify-start px-3 font-normal text-muted-foreground"
          disabled={busy}
          aria-busy={busy}
          onClick={logout}
        >
          {busy ? 'Saindo…' : 'Sair'}
        </Button>
        {error ? (
          <p role="alert" className="mt-2 px-3 text-xs text-red-600">
            Não foi possível sair. Tente novamente.
          </p>
        ) : null}
      </div>
    </aside>
  );
}
