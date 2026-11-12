'use client';

import type * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, setAccessToken } from '@/lib/api';
import { Button } from '@/components/ui/button';

const inputClass = 'h-11 w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

export default function LoginPage(): React.ReactElement {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ accessToken: string }>('/auth/login', { email, password });
      setAccessToken(res.accessToken);
      router.push('/overview');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-muted/40 p-5 selection:bg-primary/15 sm:p-10">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-4 py-3">
          <Link href="/login" className="text-lg font-semibold tracking-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
            Landing<span className="text-primary">Optimizer</span>
          </Link>
          <span lang="pt-BR" className="text-sm text-muted-foreground">Um novo olhar para sua landing page.</span>
        </header>
        <div className="flex flex-1 items-center justify-center py-12 sm:py-16">
          <section aria-labelledby="login-title" className="w-full max-w-md rounded-2xl bg-card p-7 shadow-[0_20px_70px_-25px_rgba(15,23,42,0.18)] sm:p-12">
            <h1 id="login-title" className="text-2xl font-semibold tracking-tight">Sign in</h1>
            <form onSubmit={submit} aria-busy={busy} className="mt-6 space-y-5">
              <div>
                <label htmlFor="login-email" className="mb-2 block text-sm font-medium">Email</label>
                <input
                  id="login-email"
                  autoComplete="email"
                  disabled={busy}
                  className={inputClass}
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="login-password" className="mb-2 block text-sm font-medium">Password</label>
                <input
                  id="login-password"
                  autoComplete="current-password"
                  disabled={busy}
                  className={inputClass}
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={1}
                />
              </div>
              {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
              <Button type="submit" className="h-11 w-full" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </section>
        </div>
        <footer lang="pt-BR" className="text-center text-xs leading-relaxed text-muted-foreground">Landing Optimizer · Um espaço para experimentar, aprender e evoluir.</footer>
      </div>
    </main>
  );
}
