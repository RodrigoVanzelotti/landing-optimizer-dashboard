'use client';

import { useEffect, useState } from 'react';
import { api, type AnalyticsTimeframe } from '@/lib/api';
import { useSession } from '@/lib/session';
import { timeframeLabels } from '@/lib/analytics';
import { auditActionLabels, auditTargetLabels } from '@/lib/audit';
import { DataState } from '@/components/data-state';
import { Button } from '@/components/ui/button';

interface Author { id: string; name: string | null; email: string; former: boolean }
type Actor = { kind: 'user'; id: string; name: string | null; email: string | null; former: boolean } | { kind: 'system' | 'restricted' };
interface AuditRow { id: string; actor: Actor; action: string; targetType: string; targetId: string; targetLabel: string | null; createdAt: string }
interface AuditPage { items: AuditRow[]; nextCursor: string | null; range: { from: string | null; to: string } }
interface Filters { timeframe: AnalyticsTimeframe | 'all'; action: string; actorUserId: string; order: 'asc' | 'desc' }
const inputClass = 'h-11 w-full min-w-0 rounded-md border border-border bg-background px-3 text-sm';
const initialFilters: Filters = { timeframe: 'all', action: '', actorUserId: '', order: 'desc' };

export function AuditSettings() {
  const user = useSession();
  const admin = user.role === 'admin';
  const principal = `${user.tenantId}-${user.id}-${user.role}`;
  const [optionResource, setOptions] = useState<{ authors: Author[]; actions: string[]; principal: string } | null>(null);
  const options = optionResource?.principal === principal ? optionResource : null;
  const [optionsError, setOptionsError] = useState(false);
  const [optionsAttempt, setOptionsAttempt] = useState(0);
  const [draft, setDraft] = useState<Filters>(initialFilters);
  const [applied, setApplied] = useState<Filters>(initialFilters);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [cursors, setCursors] = useState(['']);
  const [page, setPage] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [resource, setResource] = useState<{ key?: string; data?: AuditPage; error?: string }>({});
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(applied)) if (value) params.set(key, value);
  const exportQuery = params.toString();
  if (cursors[page]) params.set('cursor', cursors[page]);
  const query = params.toString();
  const requestKey = `${principal}-${query}-${attempt}`;
  const result = resource.key === requestKey ? resource.data : undefined;
  const error = resource.key === requestKey ? resource.error : undefined;
  const loading = !result && !error;

  useEffect(() => {
    if (options) return;
    let active = true;
    setOptionsError(false);
    api.get<{ authors: Author[]; actions: string[] }>('/audit/options')
      .then(data => { if (active) setOptions({ ...data, principal }); })
      .catch(() => { if (active) setOptionsError(true); });
    return () => { active = false; };
  }, [options, optionsAttempt, principal]);

  useEffect(() => {
    let active = true;
    setResource({ key: requestKey });
    api.get<AuditPage>(`/audit/search?${query}`)
      .then(data => { if (active) setResource({ key: requestKey, data }); })
      .catch((err: unknown) => { if (active) setResource({ key: requestKey, error: err instanceof Error ? err.message : 'Confira sua conexão e tente novamente.' }); });
    return () => { active = false; };
  }, [query, requestKey]);

  function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setApplied({ ...draft }); setCursors(['']); setPage(0); setAttempt(value => value + 1);
  }
  async function exportCsv() {
    setExporting(true); setExportError('');
    try {
      const file = await api.getBlob(`/audit/export?${exportQuery}`);
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url; link.download = `atividades-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      setExportError('Não foi possível exportar as atividades. Tente novamente.');
    } finally { setExporting(false); }
  }
  function next() {
    if (!result?.nextCursor) return;
    setCursors(previous => [...previous.slice(0, page + 1), result.nextCursor!]);
    setPage(value => value + 1);
  }

  return <section aria-labelledby="audit-heading">
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div><h2 id="audit-heading" className="text-xl font-semibold">Registro de atividades</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Todas as atividades deste workspace, 10 por página. Use os filtros para refinar a consulta ou baixe todos os registros da consulta em CSV.</p></div>
      <Button variant="outline" className="h-11 shrink-0" disabled={exporting || !result} onClick={() => { void exportCsv(); }}>{exporting ? 'Exportando…' : 'Baixar CSV'}</Button>
    </div>
    {exportError && <p role="alert" className="mb-4 text-sm">{exportError}</p>}
    <div id="audit-filters" className="mb-8 rounded-lg border border-border p-5">
      {optionsError && <div role="alert" className="mb-4 text-sm"><p>Não foi possível carregar as opções de ação e autor.</p><Button variant="outline" className="mt-2 h-11" onClick={() => setOptionsAttempt(value => value + 1)}>Tentar novamente</Button></div>}
      {!options && !optionsError && <p role="status" className="mb-4 text-sm text-muted-foreground">Carregando opções dos filtros…</p>}
      <form onSubmit={search}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0"><label htmlFor="audit-timeframe" className="mb-2 block text-sm font-medium">Período</label><select id="audit-timeframe" value={draft.timeframe} onChange={event => setDraft(value => ({ ...value, timeframe: event.target.value as Filters['timeframe'] }))} className={inputClass}><option value="all">Todo o histórico</option>{Object.entries(timeframeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <div className="min-w-0"><label htmlFor="audit-action" className="mb-2 block text-sm font-medium">Tipo de ação</label><select id="audit-action" value={draft.action} disabled={!options} onChange={event => setDraft(value => ({ ...value, action: event.target.value }))} className={inputClass}><option value="">Todas as ações</option>{options?.actions.map(action => <option key={action} value={action}>{auditActionLabels[action] ?? action}</option>)}</select></div>
            <div className="min-w-0"><label htmlFor="audit-author" className="mb-2 block text-sm font-medium">Autor</label><select id="audit-author" value={draft.actorUserId} disabled={!options} onChange={event => setDraft(value => ({ ...value, actorUserId: event.target.value }))} className={inputClass}><option value="">Todos os autores</option><option value="system">Sistema / autor não registrado</option>{options?.authors.filter(author => admin || !author.former).map(author => <option key={author.id} value={author.id}>{author.name ?? author.email ?? author.id}{author.email ? ` · ${author.email}` : ''}{author.former ? ' · Fora da equipe atual' : ''}</option>)}</select></div>
            <div className="min-w-0"><label htmlFor="audit-order" className="mb-2 block text-sm font-medium">Ordenação</label><select id="audit-order" value={draft.order} onChange={event => setDraft(value => ({ ...value, order: event.target.value as Filters['order'] }))} className={inputClass}><option value="desc">Mais recentes primeiro</option><option value="asc">Mais antigas primeiro</option></select></div>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{admin ? 'O filtro de autor inclui pessoas que já saíram da equipe.' : 'Autores fora da equipe atual são visíveis apenas para administradores.'} Os períodos incluem as ações de hoje; horários são exibidos no seu fuso local.</p>
          <div className="mt-4 flex flex-wrap gap-3"><Button type="submit" className="h-11" disabled={loading || exporting}>{loading ? 'Consultando…' : 'Consultar atividades'}</Button><Button type="button" variant="outline" className="h-11" disabled={loading || exporting} onClick={() => { setDraft(initialFilters); setApplied(initialFilters); setCursors(['']); setPage(0); setAttempt(value => value + 1); }}>Limpar filtros</Button></div>
        </form>
    </div>
    {error ? <DataState error title="Não foi possível consultar as atividades" description={error} onRetry={() => { setPage(0); setCursors(['']); setAttempt(value => value + 1); }} />
      : !result ? <DataState loading title="Consultando atividades…" />
      : <>
        <p className="mb-4 text-xs text-muted-foreground">{result.range.from ? `Consulta de ${new Date(result.range.from).toLocaleString('pt-BR')}` : 'Todo o histórico'} até {new Date(result.range.to).toLocaleString('pt-BR')}. Filtros alterados só são aplicados ao clicar em Consultar atividades. O CSV inclui todas as páginas da consulta aplicada.</p>
        {!result.items.length ? <DataState title="Nenhuma atividade para estes filtros" description="Escolha outro período, ação ou autor e consulte novamente." /> : <ol className="divide-y divide-border border-y border-border text-sm">{result.items.map(row => <li key={row.id} className="flex flex-col justify-between gap-3 py-5 sm:flex-row">
          <div className="min-w-0"><p className="break-words font-medium">{auditActionLabels[row.action] ?? row.action}</p>
            <p className="mt-2 break-words">{row.actor.kind === 'user' ? <><span className="font-medium">{row.actor.name ?? row.actor.email ?? row.actor.id}</span>{row.actor.email && <span className="break-all text-muted-foreground"> · {row.actor.email}</span>}{admin && row.actor.former && <span className="mt-1 block text-xs text-muted-foreground">Fora da equipe atual</span>}</> : <span className="text-muted-foreground">{row.actor.kind === 'restricted' ? 'Autor fora da equipe atual · identidade restrita a administradores' : 'Sistema / autor não registrado'}</span>}</p>
            <p className="mt-2 break-all text-xs text-muted-foreground">{auditTargetLabels[row.targetType] ?? row.targetType}: {row.targetLabel ? `${row.targetLabel} · ` : ''}{row.targetId}</p>
          </div><time className="shrink-0 text-xs text-muted-foreground" dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleString('pt-BR')}</time>
        </li>)}</ol>}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p role="status" className="text-sm text-muted-foreground">Página {page + 1} · {result.items.length} registro(s)</p><div className="flex gap-3"><Button variant="outline" className="h-11" disabled={page === 0 || loading} onClick={() => setPage(value => value - 1)}>Anterior</Button><Button variant="outline" className="h-11" disabled={!result.nextCursor || loading} onClick={next}>Próxima</Button></div></div>
      </>}
  </section>;
}
