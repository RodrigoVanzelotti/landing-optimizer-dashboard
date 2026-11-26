'use client';

import { toast } from '@/components/ui/toast';

import type * as React from 'react';
import { useSession } from '@/lib/session';
import { canEdit } from '@/lib/permissions';
import { useCallback, useEffect, useId, useState } from 'react';
import Link from 'next/link';

import { api, type ConversionGoal } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/card';
import { ExperimentStatus } from '@/components/experiment-status';
import { ExperimentResultSummary } from '@/components/experiment-result-summary';
import { Button } from '@/components/ui/button';
import { DataState } from '@/components/data-state';
import { experimentTypeLabels, changeOpLabels, experimentExpiry } from '@/lib/experiments';
import { goalKindLabels } from '@/lib/goals';
import { userErrorMessage } from '@/lib/errors';


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
  createdAt: string;
  expiresAt?: string | null;
  expired?: boolean;
  startedAt?: string | null;
  resultState?: 'pending_validation' | 'ready';
  siteId: string;
  insightId?: string | null;
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

const REVIEW_ACTIONS = [{ label: 'Aprovar e iniciar', action: 'approve' }, { label: 'Negar', action: 'reject', variant: 'destructive' as const }];
const actionDescriptions: Record<string, string> = {
  approve: 'Aprova e inicia o experimento em uma ação. A mudança proposta será publicada para parte dos visitantes.',
  reject: 'Recusa a mudança proposta e move o experimento para Negados, sem iniciar o teste.',
  start: 'Inicia o experimento e passa a exibir a mudança proposta para parte dos visitantes.',
  pause: 'Pausa a exibição do experimento. Ele poderá ser retomado depois.',
  rollback: 'Descarta a mudança proposta, restaura a versão de referência e move o experimento para Negados.',
  accept: 'Mantém a mudança escolhida para 100% dos visitantes elegíveis deste site e move o experimento para Mudanças aceitas.',
};
const ACTIONS: Record<string, { label: string; action: string; variant?: 'destructive' | 'outline' }[]> = {
  draft: REVIEW_ACTIONS,
  ai_suggested: REVIEW_ACTIONS,
  pending_review: REVIEW_ACTIONS,
  approved: [{ label: 'Iniciar', action: 'start' }, { label: 'Negar', action: 'reject', variant: 'destructive' }],
  scheduled: [{ label: 'Iniciar agora', action: 'start' }, { label: 'Negar', action: 'reject', variant: 'destructive' }],
  running: [
    { label: 'Pausar', action: 'pause', variant: 'outline' },
    { label: 'Rejeitar experimento', action: 'rollback', variant: 'destructive' },
  ],
  paused: [
    { label: 'Retomar', action: 'start' },
    { label: 'Rejeitar experimento', action: 'rollback', variant: 'destructive' },
  ],
  completed: [{ label: 'Manter mudança', action: 'accept' }, { label: 'Reverter mudança', action: 'rollback', variant: 'destructive' }],
  accepted: [{ label: 'Reverter mudança', action: 'rollback', variant: 'destructive' }],
};

export function ExperimentDetail({ id, siteId, onChanged }: { id: string; siteId: string; onChanged: () => void }): React.ReactElement {
  const goalInputId = useId();
  const editable = canEdit(useSession().role);
  const [exp, setExp] = useState<ExperimentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [goals, setGoals] = useState<ConversionGoal[] | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [acceptedVariant, setAcceptedVariant] = useState('');

  const load = useCallback(async () => {
    setError(null);
    const detail = await api.get<ExperimentDetail>(`/experiments/${id}`);
    if (detail.siteId !== siteId) throw new Error('Este experimento pertence a outro site. Selecione o site correspondente no topo da página.');
    setExp(detail);
    try { setGoals(await api.get<ConversionGoal[]>(`/sites/${detail.siteId}/goals`)); }
    catch { setGoals(null); setError('Não foi possível carregar as metas. Tente novamente antes de alterá-las.'); }
  }, [id, siteId]);

  useEffect(() => { void load().catch(error => setError(userErrorMessage(error))); }, [load]);
  const refreshFromReport = useCallback(() => { void load().then(onChanged).catch(error => setError(userErrorMessage(error))); }, [load, onChanged]);

  async function run(action: string): Promise<void> {
    if (busy || !editable || !exp || !actions.some(item => item.action === action) || (action === 'accept' && !chosenVariant)) return;
    setBusy(true);
    setError(null);
    try {
      const body = action === 'accept' ? { variantId: chosenVariant } :
        action === 'reject'
          ? { reason: 'Rejeitado na revisão' }
          : action === 'approve'
            ? { reason: 'Aprovado na revisão', checklist: { privacy: true, brand: true } }
            : undefined;
      if (action === 'approve' && ['draft', 'ai_suggested'].includes(exp.status)) {
        await api.post(`/experiments/${id}/submit`);
        setExp(current => current ? { ...current, status: 'pending_review' } : current);
      }
      await api.post(`/experiments/${id}/${action}`, body);
      if (action === 'approve') {
        setExp(current => current ? { ...current, status: 'approved' } : current);
        await api.post(`/experiments/${id}/start`);
      }
      setPendingAction(null);
      await load();
      onChanged();
    } catch (e) {
      let message = userErrorMessage(e);
      try { await load(); }
      catch { message += ' Não foi possível atualizar o estado. Recarregue a proposta antes de tentar novamente.'; }
      toast.error(message);
      onChanged();
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
    try {
      await api.patch(`/experiments/${id}`, { primaryGoalId: goalId || null });
      toast.success('Meta principal salva.');
      await load();
    } catch (e) { toast.error(userErrorMessage(e)); }
    finally { setBusy(false); }
  }

  if (error && !exp) return <DataState error title="Não foi possível abrir o experimento" description="Tente novamente para consultar a proposta." onRetry={() => { void load().catch(error => setError(userErrorMessage(error))); }} />;
  if (!exp) return <DataState loading title="Carregando proposta e variantes…" />;

  const expires = experimentExpiry(exp);
  const expired = exp.expired || (expires !== null && expires <= Date.now());
  const actions = editable && !expired && exp.resultState !== 'pending_validation' ? ACTIONS[exp.status] ?? [] : [];
  const proposals = exp.variants.filter(variant => !variant.isControl);
  const chosenVariant = proposals.length === 1 ? proposals[0].id : proposals.some(variant => variant.id === acceptedVariant) ? acceptedVariant : '';

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3"><h2 className="min-w-0 break-words text-xl font-semibold">{exp.name}</h2><div role="status" aria-label="Estado do experimento" className="ml-auto"><ExperimentStatus experiment={exp} /></div></header>
      {['running', 'paused', 'completed', 'accepted', 'rolled_back', 'killed'].includes(exp.status) && <ExperimentResultSummary key={`${id}-${exp.status}`} id={id} siteId={siteId} status={exp.status} onStateChanged={refreshFromReport} />}
      {exp.resultState === 'pending_validation' && <p role="status" className="mb-4 text-sm text-muted-foreground">Este encerramento está sendo verificado. Se não houver evidência suficiente, o experimento ficará pausado para uma nova coleta.</p>}
      <section aria-label="Hipótese" className="mb-6">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0"><path d="M9 18h6m-5 3h4M9 15c0-2-4-3-4-7a7 7 0 0 1 14 0c0 4-4 5-4 7v1H9z" /></svg>Hipótese</h3>
        <p className="mt-2 break-words text-sm leading-relaxed text-muted-foreground">{exp.hypothesis || 'Hipótese não informada para este experimento.'}</p>
      </section>
      <div className="mb-6 grid gap-3">
        {exp.variants.filter(v => !v.isControl).map((v) => (
          <Card key={v.id} className="shadow-none">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0"><circle cx="11" cy="13" r="9" /><circle cx="11" cy="13" r="5" /><path d="m11 13 9-9m-4 0h4v4" /></svg>
                Mudança proposta
              </CardTitle>
            </div>
            {v.changes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma mudança foi detalhada para esta proposta.</p>
            ) : (
              <ul className="space-y-2">
                {v.changes.map((c) => (
                  <li key={c.id} className="rounded border border-border p-3 text-sm">
                    <p className="break-all font-mono text-xs text-muted-foreground">
                      {changeOpLabels[c.op] ?? 'Alteração'} · {c.selector}
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
      {expired && <p role="status" className="mb-4 text-sm">Esta proposta venceu após 7 dias sem iniciar. Ela foi preservada para consulta. Aprove um novo insight para receber experimentos atuais.</p>}
      {exp.insightId && <p className="mb-4 text-sm">Origem: <Link href={`/insights?insight=${encodeURIComponent(exp.insightId)}`} className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">ver insight de IA de origem</Link></p>}

      {editable && exp.status === 'completed' && proposals.length > 1 && <div className="mb-4"><label htmlFor={`${goalInputId}-proposal`} className="mb-2 block text-sm font-medium">Mudança a manter</label><select id={`${goalInputId}-proposal`} value={acceptedVariant} onChange={event => setAcceptedVariant(event.target.value)} disabled={busy} className="min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm"><option value="">Escolha uma mudança proposta</option>{proposals.map((variant, index) => <option key={variant.id} value={variant.id}>Mudança proposta {index + 1}</option>)}</select></div>}
      <div className="mb-4 flex flex-wrap gap-2">
        {actions.map((a) => (
          <Button key={a.action} id={`${goalInputId}-${a.action}`} className="h-11" variant={a.variant} disabled={busy || (a.action === 'accept' && !chosenVariant)} aria-busy={busy} title={actionDescriptions[a.action]} aria-description={actionDescriptions[a.action]} onClick={() => {
            if (['reject', 'rollback', 'accept'].includes(a.action)) setPendingAction(a.action);
            else void run(a.action);
          }}>
            {busy ? 'Processando…' : a.label}
          </Button>
        ))}
      </div>
      {pendingAction && actions.some(item => item.action === pendingAction) && <section aria-labelledby={`${goalInputId}-confirmation`} className="mb-4 rounded-md border border-border bg-muted/40 p-4">
        <h3 id={`${goalInputId}-confirmation`} className="text-sm font-semibold">{pendingAction === 'accept' ? 'Manter esta mudança para todos os visitantes elegíveis?' : pendingAction === 'reject' ? 'Negar este experimento?' : 'Descartar a mudança proposta?'}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{actionDescriptions[pendingAction]}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button autoFocus variant="outline" className="h-11" disabled={busy} onClick={() => { setPendingAction(null); document.getElementById(`${goalInputId}-${pendingAction}`)?.focus(); }}>Cancelar</Button>
          <Button variant={pendingAction === 'accept' ? 'default' : 'destructive'} className="h-11" disabled={busy} aria-busy={busy} onClick={() => { void run(pendingAction); }}>{busy ? 'Confirmando…' : 'Confirmar ação'}</Button>
        </div>
      </section>}
      {error ? <div role="alert" className="mb-4 text-sm"><p>{error}</p><Button variant="outline" className="mt-3 h-11" disabled={busy} onClick={() => { void load().catch(error => setError(userErrorMessage(error))); }}>Recarregar proposta</Button></div> : null}

      <Card className="mb-4 shadow-none">
        <CardTitle>Detalhes</CardTitle>
        <dl className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Tipo</dt>
            <dd>{experimentTypeLabels[exp.type] ?? 'Outro tipo'}</dd>
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
        {editable && !expired && ['draft', 'ai_suggested'].includes(exp.status) ? (
          <form onSubmit={saveGoal} className="mt-3 flex flex-wrap items-end gap-3">
            <div className="flex min-w-0 flex-1 basis-60 flex-col gap-1">
              <label htmlFor={goalInputId} className="text-sm">Meta</label>
              <select id={goalInputId} name="primaryGoalId" key={exp.primaryGoalId ?? 'all'} defaultValue={exp.primaryGoalId ?? ''}
                disabled={busy || goals === null} className="min-h-11 w-full min-w-0 rounded-md border border-border bg-transparent px-3 py-2 text-sm">
                <option value="">Todas as metas de conversão</option>
                {(goals ?? []).map(goal => <option key={goal.id} value={goal.id}>{goal.name} ({goalKindLabels[goal.kind]})</option>)}
              </select>
            </div>
            <Button type="submit" disabled={busy || goals === null}>Salvar meta principal</Button>
          </form>
        ) : <p className="mt-3 break-words text-sm">{exp.primaryGoalId ? goals?.find(goal => goal.id === exp.primaryGoalId)?.name ?? exp.primaryGoalId : 'Todas as metas de conversão'}. Alterações ficam disponíveis antes da revisão.</p>}
        {goals?.length === 0 ? <p className="mt-2 text-sm">Cadastre metas de conversão na página de instalação do site.</p> : null}
      </Card>
    </div>
  );
}
