'use client';

import { useId, useEffect, useState } from 'react';
import { api, type AnalyticsTimeframe } from '@/lib/api';
import { canEdit } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { DataState } from '@/components/data-state';
import { toast } from '@/components/ui/toast';

interface Journey {
  steps: string[];
  globalEvent?: { source: string; goal: string };
}
interface JourneyReportData {
  journey: Journey;
  truncated: boolean;
  steps: {
    rule: string;
    reached: number;
    directEntries: number;
    dropped: number | null;
    advanceRate: number | null;
    unattributed: number;
    ctas: { path: string; selector: string; group: string; clicked: number; arrived: number }[];
  }[];
}

const input = 'min-h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-sm';
const percent = (fraction: number) => fraction.toLocaleString('pt-BR', { style: 'percent', maximumFractionDigits: 1 });

export function JourneyReport({ siteId, timeframe, refreshKey }: {
  siteId: string; timeframe: AnalyticsTimeframe; refreshKey: number;
}) {
  const { role } = useSession();
  const editable = canEdit(role);
  const id = useId();
  const [attempt, retry] = useState(0);
  const [record, setRecord] = useState<{ key: string; data?: JourneyReportData; error?: boolean }>();
  const [editing, setEditing] = useState(false);
  const [routes, setRoutes] = useState('');
  const [source, setSource] = useState('');
  const [goal, setGoal] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copying, setCopying] = useState(false);
  const key = `${siteId}/${timeframe}/${refreshKey}/${attempt}`;
  const current = record?.key === key ? record : undefined;
  const report = current?.data;

  useEffect(() => {
    let active = true;
    api.get<JourneyReportData>(`/analytics/journey?siteId=${encodeURIComponent(siteId)}&timeframe=${timeframe}`)
      .then(data => { if (active) setRecord({ key, data }); })
      .catch(() => { if (active) setRecord({ key, error: true }); });
    return () => { active = false; };
  }, [siteId, timeframe, key]);

  function edit() {
    if (!report) return;
    setRoutes(report.journey.steps.join('\n'));
    setSource(report.journey.globalEvent?.source ?? '');
    setGoal(report.journey.globalEvent?.goal ?? '');
    setError('');
    setEditing(true);
  }

  async function save() {
    setError('');
    const steps = routes.split('\n').map(route => route.trim()).filter(Boolean);
    if (steps.length === 1 || Boolean(source.trim()) !== Boolean(goal.trim())) {
      setError('Use pelo menos duas etapas e preencha os dois campos do evento global, se for usá-lo.');
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/analytics/journey/${encodeURIComponent(siteId)}`, {
        steps, ...(source.trim() ? { globalEvent: { source: source.trim(), goal: goal.trim() } } : {}),
      });
      setEditing(false);
      retry(n => n + 1);
      toast.success('Jornada salva.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Não foi possível salvar a jornada.');
    } finally {
      setSaving(false);
    }
  }

  async function copyServerToken() {
    setCopying(true);
    try {
      const { token } = await api.get<{ token: string }>(`/sites/${encodeURIComponent(siteId)}/server-conversion-token`);
      await navigator.clipboard.writeText(token);
      toast.success('Credencial copiada.');
    } catch {
      toast.error('Não foi possível copiar a credencial de servidor.');
    } finally { setCopying(false); }
  }

  return <Card className="my-6 shadow-none">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <CardTitle>Jornada de conversão</CardTitle>
      {editable && report && !editing && <Button variant="outline" className="min-h-11" onClick={edit}>
        {report.journey.steps.length ? 'Editar jornada' : 'Configurar jornada'}
      </Button>}
    </div>
    {current?.error ? <DataState error title="Jornada indisponível" onRetry={() => retry(n => n + 1)} />
      : !report ? <DataState loading title="Carregando jornada…" />
      : report.truncated ? <p role="status" className="mt-3 text-sm">Este período tem eventos demais para o relatório. Selecione um período menor.</p>
      : !report.steps.length && !editing ? <p className="mt-3 text-sm text-muted-foreground">Escolha as rotas que representam avanço, como a página inicial e o cadastro.</p>
      : null}

    {editing && <form className="mt-4 grid gap-3" onSubmit={event => { event.preventDefault(); void save(); }}>
      <label htmlFor={`${id}-steps`} className="text-sm font-medium">Etapas em ordem</label>
      <textarea id={`${id}-steps`} className={input} value={routes} onChange={event => setRoutes(event.target.value)} rows={4} aria-describedby={`${id}-help`} />
      <p id={`${id}-help`} className="text-sm text-muted-foreground">Uma etapa por linha. Use um caminho como /cadastro, uma família como /produto/* ou event:compra_confirmada na última linha para uma meta cadastrada.</p>
      <details open={Boolean(report?.journey.globalEvent) || undefined}>
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Evento global do site</summary>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">Evento do dataLayer<input className={input} value={source} onChange={event => setSource(event.target.value)} placeholder="purchase" maxLength={64} /></label>
          <label className="grid gap-1 text-sm">Nome da meta de evento<input className={input} value={goal} onChange={event => setGoal(event.target.value)} placeholder="compra_confirmada" maxLength={64} /></label>
        </div>
      </details>
      {error && <p role="alert" className="text-sm">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving} className="min-h-11">{saving ? 'Salvando…' : 'Salvar jornada'}</Button>
        <Button type="button" variant="outline" disabled={saving} className="min-h-11" onClick={() => setEditing(false)}>Cancelar</Button>
      </div>
    </form>}

    {!editing && !!report?.steps.length && <>
      <p className="my-4 text-sm text-muted-foreground">Uma passagem por etapa em cada sessão, em até 30 minutos após a entrada. As entradas diretas são mostradas à parte.</p>
      <ol className="divide-y divide-border">
        {report.steps.map(step => <li key={step.rule} className="space-y-2 py-3">
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <strong className="break-all">{step.rule}</strong>
            <span>{step.reached.toLocaleString('pt-BR')} sessões{step.advanceRate !== null && ` · ${percent(step.advanceRate)} avançaram`}</span>
          </div>
          {(step.dropped !== null || step.directEntries > 0) && <p className="text-sm text-muted-foreground">
            {step.dropped !== null && `${step.dropped.toLocaleString('pt-BR')} sem avanço desde a etapa anterior`}
            {step.dropped !== null && step.directEntries > 0 && ' · '}
            {step.directEntries > 0 && `${step.directEntries.toLocaleString('pt-BR')} entradas diretas`}
          </p>}
          {!!step.ctas.length && <details>
            <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Chegadas por CTA</summary>
            <ul className="space-y-2 text-sm">{step.ctas.map(cta => <li key={JSON.stringify([cta.path, cta.selector, cta.group])} className="break-all">
              <strong>{cta.group || `${cta.path} · ${cta.selector}`}</strong> · {cta.clicked} clicaram · {cta.arrived} chegaram ({percent(cta.arrived / cta.clicked)})
            </li>)}</ul>
          </details>}
          {step.unattributed > 0 && !step.rule.startsWith('event:') && <p className="text-sm text-muted-foreground">{step.unattributed} chegadas sem CTA identificado</p>}
        </li>)}
      </ol>
    </>}
    {!editing && report?.journey.globalEvent && <p className="mt-3 break-all text-sm text-muted-foreground">Evento global {report.journey.globalEvent.source} → {report.journey.globalEvent.goal}</p>}
    {role === 'admin' && report && <details className="mt-4 border-t border-border">
      <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Conversões de servidor</summary>
      <p className="mb-3 break-words text-sm text-muted-foreground">Use a credencial somente no backend. Envie a confirmação para <code className="break-all">POST /v1/server-conversions/{siteId}</code>.</p>
      <Button type="button" variant="outline" className="min-h-11" onClick={() => void copyServerToken()} disabled={copying}>
        {copying ? 'Copiando…' : 'Copiar credencial'}
      </Button>
    </details>}
  </Card>;
}
