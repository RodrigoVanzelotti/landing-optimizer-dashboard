'use client';

import { useEffect, useRef, useState } from 'react';
import type { AnalyticsReport, ReportMetrics } from '@/lib/api';
import { chartPath } from '@/lib/analytics';

export function reportDate(value: string) {
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
}
export function dateSpan(from: string, to: string) {
  return `${reportDate(from)} – ${reportDate(new Date(Date.parse(to) - 864e5).toISOString())}`;
}
export function metricValue(value: number | null, rate = false): string {
  return value === null ? 'Sem dados' : rate ? `${(value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : value.toLocaleString('pt-BR');
}

export function TrendChart({ report, metric, label, rate = false }: { report: AnalyticsReport; metric: keyof ReportMetrics; label: string; rate?: boolean }) {
  const [point, setPoint] = useState<number | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const current = report.series.map(row => row.current?.[metric] ?? null);
  const previous = report.series.map(row => row.previous?.[metric] ?? null);
  const maximum = rate ? 1 : Math.max(4, Math.ceil(Math.max(0, ...current.filter(v => v !== null), ...previous.filter(v => v !== null)) / 4) * 4);
  const index = Math.min(point ?? report.series.length - 1, report.series.length - 1);
  const selected = report.series[index];
  const x = (i: number) => 48 + i / Math.max(1, report.series.length - 1) * (width - 72);
  const ticks = [...new Set([0, Math.floor((report.series.length - 1) / 2), report.series.length - 1])];

  return <div>
    <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-2"><span aria-hidden className="w-6 border-t-2 border-primary" />Período selecionado</span>
      <span className="inline-flex items-center gap-2"><span aria-hidden className="w-6 border-t-2 border-dashed border-muted-foreground" />Período anterior</span>
    </div>
    <div ref={container} tabIndex={0} role="group" aria-label={`${label}. Use as setas esquerda e direita para explorar os pontos.`}
      className="rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); setPoint(Math.max(0, Math.min(report.series.length - 1, index + (event.key === 'ArrowLeft' ? -1 : 1)))); } }}>
      <svg viewBox={`0 0 ${width} 250`} className="block w-full" role="img" aria-label={`${label}: comparação temporal. Os valores completos estão na tabela abaixo.`}>
        {[0, 1, 2, 3, 4].map(tick => <g key={tick}>
          <line x1={48} x2={width - 24} y1={24 + tick * 46} y2={24 + tick * 46} className="stroke-border" />
          <text x={40} y={28 + tick * 46} textAnchor="end" className="fill-muted-foreground text-[11px]">{rate ? metricValue(maximum * (4 - tick) / 4, true) : (maximum * (4 - tick) / 4).toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })}</text>
        </g>)}
        {ticks.map(i => <text key={i} x={x(i)} y={235} textAnchor={i === 0 ? 'start' : i === report.series.length - 1 ? 'end' : 'middle'} className="fill-muted-foreground text-[11px]">{reportDate(report.series[i].from).slice(0, 5)}</text>)}
        <path d={chartPath(previous, maximum, width)} fill="none" className="stroke-muted-foreground" strokeWidth={2} strokeDasharray="6 5" />
        <path d={chartPath(current, maximum, width)} fill="none" className="stroke-primary" strokeWidth={2.5} />
        {[previous, current].map((values, series) => values.map((value, i) => value !== null &&
          (i === 0 || values[i - 1] === null) && (i === values.length - 1 || values[i + 1] === null) &&
          <circle key={`${series}-${i}`} cx={x(i)} cy={208 - value / maximum * 184} r={3} className={series ? 'fill-primary' : 'fill-muted-foreground'} />))}
        <line x1={x(index)} x2={x(index)} y1={24} y2={208} className="stroke-border" strokeDasharray="3 3" />
        {current[index] !== null && <circle cx={x(index)} cy={208 - current[index]! / maximum * 184} r={4} className="fill-primary" />}
        {previous[index] !== null && <circle cx={x(index)} cy={208 - previous[index]! / maximum * 184} r={3} className="fill-muted-foreground" />}
        {report.series.map((row, i) => <rect key={row.from} x={x(i) - (width - 72) / Math.max(1, report.series.length - 1) / 2} y={16} width={(width - 72) / Math.max(1, report.series.length - 1)} height={200} fill="transparent" onMouseEnter={() => setPoint(i)} onPointerDown={() => setPoint(i)} />)}
      </svg>
    </div>
    <p className="mt-2 text-xs text-muted-foreground">Toque no gráfico, passe o cursor ou use as setas do teclado para explorar.</p>
    {selected && <dl className="mt-4 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-2" aria-live="polite">
      <div><dt className="text-xs text-muted-foreground">{dateSpan(selected.from, selected.to)}</dt><dd className="mt-1 font-semibold tabular-nums">{metricValue(current[index], rate)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Anterior · {dateSpan(selected.previousFrom, selected.previousTo)}</dt><dd className="mt-1 font-semibold tabular-nums">{metricValue(previous[index], rate)}</dd></div>
    </dl>}
    <details className="mt-4 text-sm"><summary className="min-h-11 cursor-pointer py-3 text-primary underline underline-offset-4">Ver dados em tabela</summary>
      <div className="overflow-x-auto"><table className="w-full min-w-[440px] text-left text-xs tabular-nums"><caption className="sr-only">{label}: valores por intervalo</caption><thead><tr>{['Período', 'Valor', 'Período anterior', 'Valor anterior'].map(title => <th key={title} scope="col" className="py-3 pr-3 font-medium">{title}</th>)}</tr></thead>
        <tbody className="divide-y divide-border">{report.series.map((row, i) => <tr key={row.from}><th scope="row" className="py-3 pr-3 font-normal">{dateSpan(row.from, row.to)}</th><td>{metricValue(current[i], rate)}</td><td className="px-3">{dateSpan(row.previousFrom, row.previousTo)}</td><td>{metricValue(previous[i], rate)}</td></tr>)}</tbody>
      </table></div>
    </details>
  </div>;
}
