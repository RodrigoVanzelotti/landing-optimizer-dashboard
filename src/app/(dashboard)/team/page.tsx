'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { roleLabels, type UserRole } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';

interface Member { id: string; role: UserRole; user: { id: string; name: string | null; email: string } }
interface Invitation { id: string; name: string; email: string; role: UserRole; expiresAt: string }
interface Team { members: Member[]; invitations: Invitation[]; domain: string; userLimit: number; adminLimit: number }
const inputClass = 'h-11 w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

export default function TeamPage(): React.ReactElement {
  const user = useSession();
  const admin = user.role === 'admin';
  const [team, setTeam] = useState<Team | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [role, setRole] = useState<UserRole>('viewer');
  const load = useCallback(async () => { setTeam(await api.get<Team>('/team')); }, []);
  useEffect(() => { void load().catch((err: Error) => setError(err.message)); }, [load]);
  const admins = team?.members.filter((member) => member.role === 'admin').length ?? 0;
  const reservedAdmins = team?.invitations.filter((invite) => invite.role === 'admin').length ?? 0;
  const full = !!team && team.members.length + team.invitations.length >= team.userLimit;
  const adminsFull = !!team && admins + reservedAdmins >= team.adminLimit;

  async function mutate(action: () => Promise<unknown>, message?: string): Promise<void> {
    setBusy(true); setError(null); setNotice(null);
    try { await action(); await load(); if (message) setNotice(message); }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível concluir. Tente novamente.'); }
    finally { setBusy(false); }
  }

  async function invite(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await mutate(async () => {
      const result = await api.post<Invitation & { url: string }>('/team/invitations', { name: data.get('name'), email: data.get('email'), role });
      setLink(result.url); setCopied(false); form.reset(); setRole('viewer');
    });
  }

  async function copy(): Promise<void> {
    try { await navigator.clipboard.writeText(link); setCopied(true); }
    catch { setError('Não foi possível copiar automaticamente. Selecione e copie o link abaixo.'); }
  }

  async function changeRole(member: Member, nextRole: string): Promise<void> {
    await mutate(async () => {
      await api.patch(`/team/members/${member.id}/role`, { role: nextRole });
      if (member.user.id === user.id) window.location.reload();
    }, 'Perfil atualizado.');
  }

  return (
    <div lang="pt-BR">
      <PageHeader title="Sua equipe" description="As pessoas que transformam descobertas em resultados, juntas." />
      {error && <p role="alert" className="mb-5 rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="mb-5 text-sm text-green-800">{notice}</p>}
      {!team ? <p role="status" className="text-muted-foreground">{error ? 'Recarregue a página para tentar novamente.' : 'Carregando sua equipe…'}</p> : <>
        <div className="mb-8 flex flex-wrap gap-x-8 gap-y-3 border-y border-border py-4 text-sm">
          <p><strong>{team.members.length} de {team.userLimit}</strong> usuários registrados</p>
          <p><strong>{admins} de {team.adminLimit}</strong> administradores</p>
          <p className="text-muted-foreground">{team.invitations.length} convite(s) reservando vagas</p>
        </div>
        {admin ? (
          <section className="mb-10 rounded-xl bg-muted/50 p-5 sm:p-6" aria-labelledby="invite-title">
            <h2 id="invite-title" className="text-xl font-semibold tracking-tight">Convide alguém para sua equipe</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">O convite é exclusivo para e-mails <strong className="break-all text-foreground">@{team.domain}</strong>, vale por 7 dias e pode ser usado uma vez.</p>
            <form onSubmit={invite} className="mt-5 grid gap-4 sm:grid-cols-2">
              <div><label htmlFor="team-name" className="mb-2 block text-sm font-medium">Nome da pessoa</label><input id="team-name" name="name" autoComplete="name" maxLength={120} required disabled={busy || full} className={inputClass} /></div>
              <div><label htmlFor="team-email" className="mb-2 block text-sm font-medium">E-mail profissional</label><input id="team-email" name="email" type="email" autoComplete="email" maxLength={254} required disabled={busy || full} placeholder={`pessoa@${team.domain}`} className={inputClass} /></div>
              <div><label htmlFor="team-role" className="mb-2 block text-sm font-medium">Perfil de acesso</label><select id="team-role" value={role} onChange={(event) => setRole(event.target.value as UserRole)} disabled={busy || full} className={inputClass}>
                <option value="viewer">Visualizador</option><option value="editor">Editor</option><option value="admin" disabled={adminsFull}>Administrador</option>
              </select></div>
              <div className="flex items-end"><Button type="submit" className="h-11 w-full sm:w-auto" disabled={busy || full || (role === 'admin' && adminsFull)}>{busy ? 'Salvando…' : 'Gerar link de convite'}</Button></div>
            </form>
            {full && <p className="mt-3 text-sm text-amber-900">Todas as vagas estão ocupadas ou reservadas. Revogue um convite pendente para liberar uma vaga.</p>}
            {adminsFull && <p className="mt-3 text-sm text-slate-600">As 3 vagas de administrador estão ocupadas ou reservadas.</p>}
            {link && <div className="mt-6 border-t border-border pt-5">
              <label htmlFor="generated-invite" className="block text-sm font-medium">Link pronto para enviar</label>
              <p className="mt-1 text-sm text-slate-600">Copie agora e envie apenas à pessoa convidada. O link completo não será exibido novamente após sair da página.</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row"><input id="generated-invite" readOnly value={link} onFocus={(event) => event.target.select()} className={`${inputClass} min-w-0 sm:flex-1`} /><Button type="button" variant="outline" className="h-11" onClick={copy}>{copied ? 'Copiado' : 'Copiar link'}</Button></div>
              {copied && <p role="status" className="mt-2 text-sm text-green-800">Link copiado.</p>}
            </div>}
          </section>
        ) : <p className="mb-8 text-sm text-muted-foreground">Você pode consultar esta área. Apenas administradores podem convidar pessoas e alterar perfis.</p>}
        <section aria-labelledby="members-title">
          <h2 id="members-title" className="text-xl font-semibold">Pessoas no workspace</h2>
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {team.members.map((member) => <li key={member.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0"><p className="break-words font-medium">{member.user.name ?? member.user.email}{member.user.id === user.id && <span className="ml-2 text-xs text-muted-foreground">Você</span>}</p><p className="mt-1 break-all text-sm text-muted-foreground">{member.user.email}</p></div>
              {admin ? <select aria-label={`Perfil de ${member.user.name ?? member.user.email}`} value={member.role} disabled={busy} className={`${inputClass} sm:w-44`} onChange={(event) => { void changeRole(member, event.target.value); }}>
                <option value="viewer" disabled={member.role === 'admin' && admins <= 1}>Visualizador</option><option value="editor" disabled={member.role === 'admin' && admins <= 1}>Editor</option><option value="admin" disabled={member.role !== 'admin' && adminsFull}>Administrador</option>
              </select> : <span className="text-sm">{roleLabels[member.role]}</span>}
            </li>)}
          </ul>
        </section>
        <section className="mt-10" aria-labelledby="pending-title">
          <h2 id="pending-title" className="text-xl font-semibold">Convites pendentes</h2>
          {!team.invitations.length ? <p className="mt-3 text-sm text-muted-foreground">Nenhum convite pendente. Os próximos convites aparecerão aqui.</p> : <ul className="mt-4 divide-y divide-border border-y border-border">{team.invitations.map((invitation) => <li key={invitation.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0"><p className="break-words font-medium">{invitation.name}</p><p className="mt-1 break-all text-sm text-muted-foreground">{invitation.email}</p><p className="mt-1 text-xs text-muted-foreground">{roleLabels[invitation.role]} · Expira em {new Date(invitation.expiresAt).toLocaleDateString('pt-BR')}</p></div>
            {admin && <Button variant="outline" disabled={busy} onClick={() => { void mutate(() => api.del(`/team/invitations/${invitation.id}`), 'Convite revogado.'); if (link.includes(encodeURIComponent(invitation.email))) setLink(''); }}>Revogar convite</Button>}
          </li>)}</ul>}
        </section>
        <dl className="mt-10 grid gap-4 border-t border-border pt-6 text-sm sm:grid-cols-3">
          <div><dt className="font-medium">Administrador</dt><dd className="mt-1 leading-relaxed text-muted-foreground">Gerencia usuários, convites e perfis. Acesso completo ao cliente.</dd></div>
          <div><dt className="font-medium">Editor</dt><dd className="mt-1 leading-relaxed text-muted-foreground">Edita o conteúdo e aprova experimentos. Consulta as configurações administrativas.</dd></div>
          <div><dt className="font-medium">Visualizador</dt><dd className="mt-1 leading-relaxed text-muted-foreground">Consulta os resultados. Não faz alterações e não acessa áreas administrativas.</dd></div>
        </dl>
      </>}
    </div>
  );
}
