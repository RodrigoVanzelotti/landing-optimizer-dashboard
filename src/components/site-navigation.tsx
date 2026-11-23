'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useSites } from '@/lib/use-sites';
import { Button } from '@/components/ui/button';
import { DataState } from '@/components/data-state';
import { useEffect, type ReactNode } from 'react';

const siteRoutes = ['/overview', '/insights', '/experiments', '/results', '/guardrails', '/analytics', '/sections', '/heatmap', '/approvals'];

export function SiteNavigation() {
  const { sites, siteId, selectSite, loading, error, preferenceError, favoriteSiteId, reload } = useSites();
  const pathname = usePathname();
  const router = useRouter();
  const installId = pathname.startsWith('/sites/') ? pathname.split('/')[2] : null;
  const current = sites.find(site => site.id === (installId ?? siteId));
  useEffect(() => { if (installId) selectSite(installId); }, [installId, selectSite]);
  if (!installId && !siteRoutes.some(route => pathname === route || pathname.startsWith(`${route}/`))) return null;
  return <nav aria-label="Site em visualização" className="mb-5 min-w-0 px-2">
    <div className="min-w-0">
      <label htmlFor="active-site" className="mb-1 block text-xs text-muted-foreground">Site ativo</label>
      <select id="active-site" value={current?.id ?? ''} disabled={loading || !!error || !sites.length}
        title={current?.name}
        onChange={event => {
          selectSite(event.target.value);
          if (installId) router.push(`/sites/${event.target.value}`);
          else if (pathname === '/experiments' || pathname === '/insights') router.replace(pathname);
        }} className="h-11 w-full min-w-0 truncate rounded-md border border-border bg-transparent pl-2 pr-6 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        {!current && <option value="">{loading ? 'Carregando sites…' : error ? 'Sites indisponíveis' : 'Nenhum site cadastrado'}</option>}
        {sites.map(site => <option key={site.id} value={site.id}>{site.name}{site.id === favoriteSiteId ? ' · Favorito' : ''}</option>)}
      </select>
    </div>
    {error || preferenceError ? <div role="alert" className="mt-2 text-xs leading-relaxed"><p>{error ?? preferenceError}</p><Button variant="outline" className="mt-2 h-11" onClick={reload}>Tentar novamente</Button></div>
      : current && <p title={current.primaryDomain} className="mt-1 truncate text-xs text-muted-foreground">{current.primaryDomain}</p>}
  </nav>;
}

export function SiteScope({ children }: { children: ReactNode }) {
  const { siteId, loading, error, reload } = useSites();
  const pathname = usePathname();
  if (!siteRoutes.some(route => pathname === route || pathname.startsWith(`${route}/`))) return children;
  if (error) return <DataState error title="Não foi possível carregar seus sites" description="Tente novamente para visualizar os dados." onRetry={reload} />;
  if (loading) return <DataState loading title="Carregando site…" />;
  if (!siteId) return <DataState title="Selecione seu primeiro site" description="Cadastre um site para acompanhar os dados e as oportunidades de melhoria." href="/sites" action="Ir para sites" />;
  // Unmount site-specific forms, requests and results immediately on a site change.
  return <div key={siteId}>{children}</div>;
}
