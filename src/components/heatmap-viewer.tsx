'use client';

import { useId, useRef, useState } from 'react';
import type { HeatmapResult, SnapshotDetail } from '@/lib/api';
import { HeatmapLegend, HeatmapOverlay, type HeatmapLayers } from './heatmap-overlay';
import { Button } from './ui/button';

export function HeatmapViewer({ snapshot, imageUrl, heatmap, layers }: {
  snapshot: SnapshotDetail; imageUrl: string; heatmap: HeatmapResult; layers: HeatmapLayers;
}) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const inlineScroll = useRef<HTMLDivElement>(null);
  const cinemaScroll = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(true);
  const [markings, setMarkings] = useState(true);
  const hasPositions = snapshot.nodes.length > 0;

  function syncScroll(from: HTMLDivElement | null, to: HTMLDivElement | null) {
    if (!from || !to) return;
    // Keep the same page position when the available width changes.
    const fromWidth = from.firstElementChild?.getBoundingClientRect().width;
    const toWidth = to.firstElementChild?.getBoundingClientRect().width;
    if (!fromWidth || !toWidth) return;
    const scale = toWidth / fromWidth;
    to.scrollTop = from.scrollTop * scale;
    to.scrollLeft = from.scrollLeft * scale;
  }

  function viewer(cinema: boolean) {
    return <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background p-3">
        <div className="min-w-0 flex-1">
          <p id={cinema ? titleId : undefined} className="break-all text-sm font-medium">{snapshot.urlPath}</p>
          <p className="mt-1 text-xs text-muted-foreground">Captura de {snapshot.width} × {snapshot.height} px · role dentro da visualização</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-11" onClick={() => setFit(value => !value)}>{fit ? 'Tamanho original' : 'Ajustar à largura'}</Button>
          {hasPositions && <Button variant="outline" className="h-11" onClick={() => setMarkings(value => !value)}>{markings ? 'Ocultar marcações' : 'Mostrar marcações'}</Button>}
          {cinema
            ? <Button variant="outline" className="h-11" onClick={() => dialog.current?.close()}>Fechar</Button>
            : <Button variant="outline" className="h-11" aria-haspopup="dialog" onClick={() => {
              dialog.current?.showModal();
              syncScroll(inlineScroll.current, cinemaScroll.current);
            }}>Ampliar visualização</Button>}
        </div>
      </div>
      {!hasPositions && <p className="border-b border-border px-3 py-3 text-sm text-muted-foreground">Referência visual sem posições de elementos. As marcações estão desativadas; consulte as métricas abaixo do visualizador.</p>}
      {cinema && hasPositions && <div className="border-b border-border px-3 py-3"><HeatmapLegend layers={layers} /></div>}
      <div ref={cinema ? cinemaScroll : inlineScroll} role="region" aria-label={cinema ? 'Mapa de calor ampliado com rolagem' : 'Mapa de calor com rolagem'} tabIndex={0}
        className={`min-h-0 overflow-auto overscroll-contain bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${cinema ? 'flex-1' : 'h-[560px] max-h-[65dvh]'}`}>
        <div className="mx-auto" style={{ width: fit ? '100%' : snapshot.width, maxWidth: fit ? snapshot.width : undefined }}>
          <HeatmapOverlay snapshot={snapshot} imageUrl={imageUrl} heatmap={heatmap} layers={markings && hasPositions ? layers : { clicks: false, hover: false, frustration: false, scroll: false }} />
        </div>
      </div>
    </>;
  }

  return <>
    <div className="overflow-hidden rounded-lg border border-border">{viewer(false)}</div>
    <dialog ref={dialog} aria-labelledby={titleId}
      className="m-auto h-[88dvh] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[1440px] overflow-hidden rounded-xl bg-background p-0 text-foreground shadow-xl backdrop:bg-black/60"
      onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}
      onClose={() => syncScroll(cinemaScroll.current, inlineScroll.current)}>
      <div className="flex h-full min-h-0 flex-col">{viewer(true)}</div>
    </dialog>
  </>;
}
