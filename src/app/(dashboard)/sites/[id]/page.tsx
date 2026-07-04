'use client';

import type * as React from 'react';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';

interface SnippetResponse {
  siteId: string;
  html: string;
  gtm: { instructions: string; html: string };
  csp: { scriptSrc: string; connectSrc: string[] };
}

export default function SiteInstallPage(): React.ReactElement {
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
      setPublishMsg(`Config published (v${res.version}).`);
    } catch (e) {
      setPublishMsg(`Publish failed: ${(e as Error).message}`);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Script installation"
        description="Paste this snippet before </head>. It loads asynchronously and fails silently."
        action={
          <Button onClick={publish} variant="outline" disabled={publishing}>
            {publishing ? 'Publishing…' : 'Publish config'}
          </Button>
        }
      />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {publishMsg ? <p className="mb-4 text-sm text-muted-foreground">{publishMsg}</p> : null}

      {snippet ? (
        <div className="grid gap-4">
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <CardTitle>Install snippet</CardTitle>
              <Button size="sm" variant="outline" onClick={copy}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded bg-muted p-3 text-xs">
              {snippet.html}
            </pre>
          </Card>

          <Card>
            <CardTitle>Google Tag Manager</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">{snippet.gtm.instructions}</p>
          </Card>

          <Card>
            <CardTitle>CSP guidance</CardTitle>
            <pre className="mt-2 overflow-x-auto rounded bg-muted p-3 text-xs">
              {`script-src  'self' ${snippet.csp.scriptSrc};\nconnect-src 'self' ${snippet.csp.connectSrc.join(' ')};`}
            </pre>
          </Card>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
    </div>
  );
}
