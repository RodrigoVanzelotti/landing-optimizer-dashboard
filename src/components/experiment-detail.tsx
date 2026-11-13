'use client';

import type * as React from 'react';
import { useSession } from '@/lib/session';
import { canEdit } from '@/lib/permissions';
import { useCallback, useEffect, useState } from 'react';

import { api, type ConversionGoal } from '@/lib/api';
import { Card, CardTitle, Badge } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataState } from '@/components/data-state';
import { experimentStatusLabels } from '@/lib/experiments';


interface Change {
  id: string;
  selector: string;
  op: string;
  originalValue: string | null;
  proposedValue: string | null;
}
interface Variant {
  id: string;
  name: string;
  isControl: boolean;
  weight: number;
  changes: Change[];
}
interface ExperimentDetail {
  siteId: string;
  primaryGoalId: string | null;
  id: string;
  name: string;
  hypothesis: string | null;
  status: string;
  type: string;
  riskScore: number;
  allocation: number;
  variants: Variant[];
}

/** Lifecycle actions available per status (mirrors the API state machine). */
const ACTIONS: Record<string, { label: string; action: string; variant?: 'destructive' | 'outline' }[]> = {
  draft: [{ label: 'Enviar para revisão', action: 'submit' }],
  ai_suggested: [{ label: 'Enviar para revisão', action: 'submit' }],
  pending_review: [
    { label: 'Aprovar', action: 'approve' },
    { label: 'Rejeitar', action: 'reject', variant: 'destructive' },
  ],
  approved: [{ label: 'Iniciar', action: 'start' }],
  scheduled: [{ label: 'Iniciar agora', action: 'start' }],
  running: [
    { label: 'Pausar', action: 'pause', variant: 'outline' },
    { label: 'Concluir', action: 'complete' },
    { label: 'Reverter', action: 'rollback', variant: 'destructive' },
    { label: 'Interromper imediatamente', action: 'kill', variant: 'destructive' },
  ],
  paused: [
    { label: 'Retomar', action: 'start' },
    { label: 'Reverter', action: 'rollback', variant: 'destructive' },
  ],
  completed: [{ label: 'Reverter', action: 'rollback', variant: 'destructive' }],
};

export function ExperimentDetail({ id, onChanged }: { id: string; onChanged: () => void }): React.ReactElement {
  const editable = canEdit(useSession().role);
  const [exp, setExp] = useState<ExperimentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [goals, setGoals] = useState<ConversionGoal[] | null>(null);
  const [goalNotice, setGoalNotice] = useState('');

  const load = useCallback(async () => {
    setError(null);
    const detail = await api.get<ExperimentDetail>(`/experiments/${id}`);
    setExp(detail);
    try { setGoals(await api.get<ConversionGoal[]>(`/sites/${detail.siteId}/goals`)); }
    catch { setGoals(null); setError('Não foi possível carregar as metas. Tente novamente antes de alterá-las.'); }
  }, [id]);

  useEffect(() => { void load().catch((e: Error) => setError(e.message)); }, [load]);

  async function run(action: string): Promise<void> {
    if (busy) return;
    if (['reject', 'rollback', 'kill', 'complete'].includes(action) && !window.confirm('Confirmar esta ação no experimento? Ela pode alterar a experiência publicada ou encerrar o teste.')) return;
    setBusy(true);
    setError(null);
    try {
      const body =
        action === 'reject'
          ? { reason: 'Rejected from review' }
          : action === 'approve'
            ? { reason: 'Approved from review', checklist: { privacy: true, brand: true } }
            : undefined;
      await api.post(`/experiments/${id}/${action}`, body);
      onChanged();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveGoal(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) return;
    const goalId = String(new FormData(event.currentTarget).get('primaryGoalId') || '');
    setBusy(true);
    setError(null);
    setGoalNotice('');
    try {
      await api.patch(`/experiments/${id}`, { primaryGoalId: goalId || null });
      setGoalNotice('Meta principal salva.');
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  if (error && !exp) return <DataState error title="Não foi possível abrir o experimento" description="Tente novamente para consultar a proposta." onRetry={() => { void load().catch((e: Error) => setError(e.message)); }} />;
  if (!exp) return <DataState loading title="Carregando proposta e variantes…" />;

  const actions = editable ? ACTIONS[exp.status] ?? [] : [];

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words text-xl font-semibold">{exp.name}</h2>{exp.hypothesis && <p className="mt-2 break-words text-sm text-muted-foreground">{exp.hypothesis}</p>}</div><Badge>{experimentStatusLabels[exp.status] ?? exp.status}</Badge></header>

      <div className="mb-4 flex flex-wrap gap-2">
        {actions.map((a) => (
          <Button key={a.action} className="h-11" variant={a.variant} disabled={busy} aria-busy={busy} onClick={() => run(a.action)}>
            {a.label}
          </Button>
        ))}
      </div>
      {error ? <div role="alert" className="mb-4 text-sm"><p>{error}</p><Button variant="outline" className="mt-3 h-11" disabled={busy} onClick={() => { void load().catch((e: Error) => setError(e.message)); }}>Recarregar proposta</Button></div> : null}

      <Card className="mb-4 shadow-none">
        <CardTitle>Detalhes</CardTitle>
        <dl className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Tipo</dt>
            <dd>{exp.type}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Pontuação de risco</dt>
            <dd>{exp.riskScore}/100</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Alocação de tráfego</dt>
            <dd>{Math.round(exp.allocation * 100)}%</dd>
          </div>
        </dl>
      </Card>

      <Card className="mb-4 shadow-none">
        <CardTitle>Meta de conversão principal</CardTitle>
        <p className="mt-2 text-sm text-muted-foreground">
          Os resultados contam cada sessão uma vez por variante após a exposição, para a meta selecionada.
          Sem uma meta principal, os resultados incluem todas as metas de conversão.
        </p>
        {editable && ['draft', 'ai_suggested'].includes(exp.status) ? (
          <form onSubmit={saveGoal} className="mt-3 flex flex-wrap items-end gap-3">
            <div className="flex min-w-0 flex-1 basis-60 flex-col gap-1">
              <label htmlFor="primary-goal" className="text-sm">Meta</label>
              <select id="primary-goal" name="primaryGoalId" key={exp.primaryGoalId ?? 'all'} defaultValue={exp.primaryGoalId ?? ''}
                disabled={busy || goals === null} className="min-h-11 w-full min-w-0 rounded-md border border-border bg-transparent px-3 py-2 text-sm">
                <option value="">Todas as metas de conversão</option>
                {(goals ?? []).map(goal => <option key={goal.id} value={goal.id}>{goal.name} ({goal.kind})</option>)}
              </select>
            </div>
            <Button type="submit" disabled={busy || goals === null}>Salvar meta principal</Button>
          </form>
        ) : <p className="mt-3 break-words text-sm">{exp.primaryGoalId ? goals?.find(goal => goal.id === exp.primaryGoalId)?.name ?? exp.primaryGoalId : 'Todas as metas de conversão'}. Alterações ficam disponíveis antes da revisão.</p>}
        {goals?.length === 0 ? <p className="mt-2 text-sm">Cadastre metas de conversão na página de instalação do site.</p> : null}
        <p role="status" className="mt-2 text-sm">{goalNotice}</p>
      </Card>

      <div className="grid gap-3">
        {exp.variants.map((v) => (
          <Card key={v.id} className="shadow-none">
            <div className="mb-2 flex items-center justify-between">
              <CardTitle>
                {v.name} {v.isControl ? '(controle)' : ''}
              </CardTitle>
              <span className="text-xs text-muted-foreground">peso {v.weight}</span>
            </div>
            {v.changes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem alterações: esta é a referência do teste.</p>
            ) : (
              <ul className="space-y-2">
                {v.changes.map((c) => (
                  <li key={c.id} className="rounded border border-border p-3 text-sm">
                    <p className="break-all font-mono text-xs text-muted-foreground">
                      {c.op} · {c.selector}
                    </p>
                    {c.originalValue ? (
                      <p className="mt-1 break-words line-through opacity-60">{c.originalValue}</p>
                    ) : null}
                    {c.proposedValue ? <p className="mt-0.5 break-words">{c.proposedValue}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
