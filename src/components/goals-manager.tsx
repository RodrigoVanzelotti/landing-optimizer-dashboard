'use client';

import type * as React from 'react';
import { useSession } from '@/lib/session';
import { canEdit } from '@/lib/permissions';
import { useCallback, useEffect, useId, useState } from 'react';
import { api, ApiRequestError, type ConversionGoal, type GoalKind } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { goalKindLabels } from '@/lib/goals';

type UrlOp = 'exact' | 'prefix' | 'contains' | 'regex';

const urlOpLabels: Record<string, string> = {
  exact: 'Exatamente igual', prefix: 'Começa com', contains: 'Contém', regex: 'Expressão regular',
};

const inputClass =
  'min-h-11 min-w-0 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

/** Per-site conversion goal management (create, list, delete). */
export function GoalsManager({ siteId }: { siteId: string }): React.ReactElement {
  const editable = canEdit(useSession().role);
  const [goals, setGoals] = useState<ConversionGoal[]>([]);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<GoalKind>('event');
  const [urlOp, setUrlOp] = useState<UrlOp>('exact');
  const [urlPath, setUrlPath] = useState('');
  const [selector, setSelector] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState('');
  const fieldId = useId();

  const load = useCallback(() => {
    api
      .get<ConversionGoal[]>(`/sites/${siteId}/goals`)
      .then(setGoals)
      .finally(() => setLoaded(true))
      .catch((e: Error) => setError(e.message));
  }, [siteId]);

  useEffect(() => {
    load();
  }, [load]);

  async function create(): Promise<void> {
    if (busy) return;
    setError(null);
    setNotice('');
    if (!name.trim()) {
      setError('Informe o nome da meta.');
      return;
    }
    if (kind === 'url' && !urlPath.trim()) {
      setError('Informe o caminho da URL para metas de visita à página.');
      return;
    }
    setBusy(true);
    try {
      const matcher =
        kind === 'url'
          ? { op: urlOp, path: urlPath.trim() }
          : kind === 'form_submit' && selector.trim()
            ? { selector: selector.trim() }
            : undefined;
      await api.post<ConversionGoal>(`/sites/${siteId}/goals`, {
        name: name.trim(),
        kind,
        ...(matcher ? { matcher } : {}),
      });
      setNotice('Meta adicionada. Novos eventos correspondentes serão contados como conversões.');
      setName('');
      setUrlPath('');
      setSelector('');
      load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string): Promise<void> {
    setError(null);
    try {
      await api.del(`/sites/${siteId}/goals/${id}`);
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Card>
      <CardTitle>Metas de conversão</CardTitle>
      <p className="mt-1 text-xs text-muted-foreground">
        Defina o resultado de negócio que deseja medir. Metas de evento exigem uma chamada após a confirmação de sucesso;
        visitas a URLs e envios de formulários nativos são identificados automaticamente pela API.
        Rótulos, por si só, não definem conversões.
      </p>

      {error ? <p role="alert" className="mt-3 text-sm text-red-600">{error}</p> : null}

      <p role="status" className="mt-2 text-sm text-muted-foreground">{notice}</p>

      <div className="mt-4 space-y-2">
        {!loaded ? <p className="text-sm text-muted-foreground">Carregando metas…</p> : error && goals.length === 0 ? null : goals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma meta cadastrada.</p>
        ) : (
          goals.map((g) => {
            const summary = matcherSummary(g);
            return (
              <div
                key={g.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
              >
                <div className="min-w-0 break-words text-sm">
                  <span className="font-medium">{g.name}</span>{' '}
                  <span className="text-muted-foreground">· {goalKindLabels[g.kind]}</span>
                  {summary ? <span className="text-muted-foreground"> · {summary}</span> : null}
                </div>
                {editable && <Button size="sm" variant="destructive" onClick={() => remove(g.id)}>
                  Excluir
                </Button>}
              </div>
            );
          })
        )}
      </div>

      {editable && <form onSubmit={(event) => { event.preventDefault(); void create(); }} className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4">
        <div className="flex min-w-0 flex-1 basis-44 flex-col">
          <label htmlFor={`${fieldId}-name`} className="mb-1 text-xs text-muted-foreground">Nome</label>
          <input id={`${fieldId}-name`}
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="lead_received"
            maxLength={64}
            required
          />
        </div>
        <div className="flex min-w-0 flex-1 basis-44 flex-col">
          <label htmlFor={`${fieldId}-kind`} className="mb-1 text-xs text-muted-foreground">Tipo</label>
          <select id={`${fieldId}-kind`}
            className={inputClass}
            value={kind}
            onChange={(e) => setKind(e.target.value as GoalKind)}
          >
            <option value="event">Evento</option>
            <option value="url">Visita à página</option>
            <option value="form_submit">Envio de formulário</option>
          </select>
        </div>

        {kind === 'url' ? (
          <>
            <div className="flex min-w-0 flex-1 basis-44 flex-col">
              <label htmlFor={`${fieldId}-match`} className="mb-1 text-xs text-muted-foreground">Correspondência</label>
              <select id={`${fieldId}-match`}
                className={inputClass}
                value={urlOp}
                onChange={(e) => setUrlOp(e.target.value as UrlOp)}
              >
                <option value="exact">Exatamente igual</option>
                <option value="prefix">Começa com</option>
                <option value="contains">Contém</option>
                <option value="regex">Expressão regular</option>
              </select>
            </div>
            <div className="flex min-w-0 flex-1 basis-44 flex-col">
              <label htmlFor={`${fieldId}-path`} className="mb-1 text-xs text-muted-foreground">Caminho</label>
              <input id={`${fieldId}-path`}
                className={inputClass}
                value={urlPath}
                onChange={(e) => setUrlPath(e.target.value)}
                placeholder="/obrigado"
              />
            </div>
          </>
        ) : null}

        {kind === 'form_submit' ? (
          <div className="flex min-w-0 flex-1 basis-44 flex-col">
            <label htmlFor={`${fieldId}-selector`} className="mb-1 text-xs text-muted-foreground">Seletor (opcional)</label>
            <input id={`${fieldId}-selector`}
              className={inputClass}
              value={selector}
              onChange={(e) => setSelector(e.target.value)}
              placeholder={'[data-lo-id="lead-form"]'}
            />
          </div>
        ) : null}

        <p className="w-full text-sm text-muted-foreground">
          {kind === 'event' ? <>Após a confirmação de sucesso, chame <code>LandingOptimizer.conversion({JSON.stringify(name.trim() || 'lead_received')})</code>. O nome deve ser exatamente igual.</> : null}
          {kind === 'url' ? 'Identifica visitas pelo caminho da URL, sem parâmetros de consulta ou fragmentos. Use uma página real de sucesso, em vez de uma âncora de contato.' : null}
          {kind === 'form_submit' ? 'Conta tentativas de envio, incluindo solicitações que falham depois. Deixe o seletor vazio para incluir qualquer formulário rastreado ou use o seletor exato de data-lo-id.' : null}
        </p>
        <Button type="submit" disabled={busy}>
          {busy ? 'Adicionando…' : 'Adicionar meta'}
        </Button>
      </form>}
    </Card>
  );
}

function matcherSummary(goal: ConversionGoal): string {
  const m = goal.matcher ?? {};
  if (goal.kind === 'url') {
    const op = (m as { op?: string }).op ?? 'exact';
    const path = (m as { path?: string }).path ?? '';
    return `${urlOpLabels[op] ?? 'Correspondência'} ${path}`.trim();
  }
  if (goal.kind === 'form_submit') {
    const sel = (m as { selector?: string }).selector;
    return sel ? `seletor ${sel}` : 'qualquer formulário rastreado';
  }
  return '';
}

function errorMessage(e: unknown): string {
  if (e instanceof ApiRequestError) return e.error.message;
  if (e instanceof Error) return e.message;
  return 'Ocorreu um erro. Tente novamente.';
}
