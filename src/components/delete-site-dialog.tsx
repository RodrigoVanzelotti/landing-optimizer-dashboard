'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, type Site } from '@/lib/api';
import { Button } from '@/components/ui/button';

export function DeleteSiteDialog({ site, onClose, onDeleted }: { site: Site; onClose: () => void; onDeleted: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  function close() {
    if (busy) return;
    dialog.current?.close();
    onClose();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || confirmation.trim() !== site.primaryDomain) return;
    setBusy(true); setError(null);
    try {
      await api.del(`/sites/${site.id}`, { confirmation: confirmation.trim() });
      dialog.current?.close();
      onDeleted();
    } catch {
      setError('Não foi possível confirmar a exclusão. Atualize a lista antes de tentar novamente: a operação pode ter sido parcialmente concluída.');
      setBusy(false);
    }
  }

  return <dialog ref={dialog} aria-labelledby="delete-site-title" aria-describedby="delete-site-description"
    onCancel={event => { event.preventDefault(); close(); }}
    className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl bg-background p-6 text-foreground backdrop:bg-black/50">
    <h2 id="delete-site-title" className="text-xl font-semibold">Excluir site permanentemente?</h2>
    <p className="mt-2 break-words font-medium">{site.name}</p>
    <div id="delete-site-description" className="mt-3 space-y-3 text-sm leading-relaxed">
      <p>Esta ação não pode ser desfeita. Todos os dados deste site serão excluídos: configurações, metas, eventos, métricas, capturas, insights, experimentos e resultados.</p>
      <p>Os tokens de ingestão e as chaves do site serão invalidados na base de dados. A coleta de dados e a entrega de configurações deixarão de funcionar. Remova também o código de rastreamento do seu site.</p>
      <p className="text-muted-foreground">O histórico de atividade deste site será apagado. Manteremos somente o administrador responsável pela exclusão, a data e o ID do site.</p>
    </div>
    <form onSubmit={submit} className="mt-5">
      <label htmlFor="delete-site-confirmation" className="block text-sm">Para confirmar, digite <strong className="break-all">{site.primaryDomain}</strong></label>
      <input id="delete-site-confirmation" autoFocus autoComplete="off" spellCheck={false} required disabled={busy} value={confirmation}
        onChange={event => setConfirmation(event.target.value)} className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm" />
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      <p role="status" className="mt-3 text-sm text-muted-foreground">{busy ? 'Excluindo os dados e invalidando as credenciais. Aguarde a confirmação…' : ''}</p>
      <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" className="h-11" disabled={busy} onClick={close}>Cancelar</Button>
        <Button type="submit" variant="destructive" className="h-11" disabled={busy || confirmation.trim() !== site.primaryDomain}>{busy ? 'Excluindo…' : 'Excluir site e todos os dados'}</Button>
      </div>
    </form>
  </dialog>;
}
