import * as React from 'react';
import type { ReportMetrics } from '@/lib/api';
import { conversionDrivers } from '@/lib/analytics';
import { cn, formatNumber } from '@/lib/utils';

export function ConversionDrivers({ current, previous }: { current: Pick<ReportMetrics, 'pageViews' | 'conversions'>; previous: Pick<ReportMetrics, 'pageViews' | 'conversions'> }): React.ReactElement {
  const drivers = conversionDrivers(current, previous);
  const change = current.conversions - previous.conversions;
  const rows = drivers ? [{ label: 'Tráfego', value: drivers.traffic }, { label: 'Taxa de conversão', value: drivers.rate }] : [];
  const max = Math.max(1, ...rows.map((row) => Math.abs(row.value)));
  const signed = (value: number) => `${value > 0 ? '+' : ''}${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}`;
  return (
    <figure aria-label="Decomposição da variação nas conversões">
      <figcaption className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">Variação nas conversões</h2>
        <span className={cn('font-semibold tabular-nums', change > 0 ? 'text-emerald-700' : change < 0 ? 'text-rose-700' : 'text-muted-foreground')}>
          {change > 0 ? '+' : ''}{formatNumber(change)}
        </span>
      </figcaption>
      {drivers ? (
        <>
          <ul className="space-y-6">
            {rows.map((row) => (
              <li key={row.label}>
                <div className="mb-2 flex justify-between gap-3 text-sm"><span>{row.label}</span><span className="font-semibold tabular-nums">{signed(row.value)}</span></div>
                <div aria-hidden="true" className="relative grid h-6 grid-cols-2 bg-muted">
                  <div className="flex justify-end">{row.value < 0 ? <div className="h-full bg-rose-700" style={{ width: `${Math.abs(row.value) / max * 100}%` }} /> : null}</div>
                  <div>{row.value > 0 ? <div className="h-full bg-emerald-700" style={{ width: `${row.value / max * 100}%` }} /> : null}</div>
                  <span className="absolute inset-y-[-3px] left-1/2 border-l border-foreground" />
                </div>
              </li>
            ))}
          </ul>
          <div aria-hidden="true" className="mt-4 flex justify-between text-xs text-muted-foreground"><span>Menos conversões</span><span>0</span><span>Mais conversões</span></div>
          <details className="mt-6 text-xs leading-5 text-muted-foreground">
            <summary className="cursor-pointer focus-visible:outline-primary">Cálculo</summary>
            <p className="mt-2">Tráfego: variação de visualizações × taxa anterior. Taxa: restante da variação. Decomposição aritmética, sem atribuição causal.</p>
          </details>
        </>
      ) : <p className="text-sm text-muted-foreground">Sem visualizações nos dois períodos.</p>}
    </figure>
  );
}
