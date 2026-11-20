'use client';

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

interface SnippetResponse {
  siteId: string;
  html: string;
  gtm: { instructions: string; html: string };
  csp: { scriptSrc: string; connectSrc: string[] };
}

export default function SiteInstallPage(): React.ReactElement {
  const editable = canEdit(useSession().role);
  const params = useParams<{ id: string }>();
  const [snippet, setSnippet] = useState<SnippetResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<SnippetResponse>(`/sites/${params.id}/snippet`)
      .then(setSnippet)
      .catch((e: Error) => setError(e.message));
  }, [params.id]);

  async function copy(): Promise<void> {
    if (!snippet) return;
    await navigator.clipboard.writeText(snippet.html);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function publish(): Promise<void> {
    setPublishing(true);
    setPublishMsg(null);
    try {
      const res = await api.post<{ version: number }>(`/sites/${params.id}/config/publish`);
      setPublishMsg(`Configuração publicada (v${res.version}).`);
    } catch (e) {
      setPublishMsg(`Não foi possível publicar: ${(e as Error).message}`);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Instalação do código"
        description="Adicione antes de </head>."
        action={editable ?
          <Button onClick={publish} variant="outline" disabled={publishing}>
            {publishing ? 'Publicando…' : 'Publicar configuração'}
          </Button> : undefined
        }
      />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {publishMsg ? <p className="mb-4 text-sm text-muted-foreground">{publishMsg}</p> : null}

      {snippet ? (
        <div className="grid gap-4">
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <CardTitle>Instalar código de rastreamento</CardTitle>
              <Button size="sm" variant="outline" onClick={copy}>
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded bg-muted p-3 text-xs">
              {snippet.html}
            </pre>
          </Card>

          <Card>
            <CardTitle>Google Tag Manager</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">Crie uma tag de HTML personalizado no Google Tag Manager, cole o código de rastreamento e configure o acionamento em todas as páginas.</p>
          </Card>

          <Card>
            <CardTitle>Orientações de segurança (CSP)</CardTitle>
            <pre className="mt-2 overflow-x-auto rounded bg-muted p-3 text-xs">
              {`script-src  'self' ${snippet.csp.scriptSrc};\nconnect-src 'self' ${snippet.csp.connectSrc.join(' ')};`}
            </pre>
          </Card>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      )}

      <div className="mt-4">
        <GoalsManager siteId={params.id} />
      </div>
    </div>
  );
}
