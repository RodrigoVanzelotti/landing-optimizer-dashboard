'use client';

import type * as React from 'react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, setAccessToken } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';

export default function LoginPage(): React.ReactElement {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const path = mode === 'login' ? '/auth/login' : '/auth/register';
      const body =
        mode === 'login' ? { email, password } : { email, password, tenantName };
      const res = await api.post<{ accessToken: string }>(path, body);
      setAccessToken(res.accessToken);
      router.push('/overview');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardTitle className="text-base text-foreground">
          {mode === 'login' ? 'Sign in' : 'Create your workspace'}
        </CardTitle>
        <form onSubmit={submit} className="mt-4 space-y-3">
          {mode === 'register' ? (
            <input
              className="h-9 w-full rounded-md border border-border px-3 text-sm"
              placeholder="Workspace name"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              required
            />
          ) : null}
          <input
            className="h-9 w-full rounded-md border border-border px-3 text-sm"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="h-9 w-full rounded-md border border-border px-3 text-sm"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === 'register' ? 10 : 1}
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? '…' : mode === 'login' ? 'Sign in' : 'Create workspace'}
          </Button>
        </form>
        <button
          className="mt-3 text-xs text-muted-foreground hover:underline"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login' ? 'Need an account? Register' : 'Have an account? Sign in'}
        </button>
      </Card>
    </div>
  );
}
