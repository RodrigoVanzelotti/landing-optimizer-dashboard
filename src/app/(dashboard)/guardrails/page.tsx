'use client';

import type * as React from 'react';
import { useSession } from '@/lib/session';
import { canEdit } from '@/lib/permissions';
import { useEffect, useState } from 'react';
import { api, type GuardrailRules, type GuardrailView } from '@/lib/api';
import { useSites } from '@/lib/use-sites';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { DataState } from '@/components/data-state';

const inputClass =
  'w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

type SaveState = { kind: 'idle' | 'saving' | 'saved' | 'error'; message?: string };

export default function GuardrailsPage(): React.ReactElement {
  const editable = canEdit(useSession().role);
  const { sites, siteId, loading, error: sitesError } = useSites();
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [tone, setTone] = useState('');
  const [bannedWords, setBannedWords] = useState('');
  const [maxLength, setMaxLength] = useState('');
  const [mustKeepClaims, setMustKeepClaims] = useState('');
  const [state, setState] = useState<SaveState>({ kind: 'idle' });

  useEffect(() => {
    if (!siteId) return;
    let active = true;
    setState({ kind: 'idle' });
    api
      .get<GuardrailView>(`/sites/${siteId}/guardrails`)
      .then((view) => {
        if (!active) return;
        const r = view.rules ?? {};
        setTone(r.tone ?? '');
        setBannedWords((r.bannedWords ?? []).join('\n'));
        setMaxLength(r.maxLength != null ? String(r.maxLength) : '');
        setMustKeepClaims((r.mustKeepClaims ?? []).join('\n'));
        setReady(true);
      })
      .catch((e: Error) => { if (active) setState({ kind: 'error', message: e.message }); });
    return () => { active = false; };
  }, [siteId, attempt]);

  async function save(): Promise<void> {
    const rules: GuardrailRules = {};
    const toneTrimmed = tone.trim();
    if (toneTrimmed) rules.tone = toneTrimmed;

    const words = bannedWords
      .split(/[\n,]/)
      .map((w) => w.trim())
      .filter(Boolean);
    if (words.length > 0) rules.bannedWords = words;

    const claims = mustKeepClaims
      .split('\n')
      .map((c) => c.trim())
      .filter(Boolean);
    if (claims.length > 0) rules.mustKeepClaims = claims;

    if (maxLength.trim()) {
      const n = Number(maxLength);
      if (!Number.isInteger(n) || n <= 0) {
        setState({ kind: 'error', message: 'Max length must be a positive whole number.' });
        return;
      }
      rules.maxLength = n;
    }

    setState({ kind: 'saving' });
    try {
      await api.put<GuardrailView>(`/sites/${siteId}/guardrails`, { rules });
      setState({ kind: 'saved', message: 'Guardrails saved.' });
    } catch (e) {
      setState({ kind: 'error', message: (e as Error).message });
    }
  }

  if (loading || sitesError || sites.length === 0) {
    return (
      <div>
        <PageHeader title="Brand guardrails" />
        {sitesError ? <DataState error title="Não foi possível carregar seus sites" description="Confira sua conexão e recarregue a página para tentar novamente." onRetry={() => window.location.reload()} /> : loading ? <DataState loading title="Carregando diretrizes…" /> : <DataState title="As diretrizes precisam de um site" description="Depois de cadastrar um site, você poderá definir o tom de voz e os limites para as sugestões de IA." href="/sites" action="Ir para sites" />}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Brand guardrails"

        action={editable ?
          <Button onClick={save} disabled={!siteId || !ready || state.kind === 'saving'}>
            {state.kind === 'saving' ? 'Saving…' : 'Save guardrails'}
          </Button> : undefined
        }
      />

      {!ready && state.kind !== 'error' && <DataState loading title="Carregando diretrizes deste site…" />}

      {!ready && state.kind === 'error' && <DataState error title="Diretrizes indisponíveis" description={state.message ?? 'Tente novamente.'} onRetry={() => setAttempt(value => value + 1)} />}
      {ready && state.kind === 'error' ? (
        <p className="mb-4 text-sm text-red-600">{state.message}</p>
      ) : null}
      {state.kind === 'saved' ? (
        <p className="mb-4 text-sm text-green-700">{state.message}</p>
      ) : null}

      {ready && <div className="grid gap-4 md:max-w-2xl">
        <Card>
          <CardTitle>Tone</CardTitle>
          <input
            className={`${inputClass} mt-2`}
            placeholder="e.g. confident, concise, friendly"
            readOnly={!editable}
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            maxLength={500}
          />
        </Card>

        <Card>
          <CardTitle>Banned words</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Uma por linha ou separadas por vírgula.
          </p>
          <textarea
            className={`${inputClass} mt-2 h-28 resize-y`}
            placeholder={'cheap\nguaranteed\nfree'}
            readOnly={!editable}
            value={bannedWords}
            onChange={(e) => setBannedWords(e.target.value)}
          />
        </Card>

        <Card>
          <CardTitle>Max copy length</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Caracteres. Em branco = sem limite.
          </p>
          <input
            className={`${inputClass} mt-2`}
            inputMode="numeric"
            placeholder="e.g. 80"
            readOnly={!editable}
            value={maxLength}
            onChange={(e) => setMaxLength(e.target.value)}
          />
        </Card>

        <Card>
          <CardTitle>Must-keep claims</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Uma por linha. Orientação para geração.
          </p>
          <textarea
            className={`${inputClass} mt-2 h-24 resize-y`}
            placeholder={'SOC 2 Type II certified\n30-day money-back guarantee'}
            readOnly={!editable}
            value={mustKeepClaims}
            onChange={(e) => setMustKeepClaims(e.target.value)}
          />
        </Card>
      </div>}
    </div>
  );
}
