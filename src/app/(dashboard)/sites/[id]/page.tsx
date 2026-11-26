'use client';

import { toast } from '@/components/ui/toast';

import type * as React from 'react';
import { useSession } from '@/lib/session';
import { canEdit } from '@/lib/permissions';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { GoalsManager } from '@/components/goals-manager';
import { useSites } from '@/lib/use-sites';

interface SnippetResponse {
  siteId: string;
  html: string;
  csp: { scriptSrc: string; connectSrc: string[] };
}

export default function SiteInstallPage(): React.ReactElement {
  const params = useParams<{ id: string }>();
  return <SiteInstallation key={params.id} siteId={params.id} />;
}

function SiteInstallation({ siteId }: { siteId: string }): React.ReactElement {
  const editable = canEdit(useSession().role);
  const { sites, reload } = useSites();
  const site = sites.find(site => site.id === siteId);
  const [hasChanges, setHasChanges] = useState(false);
  const [publishedVersion, setPublishedVersion] = useState<number | null>(null);
  const [snippet, setSnippet] = useState<SnippetResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [confirmingPublish, setConfirmingPublish] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .get<SnippetResponse>(`/sites/${siteId}/snippet`)
      .then(value => { if (active) setSnippet(value); })
      .catch((e: Error) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [siteId]);

  async function copy(): Promise<void> {
    if (!snippet) return;
    try {
      await navigator.clipboard.writeText(snippet.html);
      toast.success('Código de rastreamento copiado.');
    } catch { toast.error('Não foi possível copiar. Selecione e copie o código de rastreamento.'); }
  }

  async function publish(): Promise<void> {
    if (!editable || publishing || !snippet || !confirmingPublish) return;
    setPublishing(true);
    try {
      const res = await api.post<{ version: number }>(`/sites/${siteId}/config/publish`);
      setPublishedVersion(res.version);
      setHasChanges(false);
      setConfirmingPublish(false);
      toast.success(`Configuração publicada (v${res.version}).`);
      reload();
    } catch (e) {
      toast.error(`Não foi possível publicar: ${(e as Error).message}`);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Instalação do código"
        description="Cole o código no <head> compartilhado do site."
      />

      {(hasChanges || (publishedVersion ?? site?.configVersion) === 0) && <p role="status" className="mb-6 rounded-md border border-border bg-muted p-4 text-sm">{hasChanges ? 'Há alterações feitas nesta tela desde a última publicação manual da configuração.' : 'A configuração deste site ainda não foi publicada.'} {editable ? 'Use Publicar configuração ao final da página.' : 'Peça a um editor ou administrador para publicar a configuração.'}</p>}
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}

      {snippet ? (
        <div className="grid gap-4">
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <CardTitle>Instalar código de rastreamento</CardTitle>
              <Button size="sm" variant="outline" onClick={copy}>
                Copiar
              </Button>
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded bg-muted p-3 text-xs">
              {snippet.html}
            </pre>
          </Card>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      )}

      <div className="mt-4">
        <GoalsManager siteId={siteId} onChanged={(kind) => {
          if (kind === 'element_visible') reload();
          else setHasChanges(true);
        }} />
      </div>

      <section aria-label="Publicação da configuração" className="mt-8 border-t border-border pt-6">
        {editable && <Button id="publish-config" onClick={() => { setConfirmingPublish(true); }} disabled={publishing || !snippet} aria-busy={publishing} aria-expanded={confirmingPublish} aria-controls="publish-confirmation" className="min-h-11">
          {publishing ? 'Publicando…' : 'Publicar configuração'}
        </Button>}
        {editable && confirmingPublish && <section id="publish-confirmation" aria-labelledby="publish-confirmation-title" className="mt-4 rounded-md border border-border bg-muted/40 p-4">
          <h2 id="publish-confirmation-title" className="text-sm font-semibold">Publicar a configuração deste site?</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">A configuração atual será publicada para o código de rastreamento instalado neste site.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button autoFocus variant="outline" className="h-11" disabled={publishing} onClick={() => { setConfirmingPublish(false); document.getElementById('publish-config')?.focus(); }}>Cancelar</Button>
            <Button className="h-11" disabled={publishing} aria-busy={publishing} onClick={() => { void publish(); }}>{publishing ? 'Publicando…' : 'Confirmar publicação'}</Button>
          </div>
        </section>}
      </section>

      {snippet && <details className="mt-8 rounded-lg border border-border p-5">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Orientações de segurança (CSP)</summary>
        <pre className="mt-2 overflow-x-auto rounded bg-muted p-3 text-xs">
          {`script-src  'self' ${snippet.csp.scriptSrc};\nconnect-src 'self' ${snippet.csp.connectSrc.join(' ')};`}
        </pre>
      </details>}
    </div>
  );
}
