'use client';

import { toast } from '@/components/ui/toast';

import type * as React from 'react';
import { useSession } from '@/lib/session';
import { canEdit } from '@/lib/permissions';
import { useCallback, useEffect, useId, useState } from 'react';
import { api, ApiRequestError, type ConversionGoal, type GoalKind } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { goalKindLabels } from '@/lib/goals';

type UrlOp = 'exact' | 'prefix' | 'contains' | 'regex';

const urlOpLabels: Record<string, string> = {
  exact: 'Exatamente igual', prefix: 'Começa com', contains: 'Contém', regex: 'Expressão regular',
};

const inputClass =
  'min-h-11 min-w-0 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

/** Per-site conversion goal management (create, list, delete). */
export function GoalsManager({ siteId, onChanged }: { siteId: string; onChanged: (kind: GoalKind) => void }): React.ReactElement {
  const editable = canEdit(useSession().role);
  const [goals, setGoals] = useState<ConversionGoal[]>([]);
  const [name, setName] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [kind, setKind] = useState<GoalKind>('url');
  const [urlOp, setUrlOp] = useState<UrlOp>('exact');
  const [urlPath, setUrlPath] = useState('');
  const [fromPath, setFromPath] = useState('');
  const [selector, setSelector] = useState('');
  const [confirmationId, setConfirmationId] = useState('');
  const [formId, setFormId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
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
    if (!name.trim()) {
      setError('Informe o nome da meta.');
      return;
    }
    if ((kind === 'url' || kind === 'element_visible') && !urlPath.trim()) {
      setError('Informe o caminho da página.');
      return;
    }
    if (kind === 'element_visible' && !/^\/(?!\/)[^?#\s]*$/.test(urlPath.trim())) {
      setError('Informe só o caminho da página, como /cadastro.');
      return;
    }
    if (kind === 'element_visible' && ![confirmationId, ...(formId.trim() ? [formId] : [])]
      .every(id => /^[a-z][a-z0-9-]{0,63}$/.test(id.trim()))) {
      setError('Informe IDs com até 64 caracteres, começando com letra minúscula e usando apenas letras minúsculas, números e hífens.');
      return;
    }
    setBusy(true);
    try {
      const matcher =
        kind === 'url'
          ? { op: urlOp, path: urlPath.trim(), ...(fromPath.trim() ? { fromPath: fromPath.trim() } : {}) }
          : kind === 'element_visible'
            ? {
              path: urlPath.trim(),
              selector: `[data-lo-id="${confirmationId.trim()}"]`,
              ...(formId.trim() ? { formSelector: `[data-lo-id="${formId.trim()}"]` } : {}),
            }
          : kind === 'form_submit' && selector.trim()
            ? { selector: selector.trim() }
            : undefined;
      await api.post<ConversionGoal>(`/sites/${siteId}/goals`, {
        name: name.trim(),
        kind,
        isFavorite,
        ...(matcher ? { matcher } : {}),
      });
      toast.success(kind === 'element_visible'
        ? 'Meta adicionada. Reabra a página do site para testar com a configuração nova.'
        : 'Meta adicionada. Novos eventos correspondentes serão contados na meta.');
      onChanged(kind);
      setName('');
      setIsFavorite(false);
      setUrlPath('');
      setFromPath('');
      setSelector('');
      setConfirmationId('');
      setFormId('');
      load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(goal: ConversionGoal): Promise<void> {
    setError(null);
    try {
      await api.del(`/sites/${siteId}/goals/${goal.id}`);
      toast.success('Meta excluída.');
      onChanged(goal.kind);
      load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function favorite(goal: ConversionGoal): Promise<void> {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      await api.patch(`/sites/${siteId}/goals/${goal.id}`, { isFavorite: !goal.isFavorite });
      setGoals(current => current.map(item => ({ ...item, isFavorite: item.id === goal.id ? !goal.isFavorite : false })));
      toast.success(goal.isFavorite ? 'Meta favorita removida.' : 'Meta favorita definida. Ela será selecionada por padrão na visão geral deste site.');
      onChanged(goal.kind);
    } catch (e) { toast.error(errorMessage(e)); }
    finally { setBusy(false); }
  }

  return (
    <Card>
      <CardTitle>Metas de conversão</CardTitle>
      <p className="mt-1 text-xs text-muted-foreground">
        O que aparece no site depois que a ação dá certo? Use a página ou o elemento de confirmação que já existe no site.
        Se conseguir observar apenas o clique ou o envio, acompanhe a tentativa nas métricas de interação.
      </p>

      {error ? <p role="alert" className="mt-3 text-sm text-red-600">{error}</p> : null}


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
                  {g.isFavorite && <span className="text-primary">· Favorita </span>}
                  <span className="text-muted-foreground">· {goalKindLabels[g.kind]}</span>
                  {summary ? <span className="text-muted-foreground"> · {summary}</span> : null}
                </div>
                {editable && <div className="flex flex-wrap gap-2"><Button className="h-11" size="sm" variant="outline" disabled={busy} aria-pressed={!!g.isFavorite} onClick={() => void favorite(g)}>{g.isFavorite ? 'Remover favorita' : 'Definir como favorita'}</Button><Button size="sm" className="h-11" variant="destructive" disabled={busy} onClick={() => remove(g)}>
                  Excluir
                </Button></div>}
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
            <option value="url">{goalKindLabels.url}</option>
            <option value="element_visible">{goalKindLabels.element_visible}</option>
            <optgroup label="Avançado">
              <option value="event">{goalKindLabels.event}</option>
              <option value="form_submit">{goalKindLabels.form_submit}</option>
            </optgroup>
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
            <div className="flex min-w-0 flex-1 basis-44 flex-col">
              <label htmlFor={`${fieldId}-from`} className="mb-1 text-xs text-muted-foreground">Caminho anterior (opcional)</label>
              <input id={`${fieldId}-from`} className={inputClass} value={fromPath} maxLength={256}
                onChange={event => setFromPath(event.target.value)} placeholder="/" />
            </div>
          </>
        ) : null}

        {kind === 'element_visible' ? (
          <>
            <div className="flex min-w-0 flex-1 basis-44 flex-col">
              <label htmlFor={`${fieldId}-path`} className="mb-1 text-xs text-muted-foreground">Caminho da página</label>
              <input id={`${fieldId}-path`} className={inputClass} value={urlPath}
                onChange={(e) => setUrlPath(e.target.value)} placeholder="/cadastro" maxLength={512} required />
            </div>
            <div className="flex min-w-0 flex-1 basis-44 flex-col">
              <label htmlFor={`${fieldId}-confirmation`} className="mb-1 text-xs text-muted-foreground">ID da confirmação</label>
              <input id={`${fieldId}-confirmation`} className={inputClass} value={confirmationId}
                onChange={(e) => setConfirmationId(e.target.value)} placeholder="cadastro-confirmado" maxLength={64} required />
            </div>
            <div className="flex min-w-0 flex-1 basis-44 flex-col">
              <label htmlFor={`${fieldId}-form-id`} className="mb-1 text-xs text-muted-foreground">ID do formulário (opcional)</label>
              <input id={`${fieldId}-form-id`} className={inputClass} value={formId}
                onChange={(e) => setFormId(e.target.value)} placeholder="cadastro-form" maxLength={64} />
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
          {kind === 'url' ? 'Use o caminho do destino. Preencha o caminho anterior para contar somente o avanço a partir daquela página ou família de páginas.' : null}
          {kind === 'element_visible' ? <>Use o <code>data-lo-id</code> de um elemento que só aparece após o sucesso. Se informar o ID do formulário, a confirmação deve aparecer após um envio desse formulário.</> : null}
          {kind === 'form_submit' ? 'Conta tentativas de envio, incluindo solicitações que falham depois. Deixe o seletor vazio para incluir qualquer formulário rastreado ou use o seletor exato de data-lo-id.' : null}
        </p>
        <Checkbox id={`${fieldId}-favorite`} checked={isFavorite} onChange={setIsFavorite} className="min-h-11 w-full" label="Usar como meta favorita deste site na visão geral" />
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
    const from = (m as { fromPath?: string }).fromPath;
    return `${urlOpLabels[op] ?? 'Correspondência'} ${path}${from ? ` · a partir de ${from}` : ''}`.trim();
  }
  if (goal.kind === 'form_submit') {
    const sel = (m as { selector?: string }).selector;
    return sel ? `seletor ${sel}` : 'qualquer formulário rastreado';
  }
  if (goal.kind === 'element_visible') {
    const { path, selector, formSelector } = m as { path?: string; selector?: string; formSelector?: string };
    return [path, selector, formSelector && `após envio de ${formSelector}`].filter(Boolean).join(' · ');
  }
  return '';
}

function errorMessage(e: unknown): string {
  if (e instanceof ApiRequestError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Ocorreu um erro. Tente novamente.';
}
