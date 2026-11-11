'use client';

import type * as React from 'react';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ensureSession, setUnauthorizedHandler } from '@/lib/api';
import { canViewRoute, type SessionUser } from '@/lib/permissions';
import { SessionContext } from '@/lib/session';

export function AuthGuard({ children }: { children: React.ReactNode }): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setUnauthorizedHandler(() => { setUser(null); router.replace('/login'); });
    async function load(): Promise<void> {
      try {
        if (!(await ensureSession())) { if (active) router.replace('/login'); return; }
        const current = await api.get<SessionUser>('/auth/me');
        if (active) { setUser(current); setError(false); }
      } catch { if (active) setError(true); }
    }
    void load();
    window.addEventListener('focus', load);
    return () => { active = false; window.removeEventListener('focus', load); setUnauthorizedHandler(null); };
  }, [router, pathname]);

  if (error) return <p role="alert" className="p-8">Não foi possível verificar seu acesso. Recarregue a página para tentar novamente.</p>;
  if (!user) return <p role="status" className="p-8 text-sm text-muted-foreground">Verificando seu acesso…</p>;
  if (!canViewRoute(user.role, pathname, user.platformOwner)) return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="text-2xl font-semibold">Área administrativa</h1>
      <p className="mt-3 text-muted-foreground">Sua conta não tem acesso a esta página.</p>
      <Link href="/overview" className="mt-5 inline-block text-primary underline underline-offset-4">Voltar para a visão geral</Link>
    </main>
  );
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}
