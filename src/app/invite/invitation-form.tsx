'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiRequestError, setAccessToken } from '@/lib/api';
import { Button } from '@/components/ui/button';

const inputClass = 'mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60';

export function InvitationForm({ name, email }: { name: string; email: string }): React.ReactElement {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    const credential = window.location.hash.slice(1);
    setToken(/^[a-f0-9]{64}$/.test(credential) ? credential : '');
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    if (data.get('password') !== data.get('confirmation')) {
      setError('As senhas precisam ser iguais. Confira e tente novamente.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<{ accessToken: string }>('/auth/register', {
        token, name, email, password: data.get('password'),
      });
      setAccessToken(result.accessToken);
      router.replace('/overview');
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 403) {
        setError('Este convite está inválido, expirado ou foi revogado. Peça um novo link ao administrador.');
      } else if (err instanceof ApiRequestError && err.status === 409) {
        setError('Este e-mail já tem uma conta. Use o link abaixo para entrar.');
      } else {
        setError('Não foi possível criar sua conta. Confira os dados e tente novamente.');
      }
    } finally {
      setBusy(false);
    }
  }

  if (token === null) return <p role="status" className="mt-8 text-sm text-muted-foreground">Preparando seu convite…</p>;
  if (!token) return <p role="alert" className="mt-8 text-sm text-red-700">Este link não contém a chave do convite. Peça ao administrador o link completo.</p>;

  return (
    <form onSubmit={submit} className="mt-8 space-y-5" aria-busy={busy}>
      <div>
        <label htmlFor="invite-email" className="text-sm font-medium">Seu e-mail de acesso</label>
        <input id="invite-email" type="email" value={email} readOnly autoComplete="email" className={`${inputClass} bg-muted/50 text-slate-600`} aria-describedby="email-note" />
        <p id="email-note" className="mt-2 text-xs leading-relaxed text-muted-foreground">O cadastro será feito com o e-mail deste convite.</p>
      </div>
      <div>
        <label htmlFor="invite-password" className="text-sm font-medium">Crie sua senha</label>
        <input id="invite-password" name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={200} disabled={busy} className={inputClass} aria-describedby="password-note" />
        <p id="password-note" className="mt-2 text-xs text-muted-foreground">Use pelo menos 10 caracteres.</p>
      </div>
      <div>
        <label htmlFor="invite-confirmation" className="text-sm font-medium">Confirme sua senha</label>
        <input id="invite-confirmation" name="confirmation" type="password" autoComplete="new-password" required minLength={10} maxLength={200} disabled={busy} className={inputClass} />
      </div>
      {error && <p role="alert" className="text-sm leading-relaxed text-red-700">{error}</p>}
      <Button type="submit" disabled={busy} className="h-12 w-full">{busy ? 'Preparando seu acesso…' : 'Aceitar convite e criar conta'}</Button>
      <p className="text-center text-sm text-muted-foreground">Já aceitou seu convite? <Link href="/login" className="font-medium text-primary underline underline-offset-4">Entrar na conta</Link></p>
    </form>
  );
}
