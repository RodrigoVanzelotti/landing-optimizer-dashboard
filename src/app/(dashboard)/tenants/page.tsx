'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { roleLabels, type UserRole } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';

interface TenantSummary {
  id: string; name: string; slug: string; plan: string; dataRegion: string; archivedAt: string | null; createdAt: string;
  _count: { memberships: number; sites: number };
}
interface TenantDetail extends Omit<TenantSummary, '_count'> {
  memberships: { id: string; role: UserRole; user: { id: string; name: string | null; email: string } }[];
  sites: { id: string; name: string; primaryDomain: string; status: string }[];
  invitations: { id: string; name: string; email: string; role: UserRole; expiresAt: string }[];
}
interface GeneratedLink { url: string; title: string; expiresAt: string }
const inputClass = 'h-11 w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

export default function TenantsPage(): React.ReactElement {
  const user = useSession();
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [link, setLink] = useState<GeneratedLink | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const loadList = useCallback(async () => {
    const rows = await api.get<TenantSummary[]>('/platform/tenants');
    setTenants(rows);
    return rows;
  }, []);
  useEffect(() => {
    let active = true;
    void loadList().then((rows) => { if (active) setSelectedId(rows[0]?.id ?? ''); })
      .catch((err: Error) => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadList]);
  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    setDetail(null);
    void api.get<TenantDetail>(`/platform/tenants/${selectedId}`).then((result) => { if (active) setDetail(result); })
      .catch((err: Error) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [selectedId]);

  async function act(action: () => Promise<void>): Promise<void> {
    if (busy) return;
    setBusy(true); setError(null); setNotice(null); setCopied(false);
    try { await action(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível concluir. Tente novamente.'); }
    finally { setBusy(false); }
  }

  async function create(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await act(async () => {
      const result = await api.post<{ tenantId: string; invitationUrl: string; expiresAt: string }>('/platform/tenants', {
        tenantName: data.get('tenantName'), name: data.get('name'), email: data.get('email'),
      });
      setLink({ url: result.invitationUrl, title: `Convite do primeiro administrador: ${data.get('email')}`, expiresAt: result.expiresAt });
      setSelectedId(result.tenantId); setShowCreate(false);
      await loadList();
      setNotice('Cliente criado. Envie o convite ao primeiro administrador.');
    });
  }

  async function resetPassword(member: TenantDetail['memberships'][number]): Promise<void> {
    if (!detail) return;
    await act(async () => {
      const result = await api.post<{ url: string; expiresAt: string }>(`/platform/tenants/${detail.id}/users/${member.user.id}/password-reset`);
      setLink({ ...result, title: `Redefinição de senha: ${member.user.email}` });
      setNotice('Envie o link ao usuário. A senha só muda quando ele concluir a redefinição.');
    });
  }

  async function changeStatus(archive: boolean): Promise<void> {
    if (!detail) return;
    await act(async () => {
      await api.post(`/platform/tenants/${detail.id}/${archive ? 'archive' : 'restore'}`, archive ? { confirmation } : undefined);
      setDetail(await api.get<TenantDetail>(`/platform/tenants/${detail.id}`));
      await loadList(); setConfirmation(''); setLink(null);
      setNotice(archive ? 'Cliente arquivado. Seus dados foram preservados e os acessos estão bloqueados.' : 'Cliente reativado.');
    });
  }

  async function copy(): Promise<void> {
    if (!link) return;
    try { await navigator.clipboard.writeText(link.url); setCopied(true); }
    catch { setError('Selecione e copie o link abaixo. A cópia automática não está disponível.'); }
  }

  const ownTenant = detail?.id === user.tenantId || detail?.memberships.some((member) => member.user.id === user.id);

  return (
    <div lang="pt-BR" className="mx-auto max-w-6xl">
      <PageHeader title="Clientes" description="Gestão exclusiva da plataforma. Clientes, pessoas e acessos em um só lugar."
        action={<Button disabled={busy} variant={showCreate ? 'outline' : 'default'} onClick={() => setShowCreate(!showCreate)}>{showCreate ? 'Cancelar' : 'Novo cliente'}</Button>} />
      {error && <p role="alert" className="mb-5 rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="mb-5 text-sm text-green-800">{notice}</p>}
      {showCreate && <section className="mb-8 rounded-xl bg-muted/50 p-5 sm:p-6" aria-labelledby="new-tenant-title">
        <h2 id="new-tenant-title" className="text-xl font-semibold">Convide um novo cliente</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">O workspace será criado agora. O primeiro administrador escolhe a própria senha pelo convite, válido por 7 dias.</p>
        <form onSubmit={create} className="mt-5 grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="tenant-name" className="mb-2 block text-sm font-medium">Nome do cliente</label><input id="tenant-name" name="tenantName" maxLength={120} required disabled={busy} className={inputClass} /></div>
          <div><label htmlFor="admin-name" className="mb-2 block text-sm font-medium">Nome do administrador</label><input id="admin-name" name="name" maxLength={120} required disabled={busy} className={inputClass} /></div>
          <div><label htmlFor="admin-email" className="mb-2 block text-sm font-medium">E-mail do administrador</label><input id="admin-email" name="email" type="email" maxLength={254} required disabled={busy} className={inputClass} /></div>
          <div className="flex items-end"><Button className="h-11" disabled={busy}>{busy ? 'Criando…' : 'Criar cliente e gerar convite'}</Button></div>
        </form>
      </section>}
      {link && <section className="mb-8 rounded-xl bg-primary/5 p-5" aria-labelledby="link-title">
        <h2 id="link-title" className="break-words font-semibold">{link.title}</h2>
        <p className="mt-2 text-sm text-slate-600">Envie somente ao destinatário. Copie agora: o link completo não será exibido novamente. Válido até {new Date(link.expiresAt).toLocaleString('pt-BR')}.</p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row"><input aria-label="Link gerado" readOnly value={link.url} onFocus={(event) => event.target.select()} className={`${inputClass} min-w-0 sm:flex-1`} /><Button onClick={copy} variant="outline" className="h-11">{copied ? 'Copiado' : 'Copiar link'}</Button></div>
        {copied && <p role="status" className="mt-2 text-sm text-green-800">Link copiado.</p>}
      </section>}
      {loading ? <p role="status">Carregando clientes…</p> : !tenants.length ? <p className="text-muted-foreground">Nenhum cliente encontrado. Crie o primeiro pelo botão Novo cliente.</p> : (
        <div className="grid gap-8 lg:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)]">
          <section aria-label="Lista de clientes">
            <p className="mb-3 text-sm text-muted-foreground">{tenants.length} cliente(s), incluindo arquivados</p>
            <ul className="divide-y divide-border border-y border-border">{tenants.map((tenant) => <li key={tenant.id}>
              <button disabled={busy} onClick={() => { setSelectedId(tenant.id); setLink(null); setConfirmation(''); setError(null); setNotice(null); }} aria-current={tenant.id === selectedId ? 'true' : undefined}
                className={`w-full p-4 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${tenant.id === selectedId ? 'bg-primary/5' : ''}`}>
                <span className="block break-words font-medium">{tenant.name}</span><span className="mt-1 block text-xs text-slate-600">{tenant.archivedAt ? 'Arquivado' : 'Ativo'} · {tenant._count.memberships}/10 usuários · {tenant._count.sites} site(s)</span>
              </button>
            </li>)}</ul>
          </section>
          {!detail ? <p role="status">{error ? 'Não foi possível carregar o cliente. Selecione outro ou recarregue a página.' : 'Carregando dados do cliente…'}</p> : <section className="min-w-0" aria-labelledby="tenant-title">
            <div className="border-b border-border pb-5"><h2 id="tenant-title" className="break-words text-2xl font-semibold tracking-tight">{detail.name}</h2><p className="mt-2 text-sm text-muted-foreground">{detail.archivedAt ? 'Arquivado — acesso bloqueado' : 'Cliente ativo'}</p></div>
            <dl className="my-5 grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-muted-foreground">Identificador</dt><dd className="mt-1 break-all">{detail.id}</dd></div>
              <div><dt className="text-muted-foreground">Slug</dt><dd className="mt-1 break-all">{detail.slug}</dd></div>
              <div><dt className="text-muted-foreground">Plano / região dos dados</dt><dd className="mt-1">{detail.plan} / {detail.dataRegion}</dd></div>
              <div><dt className="text-muted-foreground">Criado em</dt><dd className="mt-1">{new Date(detail.createdAt).toLocaleDateString('pt-BR')}</dd></div>
            </dl>
            <h3 className="mt-8 text-lg font-semibold">Usuários do cliente</h3>
            {!detail.memberships.length && <p className="mt-3 text-sm text-muted-foreground">O primeiro administrador ainda não aceitou o convite.</p>}
            <ul className="mt-3 divide-y divide-border">{detail.memberships.map((member) => <li key={member.id} className="flex flex-col gap-3 py-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0"><p className="break-words font-medium">{member.user.name ?? member.user.email}</p><p className="mt-1 break-all text-sm text-muted-foreground">{member.user.email}</p><p className="mt-1 text-xs text-muted-foreground">{roleLabels[member.role] ?? member.role}</p></div>
              <Button variant="outline" className="shrink-0" disabled={busy || !!detail.archivedAt} onClick={() => { void resetPassword(member); }}>Redefinir senha<span className="sr-only"> de {member.user.email}</span></Button>
            </li>)}</ul>
            {!!detail.invitations.length && <><h3 className="mt-8 text-lg font-semibold">Convites pendentes</h3><ul className="mt-3 space-y-3">{detail.invitations.map((invite) => <li key={invite.id} className="break-words text-sm"><span className="font-medium">{invite.name}</span><span className="mt-1 block break-all text-muted-foreground">{invite.email} · {roleLabels[invite.role]}</span></li>)}</ul></>}
            <h3 className="mt-8 text-lg font-semibold">Sites vinculados</h3>
            {!detail.sites.length ? <p className="mt-3 text-sm text-muted-foreground">Nenhum site cadastrado.</p> : <ul className="mt-3 space-y-3">{detail.sites.map((site) => <li key={site.id} className="text-sm"><p className="break-words font-medium">{site.name}</p><p className="mt-1 break-all text-muted-foreground">{site.primaryDomain} · {site.status === 'active' ? 'Ativo' : 'Pausado'}</p></li>)}</ul>}
            <div className="mt-10 border-t border-border pt-6">
              <h3 className="text-lg font-semibold">{detail.archivedAt ? 'Reativar cliente' : 'Arquivar cliente'}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">O arquivamento preserva todos os dados e bloqueia login, convites e ingestão de novos eventos. Você pode reativar o cliente depois.</p>
              {detail.archivedAt ? <Button variant="outline" disabled={busy} className="mt-4" onClick={() => { void changeStatus(false); }}>Reativar cliente</Button> : ownTenant ? <p className="mt-4 text-sm text-muted-foreground">Para preservar seu acesso, não é possível arquivar um cliente ao qual sua conta pertence.</p> : <form onSubmit={(event) => { event.preventDefault(); void changeStatus(true); }} className="mt-4 space-y-3">
                <label htmlFor="archive-confirmation" className="block text-sm font-medium">Digite {detail.name} para confirmar</label><input id="archive-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy} autoComplete="off" className={inputClass} />
                <Button variant="destructive" disabled={busy || confirmation !== detail.name}>Arquivar e bloquear acessos</Button>
              </form>}
            </div>
          </section>}
        </div>
      )}
    </div>
  );
}
