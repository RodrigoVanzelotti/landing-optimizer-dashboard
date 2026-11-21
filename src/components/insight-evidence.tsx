import Link from 'next/link';
import type { InsightKpi, InsightSuggestion } from '@/lib/api';
import { dateSpan, metricValue, reportDate } from '@/components/trend-chart';

function kpiValue(kpi: InsightKpi, value: number | null): string {
  return `${metricValue(value, kpi.unit === 'ratio')}${value !== null && kpi.unit === 'milliseconds' ? ' ms' : ''}`;
}

export function InsightEvidence({ payload }: { payload: InsightSuggestion['payload'] }) {
  const { kpis, designContext: design, analysisPeriod: period } = payload;
  if (!kpis?.length && !design) return <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Este insight não possui KPIs ou elementos de suporte registrados. Sua explicação ainda não pode ser conferida nos dados.</p>;

  return <section aria-label="Fundamentação do insight" className="mt-5 border-t border-border pt-4">
    {period && <p className="text-xs leading-relaxed text-muted-foreground">Dados de {dateSpan(period.from, period.to)} (UTC) · {period.sessions.toLocaleString('pt-BR')} sessões · {period.pageViews.toLocaleString('pt-BR')} visualizações.
      {period.partial && <> Cobertura parcial a partir de {reportDate(period.observedFrom)}.</>}
    </p>}
    {!!kpis?.length && <dl aria-label="KPIs relacionados" className="mt-4 grid gap-4 sm:grid-cols-2">
      {kpis.map(kpi => <div key={kpi.key} className="min-w-0">
        <dt className="break-words text-xs text-muted-foreground">{kpi.label}</dt>
        <dd className="mt-1 text-lg font-semibold tabular-nums">{kpiValue(kpi, kpi.value)}</dd>
      </div>)}
    </dl>}
    <details className="mt-3">
      <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Entender os dados e a relação com o site</summary>
      <div className="space-y-4 text-sm leading-relaxed">
        {!!kpis?.length && <dl className="space-y-4">
          {kpis.map(kpi => <div key={kpi.key}>
            <dt className="font-medium">{kpi.label}</dt>
            <dd className="mt-1 text-muted-foreground">{kpi.definition}
              {kpi.denominator !== undefined && <> Base de cálculo: {kpi.numerator?.toLocaleString('pt-BR')} / {kpi.denominator.toLocaleString('pt-BR')}.</>}
              {kpi.previousValue !== undefined && <> Período anterior: {kpiValue(kpi, kpi.previousValue)}.</>}
            </dd>
          </div>)}
        </dl>}
        {period?.comparison && <p className="text-xs text-muted-foreground">Comparação com {dateSpan(period.comparison.from, period.comparison.to)} (UTC).</p>}
        {design && <section aria-label="Elemento relacionado">
          <h3 className="font-medium">Relação com o elemento do site</h3>
          <p className="mt-1 break-all text-xs text-muted-foreground">Página {design.pagePath} · seletor <code>{design.selector}</code></p>
          {design.text && <p className="mt-2 break-words">Texto registrado: “{design.text}”</p>}
          {design.observation && <p className="mt-2 break-words">Interpretação da IA: {design.observation}</p>}
          <p className="mt-2 text-xs text-muted-foreground">Elemento registrado em {new Date(design.capturedAt).toLocaleString('pt-BR', { timeZone: 'UTC' })} (UTC). O site pode ter mudado desde então.</p>
        </section>}
        <p className="text-xs text-muted-foreground">Os valores são observados no período da análise. A relação sugerida pela IA é uma hipótese: esses dados não comprovam causalidade nem garantem melhoria.</p>
        <Link href="/overview?tab=data" className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">Consultar indicadores atuais do site</Link>
      </div>
    </details>
  </section>;
}
