'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSession } from '@/lib/session';
import { canViewRoute } from '@/lib/permissions';
import { PageHeader } from '@/components/page-header';
import { TeamSettings } from '@/components/team-settings';
import { AuditSettings } from '@/components/audit-settings';
import { DataState } from '@/components/data-state';

export function WorkspaceSettings({ defaultTab = 'team' }: { defaultTab?: string }) {
  return <Suspense fallback={<DataState loading title="Carregando configurações…" />}><SettingsContent defaultTab={defaultTab} /></Suspense>;
}

function SettingsContent({ defaultTab }: { defaultTab: string }) {
  const user = useSession();
  const params = useSearchParams();
  const tabs = [
    { id: 'team', title: 'Equipe', route: '/team' },
    { id: 'audit', title: 'Registro de atividades', route: '/audit' },
    { id: 'billing', title: 'Cobrança', route: '/billing' },
  ].filter(tab => canViewRoute(user.role, tab.route, user.platformOwner));
  const selected = tabs.find(tab => tab.id === (params.get('tab') || defaultTab))?.id ?? tabs[0]?.id;
  const base = canViewRoute(user.role, '/settings') ? '/settings' : '/audit';
  return <div lang="pt-BR">
    <PageHeader title="Configurações" description="Gerencie as pessoas, acompanhe as atividades e consulte a cobrança do seu workspace." />
    <nav aria-label="Configurações do workspace" className="mb-8 flex flex-wrap gap-x-6 gap-y-2 border-b border-border">
      {tabs.map(tab => <Link key={tab.id} href={`${base}?tab=${tab.id}`} aria-current={selected === tab.id ? 'page' : undefined} className={`inline-flex min-h-11 items-center border-b-2 px-1 py-3 text-sm font-medium ${selected === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{tab.title}</Link>)}
    </nav>
    {selected === 'team' && <TeamSettings />}
    {selected === 'audit' && <AuditSettings />}
    {selected === 'billing' && <section><h2 className="mb-4 text-xl font-semibold">Cobrança</h2><DataState title="Você ainda não precisa configurar a cobrança" description="A cobrança pelo produto ainda não está disponível. Quando estiver, você poderá consultar o plano, o consumo e os pagamentos por aqui." /></section>}
  </div>;
}
