'use client';

import type * as React from 'react';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiRequestError, ensureSession, setUnauthorizedHandler } from '@/lib/api';
import { canViewRoute, type SessionUser } from '@/lib/permissions';
import { SessionContext } from '@/lib/session';
import { Button } from '@/components/ui/button';

export function AuthGuard({ children }: { children: React.ReactNode }): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let pending = false;
    setUnauthorizedHandler(() => { if (active) { setUser(null); setError(false); router.replace('/login'); } });
    async function load(): Promise<void> {
      if (pending || !active) return;
      pending = true;
      try {
        if (!(await ensureSession())) { if (active) { setUser(null); setError(false); router.replace('/login'); } return; }
        if (!active) return;
        const current = await api.get<SessionUser>('/auth/me');
        if (active) { setUser(current); setError(false); }
      } catch (err) {
        if (active && !(err instanceof ApiRequestError && err.status === 401)) setError(true);
      } finally { pending = false; }
    }
    void load();
    window.addEventListener('focus', load);
    window.addEventListener('online', load);
    return () => {
      active = false;
      window.removeEventListener('focus', load);
      window.removeEventListener('online', load);
      setUnauthorizedHandler(null);
    };
  }, [router, pathname, attempt]);

  const recovery = (
    <div role="alert" className="flex flex-wrap items-center gap-3 p-5 text-sm sm:px-8">
      <p>Não foi possível verificar sua sessão. Confira sua conexão e tente novamente.</p>
      <Button variant="outline" onClick={() => setAttempt((value) => value + 1)}>Tentar novamente</Button>
    </div>
  );
  if (!user) return error ? recovery : <p role="status" className="p-8 text-sm text-muted-foreground">Verificando seu acesso…</p>;
  if (!canViewRoute(user.role, pathname, user.platformOwner)) return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="text-2xl font-semibold">Área administrativa</h1>
      <p className="mt-3 text-muted-foreground">Sua conta não tem acesso a esta página.</p>
      <Link href="/overview" className="mt-5 inline-block text-primary underline underline-offset-4">Voltar para a visão geral</Link>
    </main>
  );
  return <SessionContext.Provider value={user}>{error ? recovery : null}{children}</SessionContext.Provider>;
}
