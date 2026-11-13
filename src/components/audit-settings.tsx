'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { DataState } from '@/components/data-state';

interface AuditRow { id: string; action: string; targetType: string; targetId: string; createdAt: string }
export function AuditSettings() {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false); setRows(null);
    api.get<AuditRow[]>('/audit').then(data => { if (active) setRows(data); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [attempt]);
  return <section><h2 className="text-xl font-semibold">Registro de atividades</h2><p className="mb-5 mt-2 text-sm text-muted-foreground">Histórico das ações administrativas realizadas neste workspace.</p>
    {error ? <DataState error title="Não foi possível carregar o histórico" description="Confira sua conexão e tente novamente." onRetry={() => setAttempt(n => n + 1)} />
      : !rows ? <DataState loading title="Carregando atividades…" />
      : !rows.length ? <DataState title="O histórico começa com a primeira ação" description="Alterações administrativas serão registradas aqui automaticamente para você acompanhar o que aconteceu no workspace." />
      : <ul className="divide-y divide-border border-y border-border text-sm">{rows.map(row => <li key={row.id} className="flex flex-col justify-between gap-2 py-4 sm:flex-row"><div className="min-w-0"><p className="break-all font-medium">{row.action}</p><p className="mt-1 break-all text-muted-foreground">{row.targetType}: {row.targetId}</p></div><time className="shrink-0 text-xs text-muted-foreground" dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleString('pt-BR')}</time></li>)}</ul>}
  </section>;
}
