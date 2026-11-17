import * as React from 'react';
import { cn } from '@/lib/utils';

interface BarRow {
  id: string;
  label: string;
  value: number | null;
  previousValue?: number | null;
  detail?: string;
  tone?: 'neutral' | 'positive' | 'negative';
}

export function BarChart({
  title, description, rows, formatValue = (value: number) => value.toLocaleString('pt-BR'), reference,
}: {
  title: string;
  description?: string;
  rows: BarRow[];
  formatValue?: (value: number) => string;
  reference?: { value: number; label: string };
}): React.ReactElement {
  const titleId = React.useId();
  const comparison = rows.some((row) => row.previousValue !== undefined);
  const max = Math.max(0, reference?.value ?? 0, ...rows.flatMap((row) => [row.value ?? 0, row.previousValue ?? 0]));
  const width = (value: number) => max > 0 ? `${(value / max) * 100}%` : '0%';

  return (
    <figure aria-labelledby={titleId} className="min-w-0">
      <figcaption className="mb-6">
        <h2 id={titleId} className="text-base font-semibold">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </figcaption>
      {reference ? (
        <p className="mb-4 text-xs font-medium text-muted-foreground">
          Linha tracejada: {reference.label} · {formatValue(reference.value)}
        </p>
      ) : null}
      <ul className="space-y-5">
        {rows.map((row) => (
          <li key={row.id}>
            <div className="mb-1.5 flex items-baseline justify-between gap-4 text-sm">
              <span className="min-w-0 break-words font-medium [overflow-wrap:anywhere]">{row.label}</span>
              <span className="shrink-0 font-semibold tabular-nums">
                {comparison ? <span className="sr-only">Atual: </span> : null}
                {row.value === null ? 'Sem dados' : formatValue(row.value)}
                {comparison ? <span className="font-normal text-muted-foreground"><span aria-hidden="true"> / </span><span className="sr-only">; anterior: </span>{row.previousValue == null ? 'Sem dados' : formatValue(row.previousValue)}</span> : null}
              </span>
            </div>
            <div aria-hidden="true" className="relative h-5 bg-muted">
              <div
                className={cn('h-full bg-primary', {
                  'bg-slate-500': row.tone === 'neutral',
                  'bg-emerald-700': row.tone === 'positive',
                  'bg-rose-700': row.tone === 'negative',
                })}
                style={{ width: width(row.value ?? 0) }}
              />
              {reference ? (
                <span className="absolute inset-y-[-3px] border-l border-dashed border-foreground" style={{ left: width(reference.value) }} />
              ) : null}
            </div>
            {comparison ? <div aria-hidden="true" className="mt-1 h-2 bg-muted"><div className="h-full bg-slate-400" style={{ width: width(row.previousValue ?? 0) }} /></div> : null}
            {row.detail ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{row.detail}</p> : null}
          </li>
        ))}
      </ul>
      <div aria-hidden="true" className="mt-4 flex justify-between border-t border-border pt-2 text-xs tabular-nums text-muted-foreground">
        <span>{formatValue(0)}</span>
        <span>{formatValue(max / 2)}</span>
        <span>{formatValue(max)}</span>
      </div>
    </figure>
  );
}
