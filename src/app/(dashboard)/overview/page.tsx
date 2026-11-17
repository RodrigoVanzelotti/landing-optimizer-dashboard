'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { AnalyticsTimeframe } from '@/lib/api';
import { useSites } from '@/lib/use-sites';
import { useSession } from '@/lib/session';
import { greeting } from '@/lib/analytics';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { DataState } from '@/components/data-state';
import { SiteHeatmap } from '@/components/site-heatmap';
import { OverviewAnalytics } from '@/components/overview-analytics';

export default function OverviewPage() {
  return <Suspense fallback={<DataState loading title="Carregando…" />}><OverviewContent /></Suspense>;
}

function OverviewContent() {
  const params = useSearchParams();
  const tab = params.get('tab') === 'experience' ? 'experience' : 'data';
  const user = useSession();
  const { sites, loading, error } = useSites();
  const [selected, setSelected] = useState('');
  const siteId = selected || sites[0]?.id || '';
  const site = sites.find(s => s.id === siteId);
  const [hello, setHello] = useState('Olá');
  const [attempt, setAttempt] = useState(0);
  const [timeframe, setTimeframe] = useState<AnalyticsTimeframe>('30d');

  useEffect(() => {
    const update = () => setHello(greeting(new Date().getHours()));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const retry = () => setAttempt(n => n + 1);
  const name = user.name?.trim().split(/\s+/)[0];

  return (
    <div lang="pt-BR">
      <PageHeader title={`${hello}${name ? `, ${name}` : ''}.`}
        action={<Button variant="outline" className="h-11" onClick={retry} disabled={!siteId}>Atualizar dados</Button>} />
      {error ? <DataState error title="Não foi possível carregar seus sites" description="Confira sua conexão e tente novamente." onRetry={() => window.location.reload()} />
        : loading ? <DataState loading title="Carregando…" />
        : !sites.length ? <DataState title="Nenhum site cadastrado" description="Cadastre um site e instale o snippet." href="/sites" action="Ir para sites" />
        : <>
          <div className="mb-6 flex flex-col gap-4 border-y border-border py-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 sm:max-w-sm">
              <label htmlFor="overview-site" className="mb-2 block text-sm font-medium">Site</label>
              <select id="overview-site" value={siteId} onChange={e => setSelected(e.target.value)} className="h-11 w-full min-w-0 rounded-md border border-border bg-background px-3 text-sm">
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <p className="break-all text-sm text-muted-foreground">{site?.primaryDomain}</p>
          </div>
          <nav aria-label="Nesta visão geral" className="mb-8 flex flex-wrap gap-x-6 gap-y-2 border-b border-border">
            {[['data', 'Dados e indicadores'], ['experience', 'Experiência do usuário']].map(([id, label]) => <Link key={id} href={`/overview?tab=${id}`} scroll={false} aria-current={tab === id ? 'page' : undefined} className={`inline-flex min-h-11 items-center border-b-2 px-1 py-3 text-sm font-medium ${tab === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{label}</Link>)}
          </nav>
          {tab === 'data' ? <OverviewAnalytics siteId={siteId} timeframe={timeframe} onTimeframeChange={setTimeframe} refreshKey={attempt} /> : <section id="heatmap" aria-labelledby="heatmap-heading"><h2 id="heatmap-heading" className="text-xl font-semibold tracking-tight">Mapa de interações</h2><p className="mb-5 mt-2 text-sm text-muted-foreground">Cliques, atenção e rolagem na captura.</p><SiteHeatmap key={`${siteId}-${attempt}`} siteId={siteId} domain={site?.primaryDomain} /></section>}
        </>}
    </div>
  );
}
