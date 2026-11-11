'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiRequestError, setAccessToken } from '@/lib/api';
import { Button } from '@/components/ui/button';

export function ResetPasswordForm(): React.ReactElement {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => { const value = window.location.hash.slice(1); setToken(/^[a-f0-9]{64}$/.test(value) ? value : ''); }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    if (data.get('password') !== data.get('confirmation')) { setError('As senhas precisam ser iguais.'); return; }
    setBusy(true); setError(null);
    try {
      await api.post('/auth/reset-password', { token, password: data.get('password') });
      setAccessToken(null); setDone(true);
      window.history.replaceState(null, '', window.location.pathname);
    } catch (err) { setError(err instanceof ApiRequestError && err.status === 403 ? 'Este link expirou ou já foi usado. Solicite um novo link.' : 'Não foi possível redefinir a senha. Tente novamente.'); }
    finally { setBusy(false); }
  }

  if (done) return <div className="mt-7"><p role="status" className="text-sm text-green-800">Senha redefinida. Entre com sua nova senha.</p><Link href="/login" className="mt-5 inline-block font-medium text-primary underline underline-offset-4">Entrar na conta</Link></div>;
  if (token === null) return <p role="status" className="mt-7 text-sm text-muted-foreground">Verificando o link…</p>;
  if (!token) return <p role="alert" className="mt-7 text-sm text-red-700">Este link está incompleto. Solicite um novo link de redefinição.</p>;
  return <form onSubmit={submit} className="mt-7 space-y-5" aria-busy={busy}>
    <div><label htmlFor="reset-password" className="block text-sm font-medium">Nova senha</label><input id="reset-password" name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={200} disabled={busy} className="mt-2 h-11 w-full rounded-md border border-border px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" /></div>
    <div><label htmlFor="reset-confirmation" className="block text-sm font-medium">Confirme a nova senha</label><input id="reset-confirmation" name="confirmation" type="password" autoComplete="new-password" required minLength={10} maxLength={200} disabled={busy} className="mt-2 h-11 w-full rounded-md border border-border px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" /></div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <Button disabled={busy} className="h-11 w-full">{busy ? 'Salvando…' : 'Salvar nova senha'}</Button>
  </form>;
}
