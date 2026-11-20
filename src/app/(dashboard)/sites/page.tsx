'use client';

import type * as React from 'react';
import { useSession } from '@/lib/session';
import { canEdit } from '@/lib/permissions';
import { useState } from 'react';
import Link from 'next/link';
import { api, type Site } from '@/lib/api';
import { useSites } from '@/lib/use-sites';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { DataState } from '@/components/data-state';
import { normalizeSiteDomain } from '@/lib/site-domain';

export default function SitesPage(): React.ReactElement {
  const editable = canEdit(useSession().role);
  const { sites, loading, error, addSite, selectSite, favoriteSiteId, favoriteBusy, preferenceError, setFavorite, reload } = useSites();
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function createSite(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const primaryDomain = normalizeSiteDomain(domain);
      const site = await api.post<Site>('/sites', { name, primaryDomain });
      addSite(site);
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
      <PageHeader title="Sites" description="Marque um favorito para abrir esse site por padrão em qualquer dispositivo." />
      {preferenceError && <div role="alert" className="mb-4 text-sm"><p>{preferenceError}</p><Button variant="outline" className="mt-2 h-11" onClick={reload} disabled={favoriteBusy}>Tentar novamente</Button></div>}
      <p role="status" className="mb-4 text-sm text-muted-foreground">{favoriteBusy ? 'Salvando favorito…' : favoriteSiteId ? `Site padrão: ${sites.find(site => site.id === favoriteSiteId)?.name ?? ''}` : 'Nenhum favorito definido. Marque a estrela de um site para usá-lo como padrão.'}</p>

      {editable && <Card className="mb-6">
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
            <label htmlFor="site-domain" className="mb-1 text-xs text-muted-foreground">Primary domain</label>
            <input
              id="site-domain"
              aria-describedby="site-domain-help"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              required
              className="h-9 rounded-md border border-border px-3 text-sm"
              placeholder="example.com"
            />
            <p id="site-domain-help" className="mt-1 text-xs text-muted-foreground">Aceita domínio ou URL completa; salvamos apenas o domínio e a porta, se houver.</p>
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create site'}
          </Button>
        </form>
        {formError ? <p role="alert" className="mt-2 text-sm text-red-600">{formError}</p> : null}
      </Card>}

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : sites.length === 0 ? (
        <DataState title="Seu primeiro site começa por aqui" description={editable ? 'Cadastre o nome e o domínio no formulário acima. Depois, você receberá as instruções para instalar o snippet e começar a coletar dados.' : 'Peça a um editor ou administrador para cadastrar um site. Assim que ele estiver conectado, você poderá acompanhar seus dados.'} />
      ) : (
        <div className="grid gap-3">
          {sites.map((site) => (
            <Card key={site.id} className="flex min-w-0 items-start gap-3 transition-colors hover:border-primary sm:items-center">
              <Link href={`/sites/${site.id}`} onClick={() => selectSite(site.id)} className="min-w-0 flex-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <p className="break-words font-medium">{site.name}</p>
                <p className="break-all text-sm text-muted-foreground">{site.primaryDomain}</p>
                <p className="mt-1 text-xs text-muted-foreground">config v{site.configVersion} · {site.status}{favoriteSiteId === site.id ? ' · Favorito — abre por padrão' : ''}</p>
              </Link>
              <Button type="button" variant="ghost" className="h-11 w-11 shrink-0 p-0" disabled={favoriteBusy} aria-pressed={favoriteSiteId === site.id}
                aria-label={`${favoriteSiteId === site.id ? 'Remover favorito' : 'Favoritar'}: ${site.name}`}
                onClick={() => { void setFavorite(favoriteSiteId === site.id ? null : site.id); }}>
                <svg aria-hidden="true" viewBox="0 0 24 24" className={`h-5 w-5 ${favoriteSiteId === site.id ? 'fill-primary text-primary' : 'fill-none text-muted-foreground'}`} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d="m12 3 2.78 5.63L21 9.54l-4.5 4.39 1.06 6.2L12 17.2l-5.56 2.93 1.06-6.2L3 9.54l6.22-.91L12 3Z" /></svg>
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
