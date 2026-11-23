import type { ExperimentResult, VariantResult } from './api';

export function relativeEffect(variant: VariantResult, control?: VariantResult): number | null {
  return variant.exposures > 0 && control && control.exposures > 0 ? variant.lift : null;
}

export function resultEvidence(variant: VariantResult, control?: VariantResult) {
  if (variant.isControl) return { kind: 'reference', label: 'Referência', tone: 'default' } as const;
  if (!control?.exposures || !variant.exposures) return { kind: 'insufficient', label: 'Dados insuficientes', tone: 'default' } as const;
  if (variant.decision === 'equivalent') return { kind: 'equivalent', label: 'Sem diferença relevante', tone: 'default' } as const;
  if (variant.decision === 'collecting') return { kind: 'inconclusive', label: 'Evidência em coleta', tone: 'default' } as const;
  if (variant.decision === 'improvement') return { kind: 'improvement', label: 'Melhora significativa', tone: 'green' } as const;
  if (variant.decision === 'decline') return { kind: 'decline', label: 'Queda significativa', tone: 'red' } as const;
  if (variant.pValue === null) return { kind: 'insufficient', label: 'Dados insuficientes', tone: 'default' } as const;
  if (!variant.significant || variant.conversionRate === control.conversionRate) return { kind: 'inconclusive', label: 'Sem diferença significativa', tone: 'default' } as const;
  if (variant.conversionRate > control.conversionRate) return { kind: 'improvement', label: 'Melhora significativa', tone: 'green' } as const;
  return { kind: 'decline', label: 'Queda significativa', tone: 'red' } as const;
}

export function orderResults(results: ExperimentResult[], order: string): ExperimentResult[] {
  function score(result: ExperimentResult): number | null {
    if (order.startsWith('exposures')) return result.variants.reduce((sum, variant) => sum + variant.exposures, 0);
    if (order.startsWith('start')) return result.experiment.startedAt ? Date.parse(result.experiment.startedAt) : null;
    const control = result.variants.find(variant => variant.isControl);
    const effects = result.variants.filter(variant => !variant.isControl).map(variant => relativeEffect(variant, control)).filter(value => value !== null);
    return effects.length ? Math.max(...effects) : null;
  }
  return [...results].sort((a, b) => {
    const left = score(a), right = score(b);
    if (left === null && right !== null) return 1;
    if (right === null && left !== null) return -1;
    return (left !== null && right !== null ? (left - right) * (order.endsWith('asc') ? 1 : -1) : 0) || a.experiment.name.localeCompare(b.experiment.name, 'pt-BR');
  });
}

export const resultRate = (value: number) => `${(value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
export const resultLift = (value: number | null) => value === null ? 'Sem base relativa' : `${value > 0 ? '+' : ''}${resultRate(value)}`;
