'use client';

import type * as React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { api, type Site } from '@/lib/api';
import { useSites } from '@/lib/use-sites';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';

export default function SitesPage(): React.ReactElement {
  const { sites, loading, error } = useSites();
  const [list, setList] = useState<Site[] | null>(null);
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const rows = list ?? sites;

  async function createSite(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const site = await api.post<Site>('/sites', { name, primaryDomain: domain });
      setList([site, ...rows]);
      setName('');
      setDomain('');
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader title="Sites" description="Each site gets a unique, signed install snippet." />

      <Card className="mb-6">
        <form onSubmit={createSite} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col">
            <label className="mb-1 text-xs text-muted-foreground">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-9 rounded-md border border-border px-3 text-sm"
              placeholder="Marketing site"
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-xs text-muted-foreground">Primary domain</label>
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              required
              className="h-9 rounded-md border border-border px-3 text-sm"
              placeholder="example.com"
            />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create site'}
          </Button>
        </form>
        {formError ? <p className="mt-2 text-sm text-red-600">{formError}</p> : null}
      </Card>

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : loading && !list ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sites yet.</p>
      ) : (
        <div className="grid gap-3">
          {rows.map((site) => (
            <Link key={site.id} href={`/sites/${site.id}`}>
              <Card className="transition-colors hover:border-primary">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{site.name}</p>
                    <p className="text-sm text-muted-foreground">{site.primaryDomain}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    config v{site.configVersion} · {site.status}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
