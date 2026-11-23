'use client';

import { useEffect, useRef, useState } from 'react';
import type { ExperimentReport } from '@/lib/api';
import { chartPath } from '@/lib/analytics';
import { resultRate } from '@/lib/results';
import { reportDate } from './trend-chart';

export function ExperimentTrend({ report, variantId }: { report: ExperimentReport; variantId: string }) {
  const hasSeries = report.series.length > 0;
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [point, setPoint] = useState<number | null>(null);
  useEffect(() => {
    if (!container.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [hasSeries]);
  const controlId = report.variants.find(variant => variant.isControl)?.variantId;
  const values = (id?: string) => report.series.map(row => row.variants.find(variant => variant.variantId === id)?.conversionRate ?? null);
  const control = values(controlId), proposed = values(variantId);
  const maximum = Math.min(1, Math.max(.05, Math.ceil(Math.max(0, ...control.filter(value => value !== null), ...proposed.filter(value => value !== null)) * 1.1 * 20) / 20));
  const index = Math.min(point ?? report.series.length - 1, report.series.length - 1);
  const x = (i: number) => 48 + i / Math.max(1, report.series.length - 1) * (width - 72);
  const format = (value: number | null) => value === null ? 'Sem dados' : resultRate(value);
  if (!report.series.length) return <p className="mt-4 text-sm text-muted-foreground">O gráfico aparecerá após as primeiras sessões completarem a janela de conversão de 24 horas.</p>;
  return <div className="mt-5">
    <p className="mb-3 text-sm font-medium">Taxa de conversão ao longo do tempo</p>
    <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground"><span className="inline-flex items-center gap-2"><span aria-hidden="true" className="w-6 border-t-2 border-dashed border-muted-foreground" />Site base</span><span className="inline-flex items-center gap-2"><span aria-hidden="true" className="w-6 border-t-2 border-primary" />Mudança proposta</span></div>
    <div ref={container} role="group" tabIndex={0} aria-label="Taxa de conversão por data. Use as setas para comparar o site base e a mudança proposta." className="rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" onKeyDown={event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); setPoint(Math.max(0, Math.min(report.series.length - 1, index + (event.key === 'ArrowLeft' ? -1 : 1)))); }
    }}>
      <svg viewBox={`0 0 ${width} 270`} className="block w-full" role="img" aria-label="Eixo Y: taxa de conversão. Eixo X: data da exposição. Valores exatos disponíveis na tabela.">
        <text x={48} y={13} className="fill-muted-foreground text-[11px]">Taxa de conversão (%)</text>
        {[0, 1, 2, 3, 4].map(tick => <g key={tick}><line x1={48} x2={width - 24} y1={24 + tick * 46} y2={24 + tick * 46} className="stroke-border" /><text x={40} y={28 + tick * 46} textAnchor="end" className="fill-muted-foreground text-[11px]">{resultRate(maximum * (4 - tick) / 4)}</text></g>)}
        {[...new Set([0, Math.floor((report.series.length - 1) / 2), report.series.length - 1])].map(i => <text key={i} x={x(i)} y={235} textAnchor={i === 0 ? 'start' : i === report.series.length - 1 ? 'end' : 'middle'} className="fill-muted-foreground text-[11px]">{reportDate(report.series[i].date).slice(0, 5)}</text>)}
        <text x={width / 2} y={263} textAnchor="middle" className="fill-muted-foreground text-[11px]">Data da exposição (UTC)</text>
        <path d={chartPath(control, maximum, width)} fill="none" strokeWidth={2} strokeDasharray="6 5" className="stroke-muted-foreground" />
        <path d={chartPath(proposed, maximum, width)} fill="none" strokeWidth={2.5} className="stroke-primary" />
        <line x1={x(index)} x2={x(index)} y1={24} y2={208} className="stroke-border" strokeDasharray="3 3" />
        {[control, proposed].map((series, group) => series[index] !== null && <circle key={group} cx={x(index)} cy={208 - series[index]! / maximum * 184} r={4} className={group ? 'fill-primary' : 'fill-muted-foreground'} />)}
        {report.series.map((row, i) => <rect key={row.date} x={Math.max(48, x(i) - (width - 72) / Math.max(1, report.series.length - 1) / 2)} y={16} width={(width - 72) / Math.max(1, report.series.length - 1)} height={200} fill="transparent" onMouseEnter={() => setPoint(i)} onPointerDown={() => setPoint(i)} />)}
      </svg>
    </div>
    <p aria-live="polite" className="mt-2 text-sm tabular-nums">Até {reportDate(report.series[index].date)}: site base {format(control[index])} · mudança proposta {format(proposed[index])}.</p>
    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Taxas acumuladas por data da exposição. Cada sessão tem até 24 horas para converter; sessões mais recentes ainda não entram nesta comparação.</p>
    <details className="mt-2 text-sm"><summary className="min-h-11 cursor-pointer py-3 text-primary underline underline-offset-4">Ver dados em tabela</summary><div className="overflow-x-auto"><table className="w-full text-left text-xs tabular-nums"><caption className="sr-only">Taxas acumuladas do experimento</caption><thead><tr>{['Data', 'Site base', 'Mudança proposta'].map(label => <th key={label} scope="col" className="py-3 pr-3">{label}</th>)}</tr></thead><tbody>{report.series.map((row, i) => <tr key={row.date}><th scope="row" className="py-2 pr-3 font-normal">{reportDate(row.date)}</th><td>{format(control[i])}</td><td>{format(proposed[i])}</td></tr>)}</tbody></table></div></details>
  </div>;
}
