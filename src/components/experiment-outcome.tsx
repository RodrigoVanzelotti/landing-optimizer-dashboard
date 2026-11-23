import type { VariantResult } from '@/lib/api';
import { relativeEffect, resultEvidence, resultLift, resultRate } from '@/lib/results';
import { Badge } from './ui/card';

const count = (value: number) => value.toLocaleString('pt-BR');

export function ExperimentOutcome({ variant, control, partial }: { variant: VariantResult & { name: string }; control?: VariantResult; partial: boolean }) {
  const evidence = resultEvidence(variant, control);
  const effect = relativeEffect(variant, control);
  const difference = control && control.exposures > 0 && variant.exposures > 0 ? (variant.conversionRate - control.conversionRate) * 100 : null;
  const titles = { improvement: 'Uma melhoria com evidência estatística', decline: 'O controle teve um resultado melhor', equivalent: 'Sem diferença relevante entre as versões', inconclusive: 'A diferença ainda não é conclusiva', insufficient: 'Ainda precisamos de mais dados', reference: 'Referência do experimento' };
  const surface = evidence.kind === 'improvement' ? 'bg-green-50 text-green-950' : evidence.kind === 'decline' ? 'bg-red-50 text-red-950' : 'bg-muted/60 text-foreground';
  return <section aria-label={`Resultado de ${variant.name}`} className={`rounded-lg p-5 sm:p-6 ${surface}`}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3">{evidence.kind === 'improvement' && <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="mt-0.5 h-7 w-7 shrink-0"><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></svg>}<div className="min-w-0"><h3 className="text-xl font-semibold tracking-tight">{titles[evidence.kind]}</h3><p className="mt-2 break-words text-sm">{variant.name}{partial ? ' · Resultado parcial, sujeito a mudanças' : ''}</p></div></div><Badge tone={evidence.tone} className="px-3 py-1 text-sm">{evidence.label}</Badge></div>
    <div className="mt-6 flex flex-wrap items-end gap-x-8 gap-y-4"><div><p className="text-sm">{effect === null && difference !== null ? 'Diferença observada' : 'Efeito relativo observado'}</p><p className="mt-2 break-words text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">{effect !== null ? resultLift(effect) : difference !== null ? `${difference > 0 ? '+' : ''}${difference.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} p.p.` : 'Sem dados'}</p></div>
      {control && control.exposures > 0 && variant.exposures > 0 && <p className="text-sm leading-relaxed">Controle <strong className="tabular-nums">{resultRate(control.conversionRate)}</strong><br />Variante <strong className="tabular-nums">{resultRate(variant.conversionRate)}</strong></p>}
      {effect !== null && difference !== null && <div><p className="text-sm">Diferença absoluta</p><p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{difference > 0 ? '+' : ''}{difference.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} p.p.</p></div>}
    </div>
    <p className="mt-5 text-sm leading-relaxed">{evidence.kind === 'improvement' ? 'A variante apresentou uma taxa de conversão maior que o controle neste teste.' : evidence.kind === 'decline' ? 'A variante apresentou uma taxa de conversão menor. Este resultado ajuda a orientar a próxima melhoria.' : evidence.kind === 'equivalent' ? 'A amostra sustenta ausência de uma diferença relevante de 10% em relação à referência.' : evidence.kind === 'inconclusive' ? 'A evidência atual ainda não permite uma decisão entre a variante e o controle.' : 'A evidência atual ainda não permite concluir o resultado desta variante.'} {count(variant.conversions)} conversões em {count(variant.exposures)} exposições da variante.</p>
  </section>;
}
